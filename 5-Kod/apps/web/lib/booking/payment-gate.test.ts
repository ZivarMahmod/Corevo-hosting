import { describe, it, expect } from 'vitest'
import { paymentGateFromFlags } from './payment-gate'

// The G09 charge-gate invariant (DoD): online betalning vid bokning kräver BÅDA
// payments_enabled (salongens master-toggle) OCH charges_enabled (Connect redo).
// Detta är den ENDA gaten — payment_mode ingår medvetet inte.
describe('paymentGateFromFlags', () => {
  it('does not take online when the reviewed booking-payment release is absent', () => {
    expect(paymentGateFromFlags(true, true).canTakeOnline).toBe(false)
  })

  it('takes online only when both account flags and the reviewed release are true', () => {
    expect(paymentGateFromFlags(true, true, true).canTakeOnline).toBe(true)
  })

  it('does not take online when payments_enabled is off', () => {
    expect(paymentGateFromFlags(false, true).canTakeOnline).toBe(false)
  })

  it('does not take online when charges_enabled is off (onboarding-gate)', () => {
    expect(paymentGateFromFlags(true, false).canTakeOnline).toBe(false)
  })

  it('is off by default (both false) → oförändrat flöde', () => {
    expect(paymentGateFromFlags(false, false).canTakeOnline).toBe(false)
  })

  it('echoes the raw flags', () => {
    const g = paymentGateFromFlags(true, false, true)
    expect(g.paymentsEnabled).toBe(true)
    expect(g.chargesEnabled).toBe(false)
  })
})
