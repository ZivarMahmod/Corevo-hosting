import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { captureException } from '@/lib/observability'

// Flytt av BETALD bokning (M8 §2.3): "betalningen följer med till ny tid, ingen
// refund-rundgång". The customer rebook path (lib/kund/actions.ts) creates a NEW
// booking row (newId) for race-safety and then cancels the OLD one — so the single
// payments row (UNIQUE(booking_id), keyed to oldId) is left stranded on a cancelled
// booking unless we MOVE it. We re-point the row old→new instead of refund+recharge
// (forbidden by §2.3) and instead of an in-place start_ts UPDATE (the customer path
// is deliberately create-new-then-cancel-old; we don't rewrite that).
//
// Why this is Stripe-call-free: a DIRECT-charge PaymentIntent is already captured on
// the salong's connected account; moving the booking does not change the money. The
// PI metadata (booking_id=oldId) goes stale but stays BENIGN — for a succeeded
// payment the only remaining lifecycle event is charge.refunded, and the webhook
// resolves that by stripe_payment_intent_id (PI-keyed → survives the re-point), not
// by metadata. So no live PI-metadata update, no new charge.
//
// SCOPED TO 'succeeded' on purpose (safety boundary, see decideCarryAction): an
// in-flight/pending checkout must NOT be carried — its payment_intent.succeeded will
// still arrive with metadata.booking_id=oldId and would (a) miss the re-pointed row
// and (b) try to confirm the now-cancelled old booking → the §2.1 silent-bug family.
// The pre-existing rebook flow does not handle mid-checkout rebooks either, so
// skipping pending here is no regression.

export type PaymentRow = { status: string; stripe_payment_intent_id: string | null }

/**
 * PURE contract decision — given the old booking's payment row (or null when none
 * exists), decide what the rebook carry must do. No IO, no Stripe, no Supabase, so
 * it unit-tests as "the contract" (mirrors payment-gate / holds being pure).
 *
 *  · null / no payment row              → 'none'  (salong utan betalning: no-op)
 *  · status !== 'succeeded'             → 'skip'  (pending/failed/refunded: don't move)
 *  · status === 'succeeded'            → 'carry' (move payment row old→new + confirm)
 *
 * 'carry' implies BOTH: re-point payments.booking_id old→new AND flip the new
 * booking pending→confirmed — because the succeeded-webhook (which normally does the
 * confirm) already fired on oldId and will never fire for newId.
 */
export type CarryAction = 'none' | 'skip' | 'carry'

export function decideCarryAction(payment: PaymentRow | null): CarryAction {
  if (!payment) return 'none'
  if (payment.status !== 'succeeded') return 'skip'
  return 'carry'
}

/**
 * Server-only IO wrapper (untested, like refundBookingPayment): moves a succeeded
 * payment from the old booking to the new one and confirms the new booking. Best-
 * effort + fully fenced:
 *   · service-role (payments writes are RLS-invisible to the kund client);
 *   · tenant-id re-asserted in every WHERE (booking ids come from app state, but we
 *     never trust them to cross a tenant boundary);
 *   · no payment row / no Stripe-account-needed → clean no-op (salonger utan Stripe
 *     opåverkade — there's simply nothing to move);
 *   · MUST be called only AFTER the old booking is result-confirmed released
 *     (lib/kund/actions.ts step 2). If carry ran before release and release then
 *     failed, rollback cancels newId and would strand the payment on it.
 */
export async function carryBookingPayment(
  oldBookingId: string,
  newBookingId: string,
  tenantId: string,
): Promise<void> {
  if (!oldBookingId || !newBookingId || !tenantId) return
  const admin = createServiceClient()
  if (!admin) return // ingen service-role → inget att flytta (degrade, som refund.ts)

  try {
    const { data: payment } = await admin
      .from('payments')
      .select('status, stripe_payment_intent_id')
      .eq('booking_id', oldBookingId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (decideCarryAction(payment) !== 'carry') return

    // Re-point the single payments row old→new. UNIQUE(booking_id) is free: the new
    // booking has no payment row yet. tenant-fenced.
    await admin
      .from('payments')
      .update({ booking_id: newBookingId })
      .eq('booking_id', oldBookingId)
      .eq('tenant_id', tenantId)

    // The succeeded-webhook already fired on oldId, so newId is still 'pending'
    // (create_public_booking inserts pending). Flip it to confirmed so the carried
    // payment isn't a paid-but-pending booking. Only from pending → never touch a
    // status someone else changed.
    await admin
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', newBookingId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
  } catch (e) {
    // Best-effort: a carry hiccup must not fail the rebook the customer just made
    // (the new slot is already secured + old released). Surface for ops.
    await captureException(e, { where: 'rebook.carryPayment', oldBookingId, newBookingId })
  }
}
