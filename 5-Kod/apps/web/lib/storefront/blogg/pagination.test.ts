import { describe, expect, it } from 'vitest'
import { bloggPageRange, parseBloggPage } from './types'

describe('blogg pagination', () => {
  it('accepts only positive safe integers', () => {
    expect(parseBloggPage(undefined)).toBe(1)
    expect(parseBloggPage('1')).toBe(1)
    expect(parseBloggPage('12')).toBe(12)
    for (const value of ['', '0', '-1', '1.5', '01', 'abc', '9007199254740992', ['2']]) {
      expect(parseBloggPage(value)).toBe(1)
    }
  })

  it('builds inclusive Supabase ranges without overlap', () => {
    expect(bloggPageRange(1, 6)).toEqual({ from: 0, to: 5 })
    expect(bloggPageRange(2, 6)).toEqual({ from: 6, to: 11 })
  })
})
