import { describe, it, expect } from 'vitest'
import * as bookingVariantModule from './booking-variant'
import {
  isBookingVariant,
  readBookingVariant,
  readBookingMode,
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
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

describe('BOOKING_VARIANT_LABELS (#17 — the platform "Variant" column label)', () => {
  it('maps all four canonical ids to a distinct label', () => {
    expect(BOOKING_VARIANT_LABELS.wizard).toBe('Steg-för-steg')
    expect(BOOKING_VARIANT_LABELS.compact).toBe('Snabbboka')
    expect(BOOKING_VARIANT_LABELS.drawer).toBe('Drawer')
    expect(BOOKING_VARIANT_LABELS.inline).toBe('Inline-sektion')
  })

  it('has a label for every variant (no missing key vs the legacy 2-value map)', () => {
    for (const v of BOOKING_VARIANTS) {
      expect(typeof BOOKING_VARIANT_LABELS[v]).toBe('string')
      expect(BOOKING_VARIANT_LABELS[v].length).toBeGreaterThan(0)
    }
  })

  it('resolves the right label end-to-end via readBookingVariant (drawer ≠ wizard)', () => {
    // The exact #17 bug: a tenant on 'drawer'/'inline' used to collapse to the
    // wizard/compact label. Through the canonical resolver each is distinct now.
    expect(BOOKING_VARIANT_LABELS[readBookingVariant({ booking: { variant: 'drawer' } })]).toBe(
      'Drawer',
    )
    expect(BOOKING_VARIANT_LABELS[readBookingVariant({ booking: { variant: 'inline' } })]).toBe(
      'Inline-sektion',
    )
    // legacy numeric ids still forward-map to the right label.
    expect(BOOKING_VARIANT_LABELS[readBookingVariant({ booking: { variant: '3' } })]).toBe(
      'Steg-för-steg',
    )
    expect(BOOKING_VARIANT_LABELS[readBookingVariant({ booking: { variant: '4' } })]).toBe(
      'Snabbboka',
    )
  })
})

describe('readBookingMode (M3 storefront seam: variant → BookingWizard mode)', () => {
  it("maps compact/inline → 'compact' (single-screen content)", () => {
    expect(readBookingMode({ booking: { variant: 'compact' } })).toBe('compact')
    expect(readBookingMode({ booking: { variant: 'inline' } })).toBe('compact')
    // legacy '4' is forward-mapped to compact, so the mode is unchanged for old rows.
    expect(readBookingMode({ booking: { variant: '4' } })).toBe('compact')
  })
  it("maps wizard/drawer → 'wizard' (guided steps; presentation handled by BookingProvider)", () => {
    expect(readBookingMode({ booking: { variant: 'wizard' } })).toBe('wizard')
    expect(readBookingMode({ booking: { variant: 'drawer' } })).toBe('wizard')
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

describe('booking verification channel policy', () => {
  it('accepts three modes and defaults old tenants to SMS with e-mail fallback', () => {
    const isBookingVerificationMode = bookingVariantModule.isBookingVerificationMode
    const readBookingVerificationMode = bookingVariantModule.readBookingVerificationMode
    expect(isBookingVerificationMode).toBeTypeOf('function')
    expect(readBookingVerificationMode).toBeTypeOf('function')
    if (!isBookingVerificationMode || !readBookingVerificationMode) return

    expect(isBookingVerificationMode('sms_only')).toBe(true)
    expect(isBookingVerificationMode('sms_with_email_fallback')).toBe(true)
    expect(isBookingVerificationMode('email_only')).toBe(true)
    expect(isBookingVerificationMode('tampered')).toBe(false)

    expect(readBookingVerificationMode({
      booking: { verificationMode: 'email_only' },
    })).toBe('email_only')
    expect(readBookingVerificationMode({ booking: {} })).toBe('sms_with_email_fallback')
    expect(readBookingVerificationMode(null)).toBe('sms_with_email_fallback')
  })
})
