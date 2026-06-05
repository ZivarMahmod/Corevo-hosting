import { describe, it, expect, beforeEach, vi } from 'vitest'
import { countBookingsByTenant, deriveCustomizationLevel, listTenants } from './tenants'

// listTenants reads through platformCtx — mock that boundary so we can assert it
// SELECTs city and surfaces both city + ownerName (#10/#14). A tiny chainable stub
// returns the seeded result for each table; .or() (filter path) just returns self.
const platformCtxMock = vi.fn()
vi.mock('./guard', () => ({ platformCtx: () => platformCtxMock() }))

function makeListClient(opts: {
  tenants: unknown[]
  bookings?: { tenant_id: string }[]
  owners?: { tenant_id: string; full_name: string | null }[]
}) {
  const selects: Record<string, unknown[]> = {}
  const from = (table: string) => {
    const result =
      table === 'tenants'
        ? { data: opts.tenants }
        : table === 'bookings'
          ? { data: opts.bookings ?? [] }
          : table === 'users'
            ? { data: opts.owners ?? [] }
            : { data: [] }
    const chain: Record<string, unknown> = {
      select: (cols?: unknown) => ((selects[table] ??= []).push(cols), chain),
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res),
    }
    return chain
  }
  return { client: { from }, selects }
}

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

// goal-20 — listTenants returns the new columns (#14 city, #10 ownerName) with a read
// path, and SELECTs city from tenants (proving the column is actually queried).
describe('listTenants (#14 city + #10 ownerName)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SELECTs city from tenants and returns city + ownerName per tenant', async () => {
    const { client, selects } = makeListClient({
      tenants: [
        { id: 't1', slug: 'a', name: 'A', status: 'active', plan: 'standard', city: 'Göteborg', created_at: '2026-01-01', tenant_settings: { billing_model: 'per_booking' } },
        { id: 't2', slug: 'b', name: 'B', status: 'active', plan: 'standard', city: null, created_at: '2026-01-02', tenant_settings: null },
      ],
      bookings: [{ tenant_id: 't1' }, { tenant_id: 't1' }],
      owners: [{ tenant_id: 't1', full_name: 'Anna Berg' }],
    })
    platformCtxMock.mockReturnValue(Promise.resolve({ supabase: client }))

    const rows = await listTenants()

    // The tenants select string must include city (the column is really queried).
    expect(String(selects.tenants?.[0])).toContain('city')

    const a = rows.find((r) => r.id === 't1')!
    const b = rows.find((r) => r.id === 't2')!
    expect(a.city).toBe('Göteborg')
    expect(a.ownerName).toBe('Anna Berg')
    expect(a.bookingsCount).toBe(2)
    // Honest empty: no city + no named owner → null (never '' / fabricated).
    expect(b.city).toBeNull()
    expect(b.ownerName).toBeNull()
  })

  it('a salon_admin with no full_name yields a null ownerName (honest empty)', async () => {
    const { client } = makeListClient({
      tenants: [
        { id: 't1', slug: 'a', name: 'A', status: 'active', plan: 'standard', city: null, created_at: '2026-01-01', tenant_settings: null },
      ],
      owners: [{ tenant_id: 't1', full_name: null }],
    })
    platformCtxMock.mockReturnValue(Promise.resolve({ supabase: client }))

    const rows = await listTenants()
    expect(rows[0]!.ownerName).toBeNull()
  })
})
