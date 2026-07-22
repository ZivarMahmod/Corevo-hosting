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
const COUNTRY_PATTERN = /^[A-Z]{2}$/
const LOCALE_PATTERN = /^[a-z]{2}-[A-Z]{2}$/
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

function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 100) return false
  try {
    new Intl.DateTimeFormat('sv-SE', { timeZone: value }).format(0)
    return true
  } catch {
    return false
  }
}

function safeHttpsUrl(value: unknown): string | null | undefined {
  if (value === null) return null
  if (
    typeof value !== 'string' || value.length > 2048 || value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) return undefined
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      !url.hostname
    ) return undefined
    return value
  } catch {
    return undefined
  }
}

function safeOrigin(value: unknown): string | null {
  const parsed = safeHttpsUrl(value)
  if (!parsed) return null
  const url = new URL(parsed)
  return url.port === '' && url.origin === parsed ? parsed : null
}

function safeMapUrl(value: unknown): string | null | undefined {
  const parsed = safeHttpsUrl(value)
  if (parsed === null || parsed === undefined) return parsed
  const url = new URL(parsed)
  if (
    url.hostname !== 'www.openstreetmap.org' ||
    url.pathname !== '/' ||
    url.hash !== '' ||
    !url.searchParams.has('mlat') ||
    !url.searchParams.has('mlon') ||
    [...url.searchParams.keys()].some((key) => key !== 'mlat' && key !== 'mlon')
  ) return undefined
  const lat = Number(url.searchParams.get('mlat'))
  const lon = Number(url.searchParams.get('mlon'))
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lon) && lon >= -180 && lon <= 180
    ? parsed
    : undefined
}

function safeRebookUrl(value: unknown): string | null | undefined {
  const parsed = safeHttpsUrl(value)
  if (parsed === null || parsed === undefined) return parsed
  const url = new URL(parsed)
  return url.port === '' && url.pathname === '/boka' && url.search === '' && url.hash === ''
    ? parsed
    : undefined
}

function parseLocation(value: unknown): PortalBookingProjection['location'] | undefined {
  if (value === null) return null
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'address', 'mapUrl', 'name', 'phone', 'timezone',
  ])) return undefined

  const name = optionalText(value.name, 200)
  const address = optionalText(value.address, 500)
  const phone = optionalText(value.phone, 40)
  const mapUrl = safeHttpsUrl(value.mapUrl)
  if (
    name === undefined || address === undefined || phone === undefined ||
    mapUrl === undefined || !validTimezone(value.timezone)
  ) return undefined

  return { name, address, phone, mapUrl, timezone: value.timezone }
}

function parseBooking(value: unknown): PortalBookingProjection | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'canCancel',
    'cancelDeadline',
    'currency',
    'durationMinutes',
    'endTs',
    'id',
    'location',
    'priceCents',
    'publicRebookUrl',
    'serviceName',
    'staffTitle',
    'startTs',
    'status',
  ])) {
    return null
  }

  const serviceName = normalizedText(value.serviceName, 1, 200)
  const staffTitle = optionalText(value.staffTitle, 160)
  const location = parseLocation(value.location)
  const publicRebookUrl = safeRebookUrl(value.publicRebookUrl)
  if (
    typeof value.id !== 'string' ||
    !PORTAL_UUID_PATTERN.test(value.id) ||
    !validTimestamp(value.startTs) ||
    !validTimestamp(value.endTs) ||
    Date.parse(value.endTs) <= Date.parse(value.startTs) ||
    typeof value.status !== 'string' ||
    !STATUS_PATTERN.test(value.status) ||
    !serviceName ||
    typeof value.durationMinutes !== 'number' ||
    !Number.isSafeInteger(value.durationMinutes) ||
    value.durationMinutes !== Math.floor((Date.parse(value.endTs) - Date.parse(value.startTs)) / 60_000) ||
    staffTitle === undefined ||
    location === undefined ||
    typeof value.currency !== 'string' ||
    !CURRENCY_PATTERN.test(value.currency) ||
    typeof value.canCancel !== 'boolean' ||
    (value.cancelDeadline !== null && !validTimestamp(value.cancelDeadline)) ||
    publicRebookUrl === undefined
  ) {
    return null
  }

  if (value.priceCents !== null) {
    if (
      typeof value.priceCents !== 'number' ||
      !Number.isSafeInteger(value.priceCents) ||
      value.priceCents < 0
    ) {
      return null
    }
  }

  const cancellableStatus = value.status === 'pending' || value.status === 'confirmed'
  if (
    (!cancellableStatus && (value.canCancel || value.cancelDeadline !== null)) ||
    (cancellableStatus && value.cancelDeadline === null)
  ) {
    return null
  }

  return {
    id: value.id.toLowerCase(),
    startTs: value.startTs,
    endTs: value.endTs,
    status: value.status,
    presentationStatus: presentationStatus(value.status),
    serviceName,
    durationMinutes: value.durationMinutes,
    staffTitle,
    location,
    priceCents: value.priceCents,
    currency: value.currency,
    canCancel: value.canCancel,
    cancelDeadline: value.cancelDeadline,
    publicRebookUrl,
  }
}

function parseSnapshot(value: unknown): PortalSessionSnapshot | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'absoluteExpiresAt',
    'address',
    'bookingOrigin',
    'cancellationCutoffHours',
    'currency',
    'customerName',
    'defaultCountry',
    'lastSeenAt',
    'locale',
    'logoUrl',
    'mapUrl',
    'phone',
    'tenantName',
    'tenantSlug',
    'timezone',
    'verticalLabel',
  ])) {
    return null
  }

  const tenantName = normalizedText(value.tenantName, 1, 200)
  const customerName = normalizedText(value.customerName, 0, 120)
  const logoUrl = safeHttpsUrl(value.logoUrl)
  const verticalLabel = optionalText(value.verticalLabel, 200)
  const phone = optionalText(value.phone, 40)
  const address = optionalText(value.address, 500)
  const mapUrl = safeMapUrl(value.mapUrl)
  const bookingOrigin = safeOrigin(value.bookingOrigin)
  if (
    typeof value.tenantSlug !== 'string' ||
    !TENANT_SLUG_PATTERN.test(value.tenantSlug) ||
    tenantName === null ||
    customerName === null ||
    logoUrl === undefined ||
    verticalLabel === undefined ||
    phone === undefined ||
    address === undefined ||
    mapUrl === undefined ||
    !bookingOrigin ||
    !validTimezone(value.timezone) ||
    typeof value.locale !== 'string' || !LOCALE_PATTERN.test(value.locale) ||
    typeof value.defaultCountry !== 'string' || !COUNTRY_PATTERN.test(value.defaultCountry) ||
    typeof value.currency !== 'string' || !CURRENCY_PATTERN.test(value.currency) ||
    typeof value.cancellationCutoffHours !== 'number' ||
    !Number.isSafeInteger(value.cancellationCutoffHours) ||
    value.cancellationCutoffHours < 0 || value.cancellationCutoffHours > 9999 ||
    !validTimestamp(value.lastSeenAt) ||
    !validTimestamp(value.absoluteExpiresAt)
  ) {
    return null
  }

  return {
    tenantSlug: value.tenantSlug,
    tenantName,
    logoUrl,
    verticalLabel,
    phone,
    address,
    mapUrl,
    bookingOrigin,
    timezone: value.timezone,
    locale: value.locale,
    defaultCountry: value.defaultCountry,
    currency: value.currency,
    cancellationCutoffHours: value.cancellationCutoffHours,
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
    validTimestamp(cursor.startTs) &&
    PORTAL_UUID_PATTERN.test(cursor.id)
  )
}

export async function getPortalSessionSnapshot(): Promise<PortalSessionSnapshotResult> {
  const access = await resolveSession()
  if (access === 'expired') return { outcome: 'expired', recoveryTenantSlug: null }
  if (access === 'unavailable') return { outcome: 'unavailable' }

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
    if (row.outcome === 'expired' && row.snapshot === null) {
      const slug = row.recovery_tenant_slug
      if (slug !== null && (typeof slug !== 'string' || !TENANT_SLUG_PATTERN.test(slug))) {
        return { outcome: 'unavailable' }
      }
      return { outcome: 'expired', recoveryTenantSlug: slug }
    }
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
      p_cursor_start: cursor?.startTs ?? null,
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
      data.items.length > boundedPageSize ||
      typeof data.hasMore !== 'boolean'
    ) {
      return { outcome: 'unavailable' }
    }

    const items: PortalBookingProjection[] = []
    for (const item of data.items) {
      const parsed = parseBooking(item)
      if (!parsed) return { outcome: 'unavailable' }
      items.push(parsed)
    }
    let nextCursor: PortalBookingCursor | null = null
    if (data.nextCursor !== null) {
      if (
        !isRecord(data.nextCursor) ||
        !hasOnlyKeys(data.nextCursor, ['id', 'startTs']) ||
        typeof data.nextCursor.startTs !== 'string' ||
        typeof data.nextCursor.id !== 'string'
      ) {
        return { outcome: 'unavailable' }
      }
      nextCursor = {
        startTs: data.nextCursor.startTs,
        id: data.nextCursor.id.toLowerCase(),
      }
      if (!validCursor(nextCursor)) return { outcome: 'unavailable' }
    }

    const last = items.at(-1)
    if (
      (data.hasMore && (
        items.length !== boundedPageSize ||
        !nextCursor ||
        !last ||
        nextCursor.startTs !== last.startTs ||
        nextCursor.id !== last.id
      )) ||
      (!data.hasMore && nextCursor !== null)
    ) return { outcome: 'unavailable' }

    return {
      outcome: 'ok', scope, pageSize: boundedPageSize, items,
      hasMore: data.hasMore, nextCursor,
    }
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
    if (!booking) return { outcome: 'unavailable' }
    return booking.id === bookingPublicId.toLowerCase()
      ? { outcome: 'ok', booking }
      : { outcome: 'not_found' }
  } catch {
    return { outcome: 'unavailable' }
  }
}
