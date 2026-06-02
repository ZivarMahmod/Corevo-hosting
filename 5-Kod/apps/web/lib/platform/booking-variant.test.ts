import { describe, it, expect } from 'vitest'
import {
  isBookingVariant,
  readBookingVariant,
  readBookingMode,
  DEFAULT_BOOKING_VARIANT,
} from './booking-variant'

describe('isBookingVariant', () => {
  it('accepts the known variants', () => {
    expect(isBookingVariant('3')).toBe(true)
    expect(isBookingVariant('4')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isBookingVariant('5')).toBe(false)
    expect(isBookingVariant(3)).toBe(false)
    expect(isBookingVariant('')).toBe(false)
    expect(isBookingVariant(null)).toBe(false)
    expect(isBookingVariant(undefined)).toBe(false)
  })
})

describe('readBookingVariant (M3-facing contract)', () => {
  it('reads settings.booking.variant when valid', () => {
    expect(readBookingVariant({ booking: { variant: '4' } })).toBe('4')
    expect(readBookingVariant({ booking: { variant: '3' } })).toBe('3')
  })

  it('falls back to default for missing/legacy/unknown', () => {
    expect(readBookingVariant({})).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant(null)).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant(undefined)).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: {} })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: { variant: '9' } })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: 'nope' })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant('not-an-object')).toBe(DEFAULT_BOOKING_VARIANT)
  })

  it('ignores unrelated settings keys (does not confuse layout variant)', () => {
    // settings.layout.{nav,hero}_variant is the LAYOUT template, NOT the booking flow.
    expect(
      readBookingVariant({ layout: { nav_variant: 'B', hero_variant: '2' } }),
    ).toBe(DEFAULT_BOOKING_VARIANT)
  })

  it('default is variant 3', () => {
    expect(DEFAULT_BOOKING_VARIANT).toBe('3')
  })
})

describe('readBookingMode (M3 storefront seam: variant → BookingWizard mode)', () => {
  it("maps variant '4' → 'compact'", () => {
    expect(readBookingMode({ booking: { variant: '4' } })).toBe('compact')
  })
  it("maps variant '3' → 'wizard'", () => {
    expect(readBookingMode({ booking: { variant: '3' } })).toBe('wizard')
  })
  it("unset/legacy/unknown → 'wizard' (Variant 3 = today's default flow)", () => {
    expect(readBookingMode(null)).toBe('wizard')
    expect(readBookingMode(undefined)).toBe('wizard')
    expect(readBookingMode({})).toBe('wizard')
    expect(readBookingMode({ booking: {} })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: '9' } })).toBe('wizard')
    expect(readBookingMode('not-an-object')).toBe('wizard')
  })
})
