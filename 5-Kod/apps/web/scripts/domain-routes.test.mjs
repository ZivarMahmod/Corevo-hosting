import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parse as parseJsonc } from 'jsonc-parser'
import {
  applyCustomDomainEdit,
  readCustomDomainPatternsFromText,
  readAllRoutePatternsFromText,
  REQUIRED_FIXED_ROUTES,
  normalizeSlug,
  assertSafeSlug,
  patternForSlug,
} from './domain-routes.mjs'

// A wrangler.jsonc shape with COMMENTS + top-level routes + an empty staging.routes.
const WR = `{
  // ── top comment that MUST survive ──
  "name": "bokningsplatformen",
  "routes": [
    { "pattern": "booking.corevo.se", "custom_domain": true },
    { "pattern": "superbooking.corevo.se", "custom_domain": true },
    { "pattern": "minbooking.corevo.se", "custom_domain": true },
    { "pattern": "mina.corevo.se", "custom_domain": true },
    { "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" }
  ],
  // ── env block comment ──
  "env": {
    "staging": {
      "routes": []
    }
  }
}
`

describe('applyCustomDomainEdit', () => {
  it('inserts a compact single-line custom_domain route, preserving comments', () => {
    const { text, added, pattern } = applyCustomDomainEdit(WR, 'test-barber')
    expect(added).toBe(true)
    expect(pattern).toBe('test-barber.corevo.se')
    expect(text).toContain('{ "pattern": "test-barber.corevo.se", "custom_domain": true }')
    // comments survive (the FX-14 non-negotiable)
    expect(text).toContain('top comment that MUST survive')
    expect(text).toContain('env block comment')
    // the fixed hosts + boka wildcard untouched
    for (const p of ['booking.corevo.se', 'superbooking.corevo.se', 'minbooking.corevo.se', 'mina.corevo.se', '*.boka.corevo.se/*']) {
      expect(text).toContain(p)
    }
  })

  it('inserts into TOP-LEVEL routes, never env.staging.routes', () => {
    const { text } = applyCustomDomainEdit(WR, 'klippstudio')
    // new route appears BEFORE the env block → it is top-level
    expect(text.indexOf('klippstudio.corevo.se')).toBeLessThan(text.indexOf('"env"'))
    // staging routes stay empty
    const cfg = parseJsonc(text)
    expect(cfg.env.staging.routes).toEqual([])
  })

  it('is idempotent — second insert is a no-op with unchanged text', () => {
    const once = applyCustomDomainEdit(WR, 'test-barber')
    const twice = applyCustomDomainEdit(once.text, 'test-barber')
    expect(twice.added).toBe(false)
    expect(twice.text).toBe(once.text)
  })

  it('normalizes case/whitespace before matching', () => {
    const { text } = applyCustomDomainEdit(WR, '  Test-Barber ')
    expect(text).toContain('test-barber.corevo.se')
    expect(applyCustomDomainEdit(text, 'TEST-BARBER').added).toBe(false)
  })

  it('REFUSES reserved/POS labels', () => {
    for (const r of ['booking', 'admin', 'kiosk', 'superbooking', 'boka', 'mina', 'www']) {
      expect(() => applyCustomDomainEdit(WR, r)).toThrow(/reserved\/POS/)
    }
  })

  it('REFUSES invalid labels (dots, wildcard, empty) — can never yield *.corevo.se', () => {
    expect(() => applyCustomDomainEdit(WR, '*')).toThrow(/valid DNS label/)
    expect(() => applyCustomDomainEdit(WR, 'a.b')).toThrow(/valid DNS label/)
    expect(() => applyCustomDomainEdit(WR, '')).toThrow(/empty slug/)
  })
})

describe('readCustomDomainPatternsFromText', () => {
  it('returns custom_domain patterns and EXCLUDES the zone_name wildcard', () => {
    const out = readCustomDomainPatternsFromText(WR)
    expect(out).toEqual(['booking.corevo.se', 'superbooking.corevo.se', 'minbooking.corevo.se', 'mina.corevo.se'])
    expect(out).not.toContain('*.boka.corevo.se/*')
  })
})

describe('fixed-route protection (customer portal + *.boka wildcard)', () => {
  it('REQUIRED_FIXED_ROUTES includes mina.corevo.se and the storefront wildcard', () => {
    expect(REQUIRED_FIXED_ROUTES).toContain('mina.corevo.se')
    expect(REQUIRED_FIXED_ROUTES).toContain('*.boka.corevo.se/*')
    // and the custom_domain reader does NOT see it → it must be asserted via all-routes
    expect(readCustomDomainPatternsFromText(WR)).not.toContain('*.boka.corevo.se/*')
  })

  it('readAllRoutePatternsFromText returns EVERY route incl. the zone_name wildcard', () => {
    const all = readAllRoutePatternsFromText(WR)
    expect(all).toContain('*.boka.corevo.se/*')
    for (const r of REQUIRED_FIXED_ROUTES) expect(all).toContain(r)
  })

  it('the editor REFUSES to operate on a file already missing the boka wildcard (fail-closed)', () => {
    const broken = WR.replace('    { "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" }\n', '')
    expect(() => applyCustomDomainEdit(broken, 'newsalon')).toThrow(/\*\.boka\.corevo\.se/)
  })
})

describe('applyCustomDomainEdit — offset-math edge cases', () => {
  it('handles a trailing comma after the last route element', () => {
    const withTrailingComma = `{
  "routes": [
    { "pattern": "booking.corevo.se", "custom_domain": true },
    { "pattern": "superbooking.corevo.se", "custom_domain": true },
    { "pattern": "minbooking.corevo.se", "custom_domain": true },
    { "pattern": "mina.corevo.se", "custom_domain": true },
    { "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" },
  ]
}
`
    const { text, added } = applyCustomDomainEdit(withTrailingComma, 'salongx')
    expect(added).toBe(true)
    expect(readAllRoutePatternsFromText(text)).toContain('salongx.corevo.se')
    // still a superset of the fixed routes after the edit
    for (const r of REQUIRED_FIXED_ROUTES) expect(readAllRoutePatternsFromText(text)).toContain(r)
  })

  it('handles a trailing line-comment after the last route element', () => {
    const withTrailingComment = `{
  "routes": [
    { "pattern": "booking.corevo.se", "custom_domain": true },
    { "pattern": "superbooking.corevo.se", "custom_domain": true },
    { "pattern": "minbooking.corevo.se", "custom_domain": true },
    { "pattern": "mina.corevo.se", "custom_domain": true },
    { "pattern": "*.boka.corevo.se/*", "zone_name": "corevo.se" } // the storefront wildcard
  ]
}
`
    const { text, added } = applyCustomDomainEdit(withTrailingComment, 'salongy')
    expect(added).toBe(true)
    expect(readAllRoutePatternsFromText(text)).toContain('salongy.corevo.se')
    expect(text).toContain('the storefront wildcard') // comment survives
  })
})

describe('wrangler production/staging contract', () => {
  const cfg = parseJsonc(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'))

  it('binds mina.corevo.se only to the production worker', () => {
    expect(cfg.routes).toContainEqual({ pattern: 'mina.corevo.se', custom_domain: true })
    expect(cfg.env.staging.routes).toEqual([])
  })

  it('declares the customer portal host in both runtime environments', () => {
    expect(cfg.vars.NEXT_PUBLIC_CUSTOMER_PORTAL_HOST).toBe('mina.corevo.se')
    expect(cfg.env.staging.vars.NEXT_PUBLIC_CUSTOMER_PORTAL_HOST).toBe('mina.corevo.se')
  })
})

describe('customer portal environment mirrors', () => {
  const envExample = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8')
  const envProduction = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  const turbo = parseJsonc(readFileSync(new URL('../../../turbo.json', import.meta.url), 'utf8'))

  it('keeps the customer portal host and reserved slug in both tracked env files', () => {
    for (const source of [envExample, envProduction]) {
      expect(source).toMatch(/^NEXT_PUBLIC_CUSTOMER_PORTAL_HOST=mina\.corevo\.se$/m)
      const reserved = /^NEXT_PUBLIC_RESERVED_SUBDOMAINS=(.+)$/m.exec(source)?.[1]?.split(',') ?? []
      expect(reserved).toContain('mina')
    }
  })

  it('passes the customer portal host through Turborepo', () => {
    expect(turbo.globalPassThroughEnv).toContain('NEXT_PUBLIC_CUSTOMER_PORTAL_HOST')
  })
})

describe('slug helpers', () => {
  it('normalizeSlug + patternForSlug', () => {
    expect(normalizeSlug('  Foo ')).toBe('foo')
    expect(patternForSlug('foo')).toBe('foo.corevo.se')
  })
  it('assertSafeSlug throws on reserved/invalid', () => {
    expect(() => assertSafeSlug('boka')).toThrow()
    expect(() => assertSafeSlug('a.b')).toThrow()
    expect(() => assertSafeSlug('ok-salon')).not.toThrow()
  })
})
