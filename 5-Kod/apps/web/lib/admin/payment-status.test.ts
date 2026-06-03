import { describe, it, expect } from 'vitest'
import { normalisePaymentStatus } from './data'

// Pins the booking payment-status normalisation (goal-17 M6 §3.2 drawer badge).
// A booking MAY have no payment row (null), and a defensive read must collapse any
// unexpected raw value to null so the drawer never renders a phantom "Betald"/
// "Väntar" badge. These tests lock that: only the three known Stripe-mirrored
// states pass through; everything else is the honest no-badge state.

describe('normalisePaymentStatus', () => {
  it('passes through the three known states verbatim', () => {
    expect(normalisePaymentStatus('pending')).toBe('pending')
    expect(normalisePaymentStatus('succeeded')).toBe('succeeded')
    expect(normalisePaymentStatus('failed')).toBe('failed')
  })

  it('collapses null/undefined to null (no payment row → no badge)', () => {
    expect(normalisePaymentStatus(null)).toBeNull()
    expect(normalisePaymentStatus(undefined)).toBeNull()
  })

  it('collapses any unknown raw value to null (never a phantom badge)', () => {
    expect(normalisePaymentStatus('')).toBeNull()
    expect(normalisePaymentStatus('refunded')).toBeNull()
    expect(normalisePaymentStatus('SUCCEEDED')).toBeNull() // case-sensitive by design
    expect(normalisePaymentStatus('paid')).toBeNull()
  })
})
