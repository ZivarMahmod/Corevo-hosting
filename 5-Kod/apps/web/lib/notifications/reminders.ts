import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { sendBookingReminder, parseGuestEmail } from './booking'
import { sendSms, parseGuestPhone } from './sms'
import { getEnabledNotifications, getSmsEnabled } from './settings'
import { logger } from '@/lib/observability'

// Reminder pipeline (G10 step 3). Sends a "din tid imorgon"-mail for LIVE bookings
// (pending OR confirmed — on-site "betala på plats" bookings stay `pending` until
// staff confirm them, so a confirmed-only filter would silently skip them) starting
// within the next ~30h, then stamps bookings.reminded_at so the next run can't
// double-send (idempotent).
//
// Driven by an EXTERNAL scheduler (Cloudflare Cron Trigger → app/api/cron/reminders,
// or pg_cron) — Workers have no in-process timers. Runs service-role (cross-tenant,
// reads guest email from the note seam / the customer's users row). Best-effort:
// one bad row never aborts the batch. Needs SUPABASE_SERVICE_ROLE_KEY + the email
// relay (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET) in prod; degrades to a no-op locally.

export type ReminderRun = { scanned: number; sent: number; skipped: number }

type ReminderRow = {
  id: string
  tenant_id: string
  start_ts: string
  note: string | null
  customer_profile_id: string | null
  services: { name?: string } | null
  tenants: { name?: string } | null
  locations: { timezone?: string } | null
}

// Short Swedish reminder SMS — plain text, no links/PII.
function reminderSmsBody(tenantName: string, serviceName: string, startISO: string, timeZone: string): string {
  let when = startISO
  try {
    when = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(startISO))
  } catch {
    /* fall back to the raw ISO string */
  }
  return `Påminnelse från ${tenantName}: ${serviceName} ${when}. Vi ses!`
}

export async function sendDueReminders(): Promise<ReminderRun> {
  const admin = createServiceClient()
  if (!admin) {
    logger.info('reminders.skipped (no service role)')
    return { scanned: 0, sent: 0, skipped: 0 }
  }
  const client = admin

  const now = new Date()
  // 30h-horisont (Zivar 2026-07-10): påminnelsen ska gå ut ~30 timmar innan
  // tiden. Cron går var 15:e min → mailet landar när bokningen passerar 30h-
  // gränsen (bokningar närmare än så vid bokningstillfället påminns direkt).
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
  if (!claimedIds?.length) return { scanned: 0, sent: 0, skipped: 0 }

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
    .select('id, tenant_id, start_ts, note, customer_profile_id, services(name), tenants(name), locations(timezone)')
    .in('id', claimedIds)
    .eq('reminder_claim_token', claimToken)

  if (error) {
    logger.warn('reminders.query_failed', { error: error.message })
    await releaseClaims(claimedIds)
    throw new Error('reminders_query_failed')
  }
  const rows = (data ?? []) as unknown as ReminderRow[]
  const pendingClaims = new Set<string>(claimedIds)

  // Per-tenant preference caches (the batch can span tenants; each lookup hits
  // tenant_settings, so memoise to avoid N reads of the same row).
  const reminderEnabled = new Map<string, boolean>()
  const smsEnabled = new Map<string, boolean>()

  let sent = 0
  let skipped = 0
  let currentBookingId: string | null = null
  let preserveCurrentClaim = false
  try {
    for (const b of rows) {
      currentBookingId = b.id
      preserveCurrentClaim = false
    // Owner pref: skip the whole reminder for this tenant when reminders are off.
      let enabled = reminderEnabled.get(b.tenant_id)
      if (enabled === undefined) {
        enabled = (await getEnabledNotifications(client, b.tenant_id)).reminder
        reminderEnabled.set(b.tenant_id, enabled)
      }
      if (!enabled) {
      // Do NOT stamp: "skip" means skip THIS send, not permanently. If the owner
      // re-enables reminders before the appointment, the row is still unstamped and
      // gets reminded on the next run. Re-scanning is cheap (prefs are memoised).
        skipped++
        await releaseClaims([b.id])
        pendingClaims.delete(b.id)
        currentBookingId = null
        continue
      }

      let to = parseGuestEmail(b.note)
      let phone = parseGuestPhone(b.note)
      if ((!to || !phone) && b.customer_profile_id) {
        const { data: u, error: userError } = await client
          .from('users')
          .select('email, phone')
          .eq('id', b.customer_profile_id)
          .maybeSingle()
        if (userError) throw new Error('reminders_customer_lookup_failed')
        to = to ?? u?.email ?? null
        phone = phone ?? u?.phone ?? null
      }
      if (!to) {
        skipped++
        await releaseClaims([b.id])
        pendingClaims.delete(b.id)
        currentBookingId = null
        continue
      }
      const tenantName = b.tenants?.name ?? 'Företaget'
      const serviceName = b.services?.name ?? 'Behandling'
      const timeZone = b.locations?.timezone ?? 'Europe/Stockholm'
      // Från och med transportanropet kan ett kast betyda att leverantören tog emot
      // mailet. Behåll då just denna lease för att undvika en omedelbar dublett.
      preserveCurrentClaim = true
      const emailResult = await sendBookingReminder(
        to,
        { tenantName, serviceName, startISO: b.start_ts, timeZone },
        { supabase: client, tenantId: b.tenant_id },
      )
      if (!emailResult.ok) {
        preserveCurrentClaim = false
        skipped++
        await releaseClaims([b.id])
        pendingClaims.delete(b.id)
        currentBookingId = null
        continue
      }

    // Best-effort opt-in SMS (secondary channel; email above is primary).
      if (phone) {
        let sms = smsEnabled.get(b.tenant_id)
        if (sms === undefined) {
          sms = await getSmsEnabled(client, b.tenant_id)
          smsEnabled.set(b.tenant_id, sms)
        }
        if (sms) {
          try {
            await sendSms({ to: phone, body: reminderSmsBody(tenantName, serviceName, b.start_ts, timeZone) })
          } catch {
            // SMS is best-effort — never abort the batch on a send error.
          }
        }
      }

      // Bara claim-ägaren får finalisera raden. Överlappande körningar får aldrig
      // samma token och kan därför inte dubbelstämpla eller dubbelskicka.
      const { data: stamped, error: stampError } = await client
        .from('bookings')
        .update({
          reminded_at: now.toISOString(),
          reminder_claim_token: null,
          reminder_claimed_at: null,
        })
        .eq('id', b.id)
        .eq('reminder_claim_token', claimToken)
        .select('id')
        .maybeSingle()
      if (stampError || !stamped) throw new Error('reminders_stamp_failed')
      pendingClaims.delete(b.id)
      currentBookingId = null
      preserveCurrentClaim = false
      sent++
    }
  } catch (error) {
    const safeToRelease = [...pendingClaims].filter(
      (id) => !(preserveCurrentClaim && id === currentBookingId),
    )
    await releaseClaims(safeToRelease)
    throw error
  }

  // Defensive: a claimed id omitted by the follow-up query must not remain leased.
  await releaseClaims([...pendingClaims])

  logger.info('reminders.run', { scanned: rows.length, sent, skipped })
  return { scanned: rows.length, sent, skipped }
}
