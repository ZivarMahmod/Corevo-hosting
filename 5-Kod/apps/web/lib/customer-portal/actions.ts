import 'server-only'

import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/platform/service'
import { portalSessionDigest } from './crypto'
import { PORTAL_UUID_PATTERN } from './link'
import { PORTAL_SESSION_COOKIE, parsePortalSessionCookie } from './session'

export type PortalCancellationResult =
  | { outcome: 'success' }
  | { outcome: 'policy_blocked' }
  | { outcome: 'unavailable' }

export type PortalCancellationInput = {
  bookingPublicId: string
  expectedCutoffHours: number
  idempotencyKey: string
}

type CancellationRpcClient = {
  rpc: (
    name: 'customer_portal_cancel_booking',
    args: {
      p_session_public_id: string
      p_secret_digest: string
      p_booking_public_id: string
      p_expected_cutoff_hours: number
      p_idempotency_key: string
    },
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasExactResultKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).sort().join(',') === 'booking_status,outcome,refund_job_id'
}

function isOptionalUuid(value: unknown): boolean {
  return value === null || (typeof value === 'string' && PORTAL_UUID_PATTERN.test(value))
}

const POLICY_CHANGED_STATUSES = new Set(['pending', 'confirmed'])
const NOT_ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'completed', 'no_show'])

function parseCancellationResult(data: unknown): PortalCancellationResult {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
    return { outcome: 'unavailable' }
  }

  const row = data[0]
  if (!hasExactResultKeys(row) || !isOptionalUuid(row.refund_job_id)) {
    return { outcome: 'unavailable' }
  }

  if (row.outcome === 'cancelled' || row.outcome === 'already_cancelled') {
    return row.booking_status === 'cancelled'
      ? { outcome: 'success' }
      : { outcome: 'unavailable' }
  }

  if (row.outcome === 'policy_changed') {
    return typeof row.booking_status === 'string' &&
      POLICY_CHANGED_STATUSES.has(row.booking_status) &&
      row.refund_job_id === null
      ? { outcome: 'policy_blocked' }
      : { outcome: 'unavailable' }
  }

  if (row.outcome === 'not_allowed') {
    return typeof row.booking_status === 'string' &&
      NOT_ALLOWED_STATUSES.has(row.booking_status) &&
      row.refund_job_id === null
      ? { outcome: 'policy_blocked' }
      : { outcome: 'unavailable' }
  }

  if ((row.outcome === 'not_found' || row.outcome === 'idempotency_conflict') &&
      row.booking_status === null && row.refund_job_id === null) {
    return { outcome: 'unavailable' }
  }

  return { outcome: 'unavailable' }
}

function validInput(input: PortalCancellationInput): boolean {
  return PORTAL_UUID_PATTERN.test(input.bookingPublicId) &&
    Number.isSafeInteger(input.expectedCutoffHours) &&
    input.expectedCutoffHours >= 0 &&
    input.expectedCutoffHours <= 9999 &&
    PORTAL_UUID_PATTERN.test(input.idempotencyKey)
}

export async function cancelPortalBooking(
  input: PortalCancellationInput,
): Promise<PortalCancellationResult> {
  if (!validInput(input)) return { outcome: 'unavailable' }

  try {
    const store = await cookies()
    const credential = parsePortalSessionCookie(store.get(PORTAL_SESSION_COOKIE)?.value)
    const client = createServiceClient() as CancellationRpcClient | null
    if (!credential || !client) return { outcome: 'unavailable' }

    const { data, error } = await client.rpc('customer_portal_cancel_booking', {
      p_session_public_id: credential.sessionPublicId,
      p_secret_digest: await portalSessionDigest(credential.secret),
      p_booking_public_id: input.bookingPublicId.toLowerCase(),
      p_expected_cutoff_hours: input.expectedCutoffHours,
      p_idempotency_key: input.idempotencyKey.toLowerCase(),
    })
    return error ? { outcome: 'unavailable' } : parseCancellationResult(data)
  } catch {
    return { outcome: 'unavailable' }
  }
}
