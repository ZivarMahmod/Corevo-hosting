import { describe, it, expect } from 'vitest'
import { decideCarryAction, type PaymentRow } from './rebook-payment'

// Contract test for "flytt av betald bokning" (M8 §2.3): the payment FOLLOWS the
// booking to its new time — no refund, no recharge. carryBookingPayment is a thin
// server-only IO wrapper (untested, like refund.ts); the load-bearing logic is the
// pure decideCarryAction, tested here as the contract. No live Stripe, no Supabase.
describe('decideCarryAction (rebook payment carry, M8 §2.3)', () => {
  const succeeded: PaymentRow = { status: 'succeeded', stripe_payment_intent_id: 'pi_123' }

  it('carries a succeeded payment (move row old→new + confirm new booking)', () => {
    expect(decideCarryAction(succeeded)).toBe('carry')
  })

  it('no-ops when there is NO payment row (salong utan betalning oförändrad)', () => {
    expect(decideCarryAction(null)).toBe('none')
  })

  it('does NOT carry a pending/in-flight checkout (its succeeded-webhook still targets oldId)', () => {
    // The §2.1 silent-bug guard: carrying pending would orphan the incoming
    // payment_intent.succeeded (metadata.booking_id = oldId) AND confirm a cancelled
    // old booking. Skip → unchanged from today's behaviour (no regression).
    expect(decideCarryAction({ status: 'pending', stripe_payment_intent_id: null })).toBe('skip')
  })

  it('does NOT carry a failed payment (nothing was captured)', () => {
    expect(decideCarryAction({ status: 'failed', stripe_payment_intent_id: 'pi_x' })).toBe('skip')
  })

  it('does NOT carry an already-refunded payment (money already returned)', () => {
    expect(decideCarryAction({ status: 'refunded', stripe_payment_intent_id: 'pi_x' })).toBe('skip')
  })

  it('only succeeded triggers a carry — every other status is non-destructive', () => {
    for (const status of ['pending', 'failed', 'refunded', 'unknown', '']) {
      expect(decideCarryAction({ status, stripe_payment_intent_id: 'pi' })).not.toBe('carry')
    }
  })
})
