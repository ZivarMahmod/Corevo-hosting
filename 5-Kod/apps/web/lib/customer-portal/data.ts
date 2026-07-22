import 'server-only'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/platform/service'
import { portalSessionDigest } from './crypto'
import { PORTAL_UUID_PATTERN } from './link'
import { PORTAL_SESSION_COOKIE, parsePortalSessionCookie } from './session'
import type {
  PortalBookingCursor,
  PortalBookingDetailResult,
  PortalBookingListResult,
  PortalBookingProjection,
  PortalBookingScope,
  PortalKnownBookingStatus,
  PortalPresentationStatus,
  PortalSessionSnapshot,
  PortalSessionSnapshotResult,
} from './types'

type PortalRpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | number | null>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

type PortalSessionAccess = {
  sessionPublicId: string
  secretDigest: string
  client: PortalRpcClient
}

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const STATUS_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const KNOWN_STATUSES = new Set<PortalKnownBookingStatus>([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function normalizedText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (
    normalized.length < minimum ||
    normalized.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    return null
  }
  return normalized
}

function optionalText(value: unknown, maximum: number): string | null | undefined {
  if (value === null || value === '') return null
  return normalizedText(value, 1, maximum) ?? undefined
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = TIMESTAMP_PATTERN.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1 && month <= 12 &&
    day >= 1 && day <= (daysInMonth[month - 1] ?? 0) &&
    hour <= 23 && minute <= 59 && second <= 59
}

function presentationStatus(status: string): PortalPresentationStatus {
  return KNOWN_STATUSES.has(status as PortalKnownBookingStatus)
    ? status as PortalKnownBookingStatus
    : 'unknown'
}

function parseBooking(value: unknown): PortalBookingProjection | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'currency',
    'endAt',
    'id',
    'locationAddress',
    'locationName',
    'priceCents',
    'serviceName',
    'staffName',
    'startAt',
    'status',
  ])) {
    return null
  }

  const serviceName = normalizedText(value.serviceName, 1, 200)
  const staffName = optionalText(value.staffName, 160)
  const locationName = optionalText(value.locationName, 200)
  const locationAddress = optionalText(value.locationAddress, 500)
  if (
    typeof value.id !== 'string' ||
    !PORTAL_UUID_PATTERN.test(value.id) ||
    !validTimestamp(value.startAt) ||
    !validTimestamp(value.endAt) ||
    Date.parse(value.endAt) <= Date.parse(value.startAt) ||
    typeof value.status !== 'string' ||
    !STATUS_PATTERN.test(value.status) ||
    !serviceName ||
    staffName === undefined ||
    locationName === undefined ||
    locationAddress === undefined ||
    typeof value.currency !== 'string' ||
    !CURRENCY_PATTERN.test(value.currency)
  ) {
    return null
  }

  let price: PortalBookingProjection['price'] = null
  if (value.priceCents !== null) {
    if (
      typeof value.priceCents !== 'number' ||
      !Number.isSafeInteger(value.priceCents) ||
      value.priceCents < 0
    ) {
      return null
    }
    price = { cents: value.priceCents, currency: value.currency }
  }

  return {
    id: value.id.toLowerCase(),
    startAt: value.startAt,
    endAt: value.endAt,
    runtimeStatus: value.status,
    presentationStatus: presentationStatus(value.status),
    serviceName,
    staffName,
    locationName,
    locationAddress,
    price,
  }
}

function parseSnapshot(value: unknown): PortalSessionSnapshot | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'absoluteExpiresAt',
    'customerName',
    'lastSeenAt',
    'tenantName',
    'tenantSlug',
  ])) {
    return null
  }

  const tenantName = normalizedText(value.tenantName, 1, 200)
  const customerName = normalizedText(value.customerName, 0, 120)
  if (
    typeof value.tenantSlug !== 'string' ||
    !TENANT_SLUG_PATTERN.test(value.tenantSlug) ||
    tenantName === null ||
    customerName === null ||
    !validTimestamp(value.lastSeenAt) ||
    !validTimestamp(value.absoluteExpiresAt)
  ) {
    return null
  }

  return {
    tenantSlug: value.tenantSlug,
    tenantName,
    customerName,
    lastSeenAt: value.lastSeenAt,
    absoluteExpiresAt: value.absoluteExpiresAt,
  }
}

async function resolveSession(): Promise<PortalSessionAccess | 'expired' | 'unavailable'> {
  try {
    const store = await cookies()
    const credential = parsePortalSessionCookie(store.get(PORTAL_SESSION_COOKIE)?.value)
    if (!credential) return 'expired'

    const client = createServiceClient() as unknown as PortalRpcClient | null
    if (!client) return 'unavailable'

    return {
      sessionPublicId: credential.sessionPublicId,
      secretDigest: await portalSessionDigest(credential.secret),
      client,
    }
  } catch {
    return 'unavailable'
  }
}

function unavailableOrExpired(
  access: 'expired' | 'unavailable',
): { outcome: 'expired' } | { outcome: 'unavailable' } {
  return { outcome: access }
}

function pageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 20
  return Math.min(20, Math.max(1, Math.trunc(value)))
}

function validCursor(cursor: PortalBookingCursor | undefined): boolean {
  return cursor === undefined || (
    validTimestamp(cursor.startAt) &&
    PORTAL_UUID_PATTERN.test(cursor.id)
  )
}

export async function getPortalSessionSnapshot(): Promise<PortalSessionSnapshotResult> {
  const access = await resolveSession()
  if (typeof access === 'string') return unavailableOrExpired(access)

  try {
    const { data, error } = await access.client.rpc('customer_portal_session_snapshot', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.secretDigest,
    })
    if (error) return { outcome: 'unavailable' }
    if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      return { outcome: 'unavailable' }
    }

    const row = data[0]
    if (row.outcome === 'expired' && row.snapshot === null) return { outcome: 'expired' }
    if (row.outcome === 'not_found') return { outcome: 'not_found' }
    if (row.outcome !== 'ok') return { outcome: 'unavailable' }

    const snapshot = parseSnapshot(row.snapshot)
    return snapshot ? { outcome: 'ok', snapshot } : { outcome: 'unavailable' }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function listPortalBookings({
  scope,
  cursor,
  pageSize: requestedPageSize,
}: {
  scope: PortalBookingScope
  cursor?: PortalBookingCursor
  pageSize?: number
}): Promise<PortalBookingListResult> {
  const access = await resolveSession()
  if (typeof access === 'string') return unavailableOrExpired(access)
  if ((scope !== 'upcoming' && scope !== 'history') || !validCursor(cursor)) {
    return { outcome: 'unavailable' }
  }
  const boundedPageSize = pageSize(requestedPageSize)

  try {
    const { data, error } = await access.client.rpc('customer_portal_list_bookings', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.secretDigest,
      p_scope: scope,
      p_cursor_start: cursor?.startAt ?? null,
      p_cursor_id: cursor?.id.toLowerCase() ?? null,
      p_page_size: boundedPageSize,
    })
    if (error || !isRecord(data)) return { outcome: 'unavailable' }
    if (data.outcome === 'expired') return { outcome: 'expired' }
    if (data.outcome === 'not_found') return { outcome: 'not_found' }
    if (
      data.outcome !== 'ok' ||
      data.scope !== scope ||
      data.pageSize !== boundedPageSize ||
      !Array.isArray(data.items) ||
      data.items.length > boundedPageSize
    ) {
      return { outcome: 'unavailable' }
    }

    const items: PortalBookingProjection[] = []
    for (const item of data.items) {
      const parsed = parseBooking(item)
      if (!parsed) return { outcome: 'unavailable' }
      items.push(parsed)
    }
    const last = items.at(-1)
    const nextCursor = items.length === boundedPageSize && last
      ? { startAt: last.startAt, id: last.id }
      : null

    return { outcome: 'ok', scope, pageSize: boundedPageSize, items, nextCursor }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function getPortalBooking(bookingPublicId: string): Promise<PortalBookingDetailResult> {
  const access = await resolveSession()
  if (typeof access === 'string') return unavailableOrExpired(access)
  if (!PORTAL_UUID_PATTERN.test(bookingPublicId)) return { outcome: 'not_found' }

  try {
    const { data, error } = await access.client.rpc('customer_portal_get_booking', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.secretDigest,
      p_booking_public_id: bookingPublicId.toLowerCase(),
    })
    if (error || !isRecord(data)) return { outcome: 'unavailable' }
    if (data.outcome === 'expired') return { outcome: 'expired' }
    if (data.outcome === 'not_found') return { outcome: 'not_found' }
    if (data.outcome !== 'ok') return { outcome: 'unavailable' }

    const booking = parseBooking(data.booking)
    return booking?.id === bookingPublicId.toLowerCase()
      ? { outcome: 'ok', booking }
      : { outcome: 'unavailable' }
  } catch {
    return { outcome: 'unavailable' }
  }
}
