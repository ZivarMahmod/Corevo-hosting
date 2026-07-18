import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { getEnabledNotifications } from './settings'
import { queueBookingEvent } from './booking-events'
import { logger } from '@/lib/observability'

// Reminder discovery keeps the 0088 lease. The lease now protects durable event
// production rather than a provider call: one claimed booking creates one stable
// outbox event, then reminded_at prevents another discovery. Delivery/retry lives
// exclusively in notifications_outbox.

export type ReminderRun = { scanned: number; queued: number; skipped: number }

type ReminderRow = {
  id: string
  tenant_id: string
  start_ts: string
}

async function stampReminded(
  client: NonNullable<ReturnType<typeof createServiceClient>>,
  bookingId: string,
  claimToken: string,
  now: Date,
): Promise<void> {
  const patch = {
    reminded_at: now.toISOString(),
    reminder_claim_token: null,
    reminder_claimed_at: null,
  }
  const { data: stamped, error: stampError } = await client
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .eq('reminder_claim_token', claimToken)
    .select('id')
    .maybeSingle()
  if (!stampError && stamped) return

  // The outbox event may already be durable. A token-CAS miss must not leave the
  // booking discoverable forever, so use the existing tokenless idempotent fallback.
  const { data: fallback } = await client
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .is('reminded_at', null)
    .select('id')
    .maybeSingle()
  if (fallback) {
    logger.warn('reminders.stamp_fallback_used', { bookingId })
    return
  }

  const { data: current } = await client
    .from('bookings')
    .select('reminded_at')
    .eq('id', bookingId)
    .maybeSingle()
  if (current?.reminded_at) return
  throw new Error('reminders_stamp_failed')
}

export async function sendDueReminders(): Promise<ReminderRun> {
  const admin = createServiceClient()
  if (!admin) {
    logger.info('reminders.skipped_no_service_role')
    return { scanned: 0, queued: 0, skipped: 0 }
  }
  const client = admin

  const now = new Date()
  const horizon = new Date(now.getTime() + 30 * 60 * 60 * 1000)
  const claimToken = crypto.randomUUID()
  const { data: claimedIds, error: claimError } = await client.rpc(
    'claim_due_booking_reminders',
    {
      p_claim: claimToken,
      p_now: now.toISOString(),
      p_horizon: horizon.toISOString(),
      p_limit: 200,
    },
  )
  if (claimError) {
    logger.warn('reminders.claim_failed', { error: claimError.message })
    throw new Error('reminders_claim_failed')
  }
  if (!claimedIds?.length) return { scanned: 0, queued: 0, skipped: 0 }

  async function releaseClaims(bookingIds: string[]): Promise<void> {
    if (bookingIds.length === 0) return
    const { error: releaseError } = await client
      .from('bookings')
      .update({ reminder_claim_token: null, reminder_claimed_at: null })
      .in('id', bookingIds)
      .eq('reminder_claim_token', claimToken)
    if (releaseError) {
      logger.warn('reminders.release_failed', { bookingIds, error: releaseError.message })
      throw new Error('reminders_release_failed')
    }
  }

  const { data, error } = await client
    .from('bookings')
    .select('id, tenant_id, start_ts')
    .in('id', claimedIds)
    .eq('reminder_claim_token', claimToken)
  if (error) {
    logger.warn('reminders.query_failed', { error: error.message })
    await releaseClaims(claimedIds)
    throw new Error('reminders_query_failed')
  }

  const rows = (data ?? []) as ReminderRow[]
  const pendingClaims = new Set<string>(claimedIds)
  const reminderEnabled = new Map<string, boolean>()
  let queued = 0
  let skipped = 0
  let enqueueFailed = false

  for (const booking of rows) {
    let enabled = reminderEnabled.get(booking.tenant_id)
    if (enabled === undefined) {
      enabled = (await getEnabledNotifications(client, booking.tenant_id)).reminder
      reminderEnabled.set(booking.tenant_id, enabled)
    }
    if (!enabled) {
      skipped += 1
      await releaseClaims([booking.id])
      pendingClaims.delete(booking.id)
      continue
    }

    const result = await queueBookingEvent({
      tenantId: booking.tenant_id,
      bookingId: booking.id,
      type: 'booking_reminder',
      occurredAt: now.toISOString(),
      startISO: booking.start_ts,
      includeManageLink: true,
    })

    if (result.state === 'error') {
      enqueueFailed = true
      await releaseClaims([booking.id])
      pendingClaims.delete(booking.id)
      continue
    }

    await stampReminded(client, booking.id, claimToken, now)
    pendingClaims.delete(booking.id)
    if (result.state === 'queued') queued += 1
    else skipped += 1
  }

  // Any claimed id omitted by the follow-up read must not remain leased.
  await releaseClaims([...pendingClaims])
  if (enqueueFailed) throw new Error('reminders_enqueue_failed')

  const run = { scanned: rows.length, queued, skipped }
  logger.info('reminders.run', run)
  return run
}
