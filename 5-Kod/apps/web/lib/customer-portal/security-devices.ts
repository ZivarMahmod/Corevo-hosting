import 'server-only'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/platform/service'
import { portalSessionDigest } from './crypto'
import { PORTAL_SESSION_COOKIE, parsePortalSessionCookie } from './session'

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, string | null>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

type PortalAccess = {
  client: RpcClient
  sessionPublicId: string
  secretDigest: string
}

export type PortalSessionDevice = {
  label: string
  isCurrent: boolean
  createdAt: string
  lastSeenAt: string
}

export type PortalBookingTrustDevice = {
  label: string
  createdAt: string
  lastSeenAt: string
}

export type PortalSecuritySnapshotResult =
  | {
      outcome: 'ok'
      sessions: PortalSessionDevice[]
      bookingTrusts: PortalBookingTrustDevice[]
    }
  | { outcome: 'expired' }
  | { outcome: 'unavailable' }

export type PortalSecurityMutationResult =
  | { outcome: 'success'; count: number }
  | { outcome: 'unavailable' }

const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    TIMESTAMP_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
}

function safeLabel(value: unknown, fallback: string): string | null {
  if (value === null) return fallback
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) return null
  return value
}

async function portalAccess(): Promise<PortalAccess | null> {
  try {
    const store = await cookies()
    const credential = parsePortalSessionCookie(
      store.get(PORTAL_SESSION_COOKIE)?.value,
    )
    if (!credential) return null
    const client = createServiceClient() as unknown as RpcClient | null
    if (!client) return null
    return {
      client,
      sessionPublicId: credential.sessionPublicId,
      secretDigest: await portalSessionDigest(credential.secret),
    }
  } catch {
    return null
  }
}

function parseSession(value: unknown): PortalSessionDevice | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['label', 'isCurrent', 'createdAt', 'lastSeenAt'])) {
    return null
  }
  const label = safeLabel(
    value.label,
    value.isCurrent === true ? 'Den här webbläsaren' : 'Annan webbläsare',
  )
  if (
    !label ||
    typeof value.isCurrent !== 'boolean' ||
    !validTimestamp(value.createdAt) ||
    !validTimestamp(value.lastSeenAt)
  ) return null
  return {
    label,
    isCurrent: value.isCurrent,
    createdAt: value.createdAt,
    lastSeenAt: value.lastSeenAt,
  }
}

function parseTrust(value: unknown): PortalBookingTrustDevice | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['label', 'createdAt', 'lastSeenAt'])) return null
  const label = safeLabel(value.label, 'PIN-fri bokningsenhet')
  if (!label || !validTimestamp(value.createdAt) || !validTimestamp(value.lastSeenAt)) return null
  return { label, createdAt: value.createdAt, lastSeenAt: value.lastSeenAt }
}

export async function getPortalSecuritySnapshot(): Promise<PortalSecuritySnapshotResult> {
  const access = await portalAccess()
  if (!access) return { outcome: 'unavailable' }
  try {
    const { data, error } = await access.client.rpc('customer_portal_security_snapshot', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.secretDigest,
    })
    if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      return { outcome: 'unavailable' }
    }
    const row = data[0]
    if (row.outcome === 'expired') return { outcome: 'expired' }
    if (
      row.outcome !== 'ok' ||
      !isRecord(row.security) ||
      !hasOnlyKeys(row.security, ['sessions', 'bookingTrusts']) ||
      !Array.isArray(row.security.sessions) ||
      !Array.isArray(row.security.bookingTrusts)
    ) return { outcome: 'unavailable' }

    const sessions = row.security.sessions.map(parseSession)
    const bookingTrusts = row.security.bookingTrusts.map(parseTrust)
    if (sessions.some((item) => !item) || bookingTrusts.some((item) => !item)) {
      return { outcome: 'unavailable' }
    }
    return {
      outcome: 'ok',
      sessions: sessions as PortalSessionDevice[],
      bookingTrusts: bookingTrusts as PortalBookingTrustDevice[],
    }
  } catch {
    return { outcome: 'unavailable' }
  }
}

async function revoke(name: string): Promise<PortalSecurityMutationResult> {
  const access = await portalAccess()
  if (!access) return { outcome: 'unavailable' }
  try {
    const args: Record<string, string | null> = {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.secretDigest,
    }
    if (name === 'customer_portal_revoke_booking_trusts') {
      args.p_trust_public_id = null
    }
    const { data, error } = await access.client.rpc(name, args)
    if (error || !Number.isSafeInteger(data) || Number(data) < 0) {
      return { outcome: 'unavailable' }
    }
    return { outcome: 'success', count: Number(data) }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export const revokeOtherPortalSessions = () =>
  revoke('customer_portal_revoke_other_sessions')

export const revokePortalBookingTrusts = () =>
  revoke('customer_portal_revoke_booking_trusts')
