import { describe, expect, it } from 'vitest'
import { throwIfPartnerReadFailed } from './partners'

describe('partner read integrity', () => {
  it('accepts a complete multi-query read', () => {
    expect(() => throwIfPartnerReadFailed('partner_detail_unavailable', [
      { error: null },
      { error: null },
      { error: null },
      { error: null },
    ])).not.toThrow()
  })

  it.each([0, 1, 2, 3])('fails the detail read when query %i fails', (failedIndex) => {
    const results = Array.from({ length: 4 }, (_, index) => ({
      error: index === failedIndex ? { message: 'unavailable' } : null,
    }))
    expect(() => throwIfPartnerReadFailed('partner_detail_unavailable', results))
      .toThrow('partner_detail_unavailable')
  })

  it.each([0, 1, 2])('fails the billing read when query %i fails', (failedIndex) => {
    const results = Array.from({ length: 3 }, (_, index) => ({
      error: index === failedIndex ? { message: 'unavailable' } : null,
    }))
    expect(() => throwIfPartnerReadFailed('partner_billing_unavailable', results))
      .toThrow('partner_billing_unavailable')
  })
})
