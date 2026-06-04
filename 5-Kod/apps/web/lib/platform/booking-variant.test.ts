import { describe, it, expect } from 'vitest'
import {
  isBookingVariant,
  readBookingVariant,
  readBookingMode,
  DEFAULT_BOOKING_VARIANT,
} from './booking-variant'

describe('isBookingVariant', () => {
  it('accepts the four design variants', () => {
    expect(isBookingVariant('wizard')).toBe(true)
    expect(isBookingVariant('compact')).toBe(true)
    expect(isBookingVariant('drawer')).toBe(true)
    expect(isBookingVariant('inline')).toBe(true)
  })
  it('rejects legacy numeric ids and anything else (legacy is mapped, not a valid id)', () => {
    expect(isBookingVariant('3')).toBe(false)
    expect(isBookingVariant('4')).toBe(false)
    expect(isBookingVariant('5')).toBe(false)
    expect(isBookingVariant(3)).toBe(false)
    expect(isBookingVariant('')).toBe(false)
    expect(isBookingVariant(null)).toBe(false)
    expect(isBookingVariant(undefined)).toBe(false)
  })
})

describe('readBookingVariant (M3-facing contract)', () => {
  it('reads settings.booking.variant when a valid design id', () => {
    expect(readBookingVariant({ booking: { variant: 'wizard' } })).toBe('wizard')
    expect(readBookingVariant({ booking: { variant: 'compact' } })).toBe('compact')
    expect(readBookingVariant({ booking: { variant: 'drawer' } })).toBe('drawer')
    expect(readBookingVariant({ booking: { variant: 'inline' } })).toBe('inline')
  })

  it('maps legacy numeric ids FORWARD so existing tenants never break', () => {
    expect(readBookingVariant({ booking: { variant: '3' } })).toBe('wizard')
    expect(readBookingVariant({ booking: { variant: '4' } })).toBe('compact')
  })

  it('falls back to default for missing/unknown', () => {
    expect(readBookingVariant({})).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant(null)).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant(undefined)).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: {} })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: { variant: '9' } })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant({ booking: 'nope' })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(readBookingVariant('not-an-object')).toBe(DEFAULT_BOOKING_VARIANT)
  })

  it('ignores unrelated settings keys (does not confuse the theme/layout)', () => {
    // settings.theme is the storefront LOOK, NOT the booking flow.
    expect(readBookingVariant({ theme: 'salvia' })).toBe(DEFAULT_BOOKING_VARIANT)
    expect(
      readBookingVariant({ layout: { nav_variant: 'B', hero_variant: '2' } }),
    ).toBe(DEFAULT_BOOKING_VARIANT)
  })

  it("default is 'wizard'", () => {
    expect(DEFAULT_BOOKING_VARIANT).toBe('wizard')
  })
})

describe('readBookingMode (M3 storefront seam: variant → BookingWizard mode)', () => {
  it("maps 'compact' → 'compact'", () => {
    expect(readBookingMode({ booking: { variant: 'compact' } })).toBe('compact')
    // legacy '4' is forward-mapped to compact, so the mode is unchanged for old rows.
    expect(readBookingMode({ booking: { variant: '4' } })).toBe('compact')
  })
  it("maps wizard/drawer/inline → 'wizard' (drawer/inline presentation deferred)", () => {
    expect(readBookingMode({ booking: { variant: 'wizard' } })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: 'drawer' } })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: 'inline' } })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: '3' } })).toBe('wizard') // legacy guided
  })
  it("unset/unknown → 'wizard' (today's default flow)", () => {
    expect(readBookingMode(null)).toBe('wizard')
    expect(readBookingMode(undefined)).toBe('wizard')
    expect(readBookingMode({})).toBe('wizard')
    expect(readBookingMode({ booking: {} })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: '9' } })).toBe('wizard')
    expect(readBookingMode('not-an-object')).toBe('wizard')
  })
})
