import { describe, it, expect } from 'vitest'
import { monthlyFeeCents, kronorToCents, formatPrice, isBillingModel } from './billing'

describe('monthlyFeeCents', () => {
  it('per_booking = completed × per-booking fee', () => {
    expect(
      monthlyFeeCents({
        billingModel: 'per_booking',
        completedBookings: 12,
        perBookingFeeCents: 500, // 5 kr
        flatMonthlyFeeCents: 99900,
      }),
    ).toBe(6000) // 12 × 500
  })

  it('per_booking with 0 completed = 0', () => {
    expect(
      monthlyFeeCents({
        billingModel: 'per_booking',
        completedBookings: 0,
        perBookingFeeCents: 500,
        flatMonthlyFeeCents: 99900,
      }),
    ).toBe(0)
  })

  it('flat_monthly ignores booking volume', () => {
    expect(
      monthlyFeeCents({
        billingModel: 'flat_monthly',
        completedBookings: 9999,
        perBookingFeeCents: 500,
        flatMonthlyFeeCents: 99900, // 999 kr
      }),
    ).toBe(99900)
  })

  it('unknown model defaults to per_booking', () => {
    expect(
      monthlyFeeCents({
        billingModel: 'garbage',
        completedBookings: 3,
        perBookingFeeCents: 100,
        flatMonthlyFeeCents: 50000,
      }),
    ).toBe(300)
  })

  it('floors negative/fractional inputs to 0 / integers', () => {
    expect(
      monthlyFeeCents({
        billingModel: 'per_booking',
        completedBookings: -5,
        perBookingFeeCents: -10,
        flatMonthlyFeeCents: 0,
      }),
    ).toBe(0)
  })
})

describe('currency helpers', () => {
  it('kronorToCents parses comma + spaces', () => {
    expect(kronorToCents('5,00')).toBe(500)
    expect(kronorToCents('1 234,50')).toBe(123450)
    expect(kronorToCents('')).toBeNull()
    expect(kronorToCents('-3')).toBeNull()
  })
  it('formatPrice renders öre as sv-SE kr', () => {
    // sv-SE uses a non-breaking space as thousands separator.
    expect(formatPrice(99900)).toContain('999')
    expect(formatPrice(null)).toBe('–')
  })
  it('isBillingModel guards the union', () => {
    expect(isBillingModel('per_booking')).toBe(true)
    expect(isBillingModel('flat_monthly')).toBe(true)
    expect(isBillingModel('nope')).toBe(false)
  })
})
