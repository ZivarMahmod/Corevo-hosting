import { describe, expect, it } from 'vitest'
import {
  BOOKING_EXTERNAL_CTA_FIELD_PREFIX,
  normalizeBookingExternalCtaUrls,
  normalizeBookingExternalUrl,
  parseBookingExternalCtaUrls,
  resolveBookingExternalUrl,
} from './booking-external-url'

describe('normalizeBookingExternalUrl', () => {
  it('accepts only absolute https booking links', () => {
    expect(normalizeBookingExternalUrl(' https://www.bokadirekt.se/places/test-123 ')).toBe(
      'https://www.bokadirekt.se/places/test-123',
    )
    expect(normalizeBookingExternalUrl('http://example.com')).toBeNull()
    expect(normalizeBookingExternalUrl('/boka')).toBeNull()
    expect(normalizeBookingExternalUrl('javascript:alert(1)')).toBeNull()
  })

  it('treats blank and non-string values as no external booking link', () => {
    expect(normalizeBookingExternalUrl('')).toBeNull()
    expect(normalizeBookingExternalUrl('   ')).toBeNull()
    expect(normalizeBookingExternalUrl(null)).toBeNull()
    expect(normalizeBookingExternalUrl({})).toBeNull()
  })
})

describe('external booking CTA URLs', () => {
  it('validates saved and submitted overrides and resolves slot then fallback', () => {
    expect(normalizeBookingExternalCtaUrls({
      hero: 'https://example.com/hero',
      'service:123e4567-e89b-42d3-a456-426614174000': 'https://example.com/service',
      BAD: 'https://example.com/bad',
      nav: 'javascript:alert(1)',
    })).toEqual({
      hero: 'https://example.com/hero',
      'service:123e4567-e89b-42d3-a456-426614174000': 'https://example.com/service',
    })

    const formData = new FormData()
    formData.set(`${BOOKING_EXTERNAL_CTA_FIELD_PREFIX}hero`, ' https://example.com/hero ')
    formData.set(`${BOOKING_EXTERNAL_CTA_FIELD_PREFIX}contact`, '')
    const parsed = parseBookingExternalCtaUrls(formData)

    expect(parsed).toEqual({ hero: 'https://example.com/hero' })
    expect(resolveBookingExternalUrl('https://example.com/default', parsed!, 'hero')).toBe(
      'https://example.com/hero',
    )
    expect(resolveBookingExternalUrl('https://example.com/default', parsed!, 'contact')).toBe(
      'https://example.com/default',
    )
  })

  it('rejects an invalid submitted override instead of silently storing it', () => {
    const formData = new FormData()
    formData.set(`${BOOKING_EXTERNAL_CTA_FIELD_PREFIX}hero`, 'http://example.com')
    expect(parseBookingExternalCtaUrls(formData)).toBeNull()
  })

  it('rejects credentials, control characters and unknown slot identifiers', () => {
    expect(normalizeBookingExternalUrl('https://user:secret@example.com/boka')).toBeNull()
    expect(normalizeBookingExternalUrl('https://example.com/\u0000boka')).toBeNull()

    const formData = new FormData()
    formData.set(`${BOOKING_EXTERNAL_CTA_FIELD_PREFIX}random-dialog`, 'https://example.com')
    expect(parseBookingExternalCtaUrls(formData)).toBeNull()
  })
})
