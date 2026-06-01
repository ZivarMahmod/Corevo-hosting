import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { sendBookingReminder, parseGuestEmail } from './booking'
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

  let sent = 0
  let skipped = 0
  for (const b of rows) {
    let to = parseGuestEmail(b.note)
    if (!to && b.customer_profile_id) {
      const { data: u } = await admin.from('users').select('email').eq('id', b.customer_profile_id).maybeSingle()
      to = u?.email ?? null
    }
    if (!to) {
      skipped++
      continue
    }
    await sendBookingReminder(to, {
      tenantName: b.tenants?.name ?? 'Salongen',
      serviceName: b.services?.name ?? 'Behandling',
      startISO: b.start_ts,
      timeZone: b.locations?.timezone ?? 'Europe/Stockholm',
    })
    // Stamp regardless of transport result — degrade means "don't retry forever".
    await admin.from('bookings').update({ reminded_at: now.toISOString() }).eq('id', b.id)
    sent++
  }

  logger.info('reminders.run', { scanned: rows.length, sent, skipped })
  return { scanned: rows.length, sent, skipped }
}
