import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { sendBookingReminder, parseGuestEmail } from './booking'
import { sendSms, parseGuestPhone } from './sms'
import { getEnabledNotifications, getSmsEnabled } from './settings'
import { logger } from '@/lib/observability'

// Reminder pipeline (G10 step 3). Sends a "din tid imorgon"-mail for LIVE bookings
// (pending OR confirmed — on-site "betala på plats" bookings stay `pending` until
// staff confirm them, so a confirmed-only filter would silently skip them) starting
// within the next ~24h, then stamps bookings.reminded_at so the next run can't
// double-send (idempotent).
//
// Driven by an EXTERNAL scheduler (Cloudflare Cron Trigger → app/api/cron/reminders,
// or pg_cron) — Workers have no in-process timers. Runs service-role (cross-tenant,
// reads guest email from the note seam / the customer's users row). Best-effort:
// one bad row never aborts the batch. Needs SUPABASE_SERVICE_ROLE_KEY + RESEND_API_KEY
// in prod; degrades to a no-op locally.

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

  const now = new Date()
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { data, error } = await admin
    .from('bookings')
    .select('id, tenant_id, start_ts, note, customer_profile_id, services(name), tenants(name), locations(timezone)')
    .in('status', ['pending', 'confirmed'])
    .is('reminded_at', null)
    .gt('start_ts', now.toISOString())
    .lte('start_ts', horizon.toISOString())
    .limit(200)

  if (error) {
    logger.warn('reminders.query_failed', { error: error.message })
    return { scanned: 0, sent: 0, skipped: 0 }
  }
  const rows = (data ?? []) as unknown as ReminderRow[]

  // Per-tenant preference caches (the batch can span tenants; each lookup hits
  // tenant_settings, so memoise to avoid N reads of the same row).
  const reminderEnabled = new Map<string, boolean>()
  const smsEnabled = new Map<string, boolean>()

  let sent = 0
  let skipped = 0
  for (const b of rows) {
    // Owner pref: skip the whole reminder for this tenant when reminders are off.
    let enabled = reminderEnabled.get(b.tenant_id)
    if (enabled === undefined) {
      enabled = (await getEnabledNotifications(admin, b.tenant_id)).reminder
      reminderEnabled.set(b.tenant_id, enabled)
    }
    if (!enabled) {
      // Do NOT stamp: "skip" means skip THIS send, not permanently. If the owner
      // re-enables reminders before the appointment, the row is still unstamped and
      // gets reminded on the next run. Re-scanning is cheap (prefs are memoised).
      skipped++
      continue
    }

    let to = parseGuestEmail(b.note)
    let phone = parseGuestPhone(b.note)
    if ((!to || !phone) && b.customer_profile_id) {
      const { data: u } = await admin
        .from('users')
        .select('email, phone')
        .eq('id', b.customer_profile_id)
        .maybeSingle()
      to = to ?? u?.email ?? null
      phone = phone ?? u?.phone ?? null
    }
    if (!to) {
      skipped++
      continue
    }
    const tenantName = b.tenants?.name ?? 'Salongen'
    const serviceName = b.services?.name ?? 'Behandling'
    const timeZone = b.locations?.timezone ?? 'Europe/Stockholm'
    await sendBookingReminder(
      to,
      { tenantName, serviceName, startISO: b.start_ts, timeZone },
      { supabase: admin, tenantId: b.tenant_id },
    )

    // Best-effort opt-in SMS (secondary channel; email above is primary).
    if (phone) {
      let sms = smsEnabled.get(b.tenant_id)
      if (sms === undefined) {
        sms = await getSmsEnabled(admin, b.tenant_id)
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

    // Stamp regardless of transport result — degrade means "don't retry forever".
    await admin.from('bookings').update({ reminded_at: now.toISOString() }).eq('id', b.id)
    sent++
  }

  logger.info('reminders.run', { scanned: rows.length, sent, skipped })
  return { scanned: rows.length, sent, skipped }
}
