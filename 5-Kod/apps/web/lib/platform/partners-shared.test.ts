import { describe, expect, it } from 'vitest'
import { formatPartnerMoney, parsePartnerPriceOre } from './partners-shared'

describe('parsePartnerPriceOre', () => {
  it('accepts any non-negative amount with at most two decimals', () => {
    expect(parsePartnerPriceOre('0')).toBe(0)
    expect(parsePartnerPriceOre('49,95')).toBe(4_995)
    expect(parsePartnerPriceOre('1250.50')).toBe(125_050)
    expect(parsePartnerPriceOre('1000000')).toBe(100_000_000)
  })

  it('rejects malformed, negative, over-precise and out-of-range prices', () => {
    for (const value of ['', '-1', '1.999', 'hej', '1000000.01']) {
      expect(parsePartnerPriceOre(value), value).toBeNull()
    }
  })
})

describe('formatPartnerMoney', () => {
  it('formats minor units in the partner currency', () => {
    expect(formatPartnerMoney(4_995, 'SEK', 'sv-SE')).toContain('49,95')
    expect(formatPartnerMoney(12_500, 'EUR', 'sv-SE')).toContain('125,00')
  })
})
