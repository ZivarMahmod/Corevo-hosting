import { describe, it, expect } from 'vitest'
import { countBookingsByTenant, deriveCustomizationLevel } from './tenants'

// #15 — the per-tenant booking count is ONE grouped pass over the cross-tenant
// bookings read (no N+1). These pin the bucketing the Översikt "Bokningar" column
// renders: a tenant with N rows shows N, a tenant with none is absent → honest 0.
describe('countBookingsByTenant (#15 grouped count)', () => {
  it('counts rows per tenant_id', () => {
    const m = countBookingsByTenant([
      { tenant_id: 'a' },
      { tenant_id: 'a' },
      { tenant_id: 'b' },
      { tenant_id: 'a' },
    ])
    expect(m.get('a')).toBe(3)
    expect(m.get('b')).toBe(1)
  })

  it('a tenant with no bookings is absent → caller reads an honest 0', () => {
    const m = countBookingsByTenant([{ tenant_id: 'a' }])
    expect(m.get('a')).toBe(1)
    expect(m.get('does-not-exist')).toBeUndefined()
    expect(m.get('does-not-exist') ?? 0).toBe(0)
  })

  it('empty input → empty map (no fabricated counts)', () => {
    expect(countBookingsByTenant([]).size).toBe(0)
  })
})

// #18 — the "Nivå" chip is derived only from REAL, actually-set signals; the dead
// custom_override.css Nivå-3 branch and the layout.nav_variant/hero_variant reads
// are gone. Level 2 = a named theme preset OR an uploaded logo/font; else Level 1.
describe('deriveCustomizationLevel (#18 real-signal derivation)', () => {
  it('Nivå 1 — nothing set (the no-code colour-token floor)', () => {
    expect(deriveCustomizationLevel({}, {})).toBe(1)
    expect(deriveCustomizationLevel(null, null)).toBe(1)
    expect(deriveCustomizationLevel(undefined, undefined)).toBe(1)
  })

  it('Nivå 1 — colour tokens alone do NOT bump the tier', () => {
    expect(deriveCustomizationLevel({}, { color_primary: '#1F4636' })).toBe(1)
  })

  it('Nivå 2 — a named theme preset is set', () => {
    expect(deriveCustomizationLevel({ theme: 'salvia' }, {})).toBe(2)
  })

  it('Nivå 2 — an uploaded logo or font', () => {
    expect(deriveCustomizationLevel({}, { logo_url: 'https://x/logo.png' })).toBe(2)
    expect(deriveCustomizationLevel({}, { font_body: 'Inter' })).toBe(2)
  })

  it('dead keys are ignored — no phantom Nivå 3, no layout-variant bump', () => {
    // The retired A/B nav/hero system + the never-set custom_override.css seam must
    // NOT lift the tier (they used to fake Nivå 2/3).
    expect(
      deriveCustomizationLevel({ layout: { nav_variant: 'B', hero_variant: '2' } }, {}),
    ).toBe(1)
    expect(deriveCustomizationLevel({ custom_override: { css: '.x{}' } }, {})).toBe(1)
  })
})
