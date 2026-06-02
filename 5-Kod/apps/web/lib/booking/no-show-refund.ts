// No-show-refund — DORMANT (M8 §2.4). Pure + dependency-free (exactly like
// holds.ts / payment-gate.ts): no DB, no Supabase, no Stripe, no `server-only`, so
// vitest can load it and importing it changes NO behaviour.
//
// ⛔ NOT WIRED ANYWHERE ON PURPOSE. M8 §2.4: "byggs men aktiveras inte nu — kommer
// när Zivar vet hur Stripe tar sin del vid refund. Får inte skapa problem i
// bokningsflödet idag." So this is the DECISION ONLY. It is deliberately NOT called
// from lib/personal/actions.ts setBookingStatus' `no_show` branch — marking a
// no-show today must keep doing exactly what it does (free the slot), with zero
// payment side-effect. When Zivar activates: read the per-salong policy (a future
// settings flag — NOT migration 0013/0014, both frozen) and call decideNoShowRefund
// at the no_show transition, then route 'refund' → refundBookingPayment.
//
// Policy is a PARAM, never a hard-coded column here, precisely so activation needs
// no schema change while the migrations are frozen.

/**
 * Per-salong no-show policy when a booking was PRE-PAID online (M8 §2.4):
 *   · 'keep_as_fee' — keep the captured charge as a no-show fee (no refund);
 *   · 'refund'      — refund the customer despite the no-show.
 * Default at the call site (when activated) should be the salong's stored choice;
 * with no choice the safe inert default is 'keep_as_fee' (do nothing to the money).
 */
export type NoShowPolicy = 'keep_as_fee' | 'refund'

/** What the (future) no-show transition should do with the money. */
export type NoShowRefundAction = 'refund' | 'keep'

/**
 * PURE decision: given the salong's no-show policy and the booking's payment status,
 * decide whether a no-show should refund or keep the money. Only a SUCCEEDED payment
 * under a 'refund' policy yields a refund — everything else keeps (nothing captured,
 * already refunded, or the salong chose to keep it as a fee).
 *
 * Returns 'keep' for a null/absent payment (no online charge → nothing to act on),
 * which is also why activating this can never affect salonger utan Stripe.
 */
export function decideNoShowRefund(
  policy: NoShowPolicy,
  paymentStatus: string | null | undefined,
): NoShowRefundAction {
  if (policy !== 'refund') return 'keep'
  if (paymentStatus !== 'succeeded') return 'keep'
  return 'refund'
}
