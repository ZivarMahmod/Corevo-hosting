import { describe, it, expect, vi } from 'vitest'

// Pure validator coverage for goal-23. Mock ./guard so importing the module (which also
// exports the platform read) doesn't pull the supabase chain.
vi.mock('./guard', () => ({ platformCtx: vi.fn() }))

import { normalizeDomain, isValidDomain, isReservedDomain, validateDomainInput } from './domains'

describe('normalizeDomain', () => {
  it('lowercases + strips protocol, path and trailing dot', () => {
    expect(normalizeDomain('  HTTPS://Boka.Salong.SE/boka?x=1 ')).toBe('boka.salong.se')
    expect(normalizeDomain('boka.salong.se.')).toBe('boka.salong.se')
    expect(normalizeDomain('http://x.se')).toBe('x.se')
  })
})

describe('isValidDomain', () => {
  it('accepts real hostnames', () => {
    expect(isValidDomain('boka.salong.se')).toBe(true)
    expect(isValidDomain('salong.se')).toBe(true)
    expect(isValidDomain('a.b.c.example.co.uk')).toBe(true)
  })
  it('rejects junk', () => {
    expect(isValidDomain('')).toBe(false)
    expect(isValidDomain('nodot')).toBe(false)
    expect(isValidDomain('-bad.se')).toBe(false)
    expect(isValidDomain('bad-.se')).toBe(false)
    expect(isValidDomain('spaces in.se')).toBe(false)
    expect(isValidDomain('boka.salong.s')).toBe(false) // 1-char TLD
  })
})

describe('isReservedDomain (platform zone)', () => {
  it('reserves corevo.se and any subdomain of it', () => {
    expect(isReservedDomain('corevo.se')).toBe(true)
    expect(isReservedDomain('freshcut.corevo.se')).toBe(true)
    expect(isReservedDomain('a.b.corevo.se')).toBe(true)
  })
  it('does NOT reserve a customer domain', () => {
    expect(isReservedDomain('boka.salong.se')).toBe(false)
    expect(isReservedDomain('notcorevo.se')).toBe(false)
  })
})

describe('validateDomainInput', () => {
  it('returns the normalized domain for a valid customer domain', () => {
    expect(validateDomainInput(' Boka.Salong.SE ')).toEqual({ domain: 'boka.salong.se' })
  })
  it('errors (no domain) on empty', () => {
    expect(validateDomainInput('').error).toBeTruthy()
    expect(validateDomainInput('').domain).toBeUndefined()
  })
  it('errors on invalid format', () => {
    expect(validateDomainInput('nodot').error).toBeTruthy()
  })
  it('errors on a reserved corevo.se domain', () => {
    const r = validateDomainInput('freshcut.corevo.se')
    expect(r.error).toBeTruthy()
    expect(r.domain).toBeUndefined()
  })
})
