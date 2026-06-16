import { describe, it, expect } from 'vitest'
import { buildRoutes, fetchActiveSlugs, REQUIRED_FIXED_HOSTS } from './gen-deploy-config.mjs'

// The fixed infra routes as they appear in wrangler.jsonc (the generator's base).
const BASE = [
  { pattern: 'booking.corevo.se', custom_domain: true },
  { pattern: 'superbooking.corevo.se', custom_domain: true },
  { pattern: 'minbooking.corevo.se', custom_domain: true },
  { pattern: '*.boka.corevo.se/*', zone_name: 'corevo.se' },
]

describe('buildRoutes', () => {
  it('keeps the 3 fixed hosts + wildcard and appends one custom_domain per active slug', () => {
    const routes = buildRoutes(BASE, ['test-barber', 'klippstudio'])
    const patterns = routes.map((r) => r.pattern)
    for (const h of REQUIRED_FIXED_HOSTS) expect(patterns).toContain(h)
    expect(patterns).toContain('*.boka.corevo.se/*')
    expect(patterns).toContain('test-barber.corevo.se')
    expect(patterns).toContain('klippstudio.corevo.se')
    // customer routes are custom_domain
    const cust = routes.find((r) => r.pattern === 'test-barber.corevo.se')
    expect(cust.custom_domain).toBe(true)
  })

  it('lowercases/trims slugs and dedupes by pattern', () => {
    const routes = buildRoutes(BASE, ['  Test-Barber ', 'test-barber'])
    const occurrences = routes.filter((r) => r.pattern === 'test-barber.corevo.se')
    expect(occurrences).toHaveLength(1)
  })

  it('NEVER mints a reserved/POS label as a tenant domain', () => {
    const routes = buildRoutes(BASE, ['booking', 'admin', 'kiosk', 'superbooking', 'boka', 'realsalon'])
    const patterns = routes.map((r) => r.pattern)
    expect(patterns).toContain('realsalon.corevo.se')
    // none of the reserved labels become a NEW <label>.corevo.se customer route
    expect(patterns.filter((p) => p === 'admin.corevo.se')).toHaveLength(0)
    expect(patterns.filter((p) => p === 'kiosk.corevo.se')).toHaveLength(0)
    expect(patterns.filter((p) => p === 'boka.corevo.se')).toHaveLength(0)
  })

  it('handles an empty slug list — just the fixed infra survives', () => {
    const routes = buildRoutes(BASE, [])
    expect(routes).toHaveLength(BASE.length)
  })

  it('THROWS (fail-closed) if a required fixed host is missing from the base', () => {
    const broken = BASE.filter((r) => r.pattern !== 'superbooking.corevo.se')
    expect(() => buildRoutes(broken, ['test-barber'])).toThrow(/superbooking\.corevo\.se/)
  })
})

describe('fetchActiveSlugs', () => {
  const fakeFetch = (status, body) => async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })

  it('returns slugs from a 200 response', async () => {
    const slugs = await fetchActiveSlugs('https://x', 'anon', fakeFetch(200, [{ slug: 'a' }, { slug: 'b' }]))
    expect(slugs).toEqual(['a', 'b'])
  })

  it('THROWS on a non-OK response (fail-closed, never silently drops domains)', async () => {
    await expect(fetchActiveSlugs('https://x', 'anon', fakeFetch(500, {}))).rejects.toThrow(/HTTP 500/)
  })

  it('THROWS on a non-array body', async () => {
    await expect(fetchActiveSlugs('https://x', 'anon', fakeFetch(200, { error: 'x' }))).rejects.toThrow(
      /non-array/,
    )
  })

  it('filters out null/empty slugs', async () => {
    const slugs = await fetchActiveSlugs('https://x', 'anon', fakeFetch(200, [{ slug: 'a' }, { slug: null }, {}]))
    expect(slugs).toEqual(['a'])
  })
})
