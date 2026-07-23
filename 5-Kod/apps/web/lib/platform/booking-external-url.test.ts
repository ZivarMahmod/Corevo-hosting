import { describe, expect, it } from 'vitest'
import { normalizeBookingExternalUrl } from './booking-external-url'

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
