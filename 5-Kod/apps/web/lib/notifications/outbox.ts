import 'server-only'
import type { Json } from '@corevo/db'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'

// 0092 gör 0091-ledgern till den enda durable kön. Worker äger transport,
// retry och terminal kvittens.

export type NotificationCategory = 'transactional' | 'marketing'
export type NotificationChannel = 'email' | 'sms'

export type NotificationOutboxStatus =
  | 'routing'
  | 'queued'
  | 'attempting'
  | 'delivery_started'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped'
  | 'simulated'

export type NotificationOutboxRow = {
  id: string
  tenant_id: string
  customer_id: string | null
  booking_id: string | null
  staff_id: string | null
  event_type: string
  event_key: string
  category: NotificationCategory
  chosen_channel: NotificationChannel | null
  fallback_channel: NotificationChannel | null
  consent_state: Json | null
  payload: Json
  status: NotificationOutboxStatus
  skip_reason: string | null
  cost_ore: number | null
  cost_currency: string | null
  parts: number | null
  provider_ref: string | null
  attempt_count: number
  max_attempts: number
  available_at: string
  lease_token: string | null
  lease_expires_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
  delivered_at: string | null
}

export type ClaimedNotificationOutboxRow = NotificationOutboxRow & {
  status: 'attempting'
  chosen_channel: NotificationChannel
  lease_token: string
  lease_expires_at: string
}

function isClaimedOutboxRow(value: unknown): value is ClaimedNotificationOutboxRow {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return row.status === 'attempting'
    && typeof row.id === 'string'
    && typeof row.tenant_id === 'string'
    && typeof row.event_type === 'string'
    && typeof row.event_key === 'string'
    && (row.chosen_channel === 'email' || row.chosen_channel === 'sms')
    && typeof row.lease_token === 'string'
    && row.lease_token.length > 0
    && typeof row.lease_expires_at === 'string'
}

function claimIdentity(value: unknown): { id: string; leaseToken: string } | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return typeof row.id === 'string'
    && typeof row.lease_token === 'string'
    && row.lease_token.length > 0
    ? { id: row.id, leaseToken: row.lease_token }
    : null
}

export type NotificationDeliveryResult =
  | {
      status: 'sent' | 'delivered' | 'simulated'
      providerRef?: string | null
      costOre?: number | null
      costCurrency?: string | null
      parts?: number | null
    }
  | { status: 'skipped'; reason: DeliverySkipCode }
  | { status: 'failed'; reason: DeliveryFailureCode }
  | { status: 'retry'; error: DeliveryRetryCode }

export type DeliverySkipCode =
  | 'no_recipient'
  | 'channel_disabled'
  | 'consent_denied'
  | 'transport_off'
  | 'gdpr_erased'

export type DeliveryFailureCode =
  | 'delivery_uncertain'
  | 'provider_rejected'
  | 'payload_invalid'

export type DeliveryRetryCode =
  | 'provider_unavailable'
  | 'provider_rate_limited'
  | 'provider_timeout_before_acceptance'
  | 'network_unreachable_before_request'

const SKIP_CODES = new Set<string>([
  'no_recipient',
  'channel_disabled',
  'consent_denied',
  'transport_off',
  'gdpr_erased',
])
const FAILURE_CODES = new Set<string>([
  'delivery_uncertain',
  'provider_rejected',
  'payload_invalid',
])
const RETRY_CODES = new Set<string>([
  'provider_unavailable',
  'provider_rate_limited',
  'provider_timeout_before_acceptance',
  'network_unreachable_before_request',
])

function closedCode(value: unknown, allowed: Set<string>, fallback: string): string {
  return typeof value === 'string' && allowed.has(value) ? value : fallback
}

function safeProviderRef(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 200) return null
  return /^[A-Za-z0-9._:-]+$/.test(value) ? value : null
}

function safeCostOre(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

function safeCostCurrency(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null
}

function safeParts(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 255
    ? value
    : null
}

export type NotificationDelivery = (
  row: ClaimedNotificationOutboxRow,
) => Promise<NotificationDeliveryResult>

export type OutboxDispatchRun = {
  claimed: number
  sent: number
  simulated: number
  skipped: number
  retried: number
  failed: number
  stale: number
}

function emptyDispatchRun(): OutboxDispatchRun {
  return {
    claimed: 0,
    sent: 0,
    simulated: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    stale: 0,
  }
}

function nextRetryAt(row: ClaimedNotificationOutboxRow, now: Date): string {
  const exponent = Math.max(0, Math.min(row.attempt_count - 1, 7))
  const delayMs = Math.min(30 * 60_000, 15_000 * 2 ** exponent)
  return new Date(now.getTime() + delayMs).toISOString()
}

/**
 * Utan explicit transportadapter claimas ingenting; off-läge får aldrig förbruka
 * attempt_count.
 */
export async function dispatchNotificationOutbox(options: {
  deliver?: NotificationDelivery
  channel?: 'sms'
  outboxId?: string
  limit?: number
  leaseSeconds?: number
  now?: Date
} = {}): Promise<OutboxDispatchRun> {
  if (!options.deliver) return emptyDispatchRun()

  const admin = createServiceClient()
  if (!admin) throw new Error('outbox_service_role_unavailable')

  const now = options.now ?? new Date()
  const leaseToken = crypto.randomUUID()
  let data: unknown
  let error: { message: string } | null
  if (options.outboxId) {
    type ClaimByIdRpc = {
      rpc: (
        name: 'claim_notification_outbox_by_id',
        args: {
          p_id: string
          p_lease_token: string
          p_now: string
          p_lease_seconds: number
        },
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
    const result = await (admin as unknown as ClaimByIdRpc).rpc(
      'claim_notification_outbox_by_id',
      {
        p_id: options.outboxId,
        p_lease_token: leaseToken,
        p_now: now.toISOString(),
        p_lease_seconds: options.leaseSeconds ?? 120,
      },
    )
    data = result.data
    error = result.error
  } else {
    const claimRpc = options.channel === 'sms'
      ? 'claim_sms_notification_outbox'
      : 'claim_notification_outbox'
    const result = await admin.rpc(claimRpc, {
      p_lease_token: leaseToken,
      p_now: now.toISOString(),
      p_lease_seconds: options.leaseSeconds ?? 120,
      p_limit: options.limit ?? 50,
    })
    data = result.data
    error = result.error
  }
  if (error) {
    logger.warn('outbox.claim_failed', { error: error.message })
    throw new Error('outbox_claim_failed')
  }

  const rawRows: unknown[] = Array.isArray(data) ? data : []
  const run = emptyDispatchRun()
  run.claimed = rawRows.length
  const deliver = options.deliver

  const rows: ClaimedNotificationOutboxRow[] = []
  for (const rawRow of rawRows) {
    if (isClaimedOutboxRow(rawRow)) {
      rows.push(rawRow)
      continue
    }

    const identity = claimIdentity(rawRow)
    if (!identity) {
      run.stale += 1
      logger.warn('outbox.claim_invalid', { error: 'claim_identity_invalid' })
      continue
    }
    const { data: failed, error: failError } = await admin.rpc(
      'ack_notification_outbox',
      {
        p_id: identity.id,
        p_lease_token: identity.leaseToken,
        p_status: 'failed',
        p_provider_ref: null,
        p_cost_ore: null,
        p_cost_currency: null,
        p_skip_reason: 'payload_invalid',
        p_parts: null,
      },
    )
    if (failError || !failed) run.stale += 1
    else run.failed += 1
    logger.warn('outbox.claim_invalid', {
      id: identity.id,
      error: failError || !failed ? 'claim_reject_failed' : 'payload_invalid',
    })
  }

  for (const row of rows) {
    // CAS:a raden till ett icke-återclaimbart läge precis före provideranropet.
    // Om en lång batch har tappat sin lease blir detta false och ingen transport
    // sker. Efter true prioriterar vi at-most-once: krasch/ackfel kräver manuell
    // avstämning i stället för att ett kundmeddelande automatiskt skickas igen.
    const { data: started, error: startError } = await admin.rpc(
      'begin_notification_delivery',
      { p_id: row.id, p_lease_token: row.lease_token },
    )
    if (startError || !started) {
      run.stale += 1
      logger.warn('outbox.begin_failed', { id: row.id, error: 'delivery_begin_stale' })
      continue
    }

    let result: NotificationDeliveryResult
    try {
      result = await deliver(row)
    } catch {
      // Ett kast efter transportstart kan betyda att providern accepterade. Det
      // går inte att återkalla anropet: terminalisera för manuell avstämning så
      // automatisk retry aldrig skapar en dublett. Persist/logga bara sluten kod.
      result = { status: 'failed', reason: 'delivery_uncertain' }
    }

    if (result.status === 'retry') {
      const { data: retryStatus, error: retryError } = await admin.rpc(
        'retry_notification_outbox',
        {
          p_id: row.id,
          p_lease_token: row.lease_token,
          p_error: closedCode(result.error, RETRY_CODES, 'delivery_retryable'),
          p_retry_at: nextRetryAt(row, new Date()),
        },
      )
      if (retryError || !retryStatus) run.stale += 1
      else if (retryStatus === 'failed') run.failed += 1
      else run.retried += 1
      continue
    }

    const reason = result.status === 'skipped'
      ? closedCode(result.reason, SKIP_CODES, 'delivery_skipped')
      : result.status === 'failed'
        ? closedCode(result.reason, FAILURE_CODES, 'delivery_failed')
        : null
    const accepted = result.status === 'sent'
      || result.status === 'delivered'
      || result.status === 'simulated'
    const { data: acknowledged, error: ackError } = await admin.rpc(
      'ack_notification_outbox',
      {
        p_id: row.id,
        p_lease_token: row.lease_token,
        p_status: result.status,
        p_provider_ref: accepted && 'providerRef' in result
          ? safeProviderRef(result.providerRef)
          : null,
        p_cost_ore: accepted && 'costOre' in result
          ? safeCostOre(result.costOre)
          : null,
        p_cost_currency: accepted && 'costCurrency' in result
          ? safeCostCurrency(result.costCurrency)
          : null,
        p_parts: accepted && 'parts' in result
          ? safeParts(result.parts)
          : null,
        p_skip_reason: reason,
      },
    )
    if (ackError || !acknowledged) {
      run.stale += 1
      logger.warn('outbox.ack_uncertain', {
        id: row.id,
        outcome: result.status,
        error: 'delivery_ack_failed',
      })
      continue
    }
    if (result.status === 'simulated') run.simulated += 1
    else if (result.status === 'skipped') run.skipped += 1
    else if (result.status === 'failed') run.failed += 1
    else run.sent += 1
  }

  logger.info('outbox.dispatch', run)
  return run
}

/** Dispatch the exact event returned by the atomic verified-booking RPC. */
export async function dispatchNotificationOutboxById(
  outboxId: string,
  deliver: NotificationDelivery,
): Promise<OutboxDispatchRun> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(outboxId)) {
    throw new Error('outbox_id_invalid')
  }
  return dispatchNotificationOutbox({ outboxId, deliver })
}
