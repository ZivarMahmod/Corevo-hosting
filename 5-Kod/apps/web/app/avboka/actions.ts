'use server'

import { createServiceClient } from '@/lib/platform/service'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { verifyCancelToken } from '@/lib/booking/cancel-token'
import { getCancellationCutoffHours, withinCancellationWindow } from '@/lib/kund/settings'
import {
  queueBookingEvent,
  type BookingNotificationQueueResult,
} from '@/lib/notifications/booking-events'
import { refundBookingPayment } from '@/lib/stripe/refund'
import { logger } from '@/lib/observability'

// Guest self-service CANCEL action (NOTIF-GUEST). The only authorisation is the
// HMAC capability token emailed to the booker — NO login. Every privileged step
// (read booking, set status='cancelled') runs service-role and is gated behind:
//   1. verifyCancelToken(bookingId, token)  — the capability check
//   2. the booking actually exists
//   3. it is not already cancelled
//   4. it is still inside the tenant's cancellation window
// Any failure returns a typed result; we never cancel without a valid token, and we
// never reveal another tenant's/booker's booking (the token binds to ONE id).

export type CancelResult =
  | { ok: true; notification: BookingNotificationQueueResult }
  | { ok: false; reason: 'invalid_token' | 'not_found' | 'already_cancelled' | 'too_late' | 'error'; message: string }

export async function cancelByToken(bookingId: string, token: string): Promise<CancelResult> {
  // Plan 009 SÄK-06: snål gräns per IP FÖRE token-verifieringen — bromsar
  // brute force mot HMAC-token och massavbokningsförsök. Publikt anrop utan
  // tenant-kontext, så hinken är per IP.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('avboka', ip), LIMITS.kontakt))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }
  // 1. Capability check FIRST — before any DB access.
  if (!bookingId || !(await verifyCancelToken(bookingId, token))) {
    return { ok: false, reason: 'invalid_token', message: 'Ogiltig eller utgången länk.' }
  }

  const admin = createServiceClient()
  if (!admin) {
    // No service role (local/dev) — can't cancel. Fail safe, not silently "ok".
    return { ok: false, reason: 'error', message: 'Avbokning är inte tillgänglig just nu.' }
  }

  // 2. Load the booking (service-role; token already proved the capability).
  const { data: b } = await admin
    .from('bookings')
    .select('id, tenant_id, status, start_ts')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b) return { ok: false, reason: 'not_found', message: 'Bokningen hittades inte.' }

  // 3. Only active bookings can be cancelled.
  if (b.status === 'cancelled') {
    return { ok: false, reason: 'already_cancelled', message: 'Den här tiden är redan avbokad.' }
  }
  if (b.status !== 'pending' && b.status !== 'confirmed') {
    return { ok: false, reason: 'error', message: 'Bokningen kan inte avbokas.' }
  }

  // 4. Re-check the cancellation window (the page may have been open a while).
  const cutoff = await getCancellationCutoffHours(admin, b.tenant_id)
  if (!withinCancellationWindow(b.start_ts, cutoff)) {
    return { ok: false, reason: 'too_late', message: 'Det är för sent att avboka online — hör av dig direkt.' }
  }

  // Set status='cancelled' (service-role). Guard on status so a concurrent cancel
  // (e.g. staff in the back-office) doesn't double-fire the notification below.
  const cancelledAt = new Date().toISOString()
  const { data: updated, error } = await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: cancelledAt, cancelled_by: 'customer' })
    .eq('id', bookingId)
    .eq('tenant_id', b.tenant_id)
    .in('status', ['pending', 'confirmed'])
    .select('id')
    .maybeSingle()
  if (error) {
    logger.warn('avboka.cancel_update_failed', { bookingId, error: error.message })
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  if (!updated) {
    // Someone else cancelled between our read and write — treat as already done.
    return { ok: false, reason: 'already_cancelled', message: 'Den här tiden är redan avbokad.' }
  }

  // Refund a paid booking on guest self-service cancel (parity with kund/personal).
  await refundBookingPayment(bookingId, b.tenant_id)

  const notification = await queueBookingEvent({
    tenantId: b.tenant_id,
    bookingId,
    type: 'booking_cancelled',
    occurredAt: cancelledAt,
    startISO: b.start_ts,
  })

  return { ok: true, notification }
}
