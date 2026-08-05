'use server'

import { createServiceClient } from '@/lib/platform/service'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { verifyCancelToken } from '@/lib/booking/cancel-token'
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
  | { ok: true }
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

  // 2. Load only the identity needed by the canonical database mutation.
  const { data: b } = await admin
    .from('bookings')
    .select('id, tenant_id, customer_id, customer_profile_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b) return { ok: false, reason: 'not_found', message: 'Bokningen hittades inte.' }

  const { data, error } = await admin.rpc('cancel_verified_customer_booking', {
    p_tenant: b.tenant_id,
    p_booking: bookingId,
    p_customer: b.customer_id,
    p_customer_profile: b.customer_profile_id,
  })
  if (error) {
    logger.warn('avboka.cancel_rpc_failed', { bookingId, error: error.message })
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  const result = data?.[0]
  if (!result) return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  if (result.outcome === 'cancelled') return { ok: true }
  if (result.outcome === 'already_cancelled') {
    return { ok: false, reason: 'already_cancelled', message: 'Den här tiden är redan avbokad.' }
  }
  if (result.outcome === 'not_found') {
    return { ok: false, reason: 'not_found', message: 'Bokningen hittades inte.' }
  }
  if (
    result.outcome === 'not_allowed' &&
    (result.booking_status === 'pending' || result.booking_status === 'confirmed')
  ) {
    return { ok: false, reason: 'too_late', message: 'Det är för sent att avboka online — hör av dig direkt.' }
  }
  return { ok: false, reason: 'error', message: 'Bokningen kan inte avbokas.' }
}
