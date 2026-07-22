import { describe, it, expect } from 'vitest'
import { validateSlug, isReservedSlug, normalizeSlug } from './slug'

describe('validateSlug', () => {
  it('accepts a plain DNS-safe slug', () => {
    expect(validateSlug('frisor3')).toEqual({ ok: true, slug: 'frisor3' })
  })

  it('lowercases + trims before validating', () => {
    expect(validateSlug('  Frisör3 ')).toMatchObject({ ok: false }) // ö is not DNS-safe
    expect(validateSlug('  SALONG-A ')).toEqual({ ok: true, slug: 'salong-a' })
  })

  it('rejects reserved subdomains (DoD: "Reserverad slug avvisas")', () => {
    for (const r of ['booking', 'admin', 'app', 'www', 'api', 'mina']) {
      const res = validateSlug(r)
      expect(res.ok).toBe(false)
    }
  })

  it('rejects empty / too short / too long', () => {
    expect(validateSlug('').ok).toBe(false)
    expect(validateSlug('a').ok).toBe(false)
    expect(validateSlug('a'.repeat(64)).ok).toBe(false)
  })

  it('rejects invalid characters and leading/trailing hyphen', () => {
    expect(validateSlug('-frisor').ok).toBe(false)
    expect(validateSlug('frisor-').ok).toBe(false)
    expect(validateSlug('fri sor').ok).toBe(false)
    expect(validateSlug('fris_or').ok).toBe(false)
    expect(validateSlug('frisör').ok).toBe(false)
  })

  it('accepts internal hyphens and digits', () => {
    expect(validateSlug('frisor-2').ok).toBe(true)
    expect(validateSlug('a1').ok).toBe(true)
  })
})

describe('isReservedSlug / normalizeSlug', () => {
  it('isReservedSlug is case-insensitive', () => {
    expect(isReservedSlug('BOOKING')).toBe(true)
    expect(isReservedSlug('frisor3')).toBe(false)
  })
  it('normalizeSlug lowercases + trims', () => {
    expect(normalizeSlug('  Foo ')).toBe('foo')
  })
})
