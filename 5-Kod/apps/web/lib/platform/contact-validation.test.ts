import { describe, expect, it } from 'vitest'
import { normalizeContactEmail, normalizeSocialUrl } from './contact-validation'

describe('contact validation', () => {
  it('preserves null/empty semantics and validates email without truncating it', () => {
    expect(normalizeContactEmail(null)).toBeNull()
    expect(normalizeContactEmail('  ')).toBeNull()
    expect(normalizeContactEmail(' Hej@example.se ')).toBe('Hej@example.se')
    expect(normalizeContactEmail('inte-en-adress')).toBeUndefined()
    expect(normalizeContactEmail(`${'a'.repeat(190)}@example.se`)).toBeUndefined()
    expect(normalizeContactEmail({ poison: true })).toBeUndefined()
  })

  it('adds https to valid social links and rejects unsafe or malformed URLs', () => {
    expect(normalizeSocialUrl(null)).toBeNull()
    expect(normalizeSocialUrl('  ')).toBeNull()
    expect(normalizeSocialUrl(' instagram.com/corevo ')).toBe('https://instagram.com/corevo')
    expect(normalizeSocialUrl('https://facebook.com/corevo')).toBe('https://facebook.com/corevo')
    expect(normalizeSocialUrl('javascript:alert(1)')).toBeUndefined()
    expect(normalizeSocialUrl('ftp://example.com/corevo')).toBeUndefined()
    expect(normalizeSocialUrl('https://')).toBeUndefined()
    expect(normalizeSocialUrl('https://user@example.com/corevo')).toBeUndefined()
    expect(normalizeSocialUrl({ poison: true })).toBeUndefined()
  })
})
