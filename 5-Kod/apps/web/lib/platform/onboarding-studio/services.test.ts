import { describe, it, expect } from 'vitest'
import { krToOre, parseServiceInputs } from './services'

describe('krToOre — UI kronor → integer öre (money path)', () => {
  it('parses whole + decimal kronor, accepting comma OR dot', () => {
    expect(krToOre('350')).toBe(35000)
    expect(krToOre('12.5')).toBe(1250)
    expect(krToOre('12,50')).toBe(1250)
    expect(krToOre(' 99 ')).toBe(9900)
  })

  it('coerces junk / empty / negative to 0 (never throws, never negative)', () => {
    expect(krToOre('')).toBe(0)
    expect(krToOre('abc')).toBe(0)
    expect(krToOre('-5')).toBe(0)
  })

  it('caps at the 100 000 kr ceiling', () => {
    expect(krToOre('999999')).toBe(100_000_00)
  })
})

describe('parseServiceInputs — emitted JSON → clean insert rows (money path)', () => {
  it('keeps valid rows and trims names', () => {
    const rows = parseServiceInputs(JSON.stringify([{ name: '  Klippning ', price_cents: 35000 }]))
    expect(rows).toEqual([{ name: 'Klippning', price_cents: 35000 }])
  })

  it('drops empty-name rows but keeps the rest', () => {
    const rows = parseServiceInputs(JSON.stringify([{ name: '', price_cents: 100 }, { name: 'Färg', price_cents: 50000 }]))
    expect(rows).toEqual([{ name: 'Färg', price_cents: 50000 }])
  })

  it('coerces a bad/negative/over-ceiling price to a safe value', () => {
    expect(parseServiceInputs(JSON.stringify([{ name: 'A', price_cents: -10 }]))[0]!.price_cents).toBe(0)
    expect(parseServiceInputs(JSON.stringify([{ name: 'B', price_cents: 'x' }]))[0]!.price_cents).toBe(0)
    expect(parseServiceInputs(JSON.stringify([{ name: 'C', price_cents: 999_999_99 }]))[0]!.price_cents).toBe(100_000_00)
  })

  it('fail-soft on bad JSON / non-array / non-string', () => {
    expect(parseServiceInputs('not json')).toEqual([])
    expect(parseServiceInputs(JSON.stringify({ name: 'x' }))).toEqual([])
    expect(parseServiceInputs(null)).toEqual([])
    expect(parseServiceInputs('')).toEqual([])
  })

  it('caps the row count at 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `S${i}`, price_cents: 100 }))
    expect(parseServiceInputs(JSON.stringify(many))).toHaveLength(50)
  })
})
