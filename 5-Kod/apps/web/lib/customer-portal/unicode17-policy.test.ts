import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isUnicode17Forbidden,
  UNICODE_17_CATEGORY_C_RANGES,
} from './unicode17-policy'

const nativeCategoryC = /[\p{C}\uFFFD]/u

describe('fixed Unicode 17 customer-portal policy', () => {
  it('matches the checked-in SQL range table exactly', () => {
    const migration = readFileSync(resolve(
      process.cwd(), '../../supabase/migrations/0123_customer_portal_profile.sql',
    ), 'utf8')
    const table = migration.match(
      /from \(values([\s\S]*?)\) as forbidden\(first_codepoint, last_codepoint\)/,
    )?.[1]
    const sqlRanges = [...(table ?? '').matchAll(/\((\d+),\s*(\d+)\)/g)]
      .map((match) => [Number(match[1]), Number(match[2])])
    expect(sqlRanges).toEqual(UNICODE_17_CATEGORY_C_RANGES)
  })

  it('matches Unicode 17 category C plus U+FFFD for every Unicode codepoint', () => {
    let firstMismatch: number | null = null
    for (let codepoint = 0; codepoint <= 0x10ffff; codepoint += 1) {
      if (isUnicode17Forbidden(codepoint) !== nativeCategoryC.test(String.fromCodePoint(codepoint))) {
        firstMismatch = codepoint
        break
      }
    }
    expect(firstMismatch).toBeNull()
  })

  it('allows assigned multilingual names and Unicode 17 U+088F while closing dangerous values', () => {
    expect([...('अनन्या शर्मा')].some((char) => isUnicode17Forbidden(char.codePointAt(0)!))).toBe(false)
    expect(isUnicode17Forbidden(0x088f)).toBe(false)
    expect(isUnicode17Forbidden(0x1f600)).toBe(false)
    expect(isUnicode17Forbidden(0x0378)).toBe(true)
    expect(isUnicode17Forbidden(0x200b)).toBe(true)
    expect(isUnicode17Forbidden(0xfdd0)).toBe(true)
    expect(isUnicode17Forbidden(0xfffd)).toBe(true)
  })
})
