import { describe, expect, it, vi } from 'vitest'
import type { TenantDetail } from './tenants'
import { buildSiteSnapshot, deriveSiteScheduleHours, loadSiteRevisionState, sanitizeSiteSnapshot } from './site-revisions'

const validSnapshot = {
  tenant: { name: 'Studio Norr' },
  settings: {
    copy: { heroTitle: 'Hej' },
    theme: 'kalla',
    contact: { email: null, phone: null },
    social: { instagram: null, facebook: null, tiktok: null },
    map: null,
    opening_hours: null,
    seo: { title: null, description: null },
    booking: { variant: 'drawer', pickerMode: 'strip', staffAvatars: 'foto' },
  },
  branding: { color_primary: '#112233' },
  location: { address: 'Storgatan 1' },
} as const

describe('buildSiteSnapshot', () => {
  it('owns only the publish whitelist, excludes poison/team, and preserves booking shape', () => {
    const detail = {
      tenant: { name: ' Studio Norr ' },
      settings: {
        settings: {
          copy: { heroTitle: 'Hej', poison: 'must-not-leak' },
          theme: 'onyx',
          contact: { email: ' hej@example.se ', phone: ' 070-1 ', poison: true },
          social: { instagram: ' instagram.com/norr ', facebook: '', tiktok: null, poison: true },
          map: { lat: 59.33, lon: 18.06, poison: true },
          opening_hours: [{ day: 'Måndag', time: '09–17', poison: true }],
          seo: { title: 'Norr', description: 'Klippning', poison: true },
          booking: {
            variant: 'drawer',
            pickerMode: 'strip',
            staffAvatars: 'foto',
            poison: true,
          },
          services: [{ id: 'must-not-leak' }],
          staff: [{ id: 'must-not-leak' }],
          poison: 'must-not-leak',
        },
      },
      branding: {
        color_primary: '#112233',
        logo_url: 'https://img/logo.png',
        hero_images: ['https://img/hero.png'],
        team: [{ name: 'Ada', role: 'Frisör', img: 'x' }],
        poison: 'must-not-leak',
      },
      primaryAddress: ' Storgatan 1 ',
    } as unknown as TenantDetail

    const snapshot = buildSiteSnapshot(detail)

    expect(snapshot.settings.booking).toEqual({
      variant: 'drawer',
      pickerMode: 'strip',
      staffAvatars: 'foto',
    })
    expect(snapshot).toMatchObject({
      tenant: { name: 'Studio Norr' },
      settings: {
        theme: 'onyx',
        copy: { heroTitle: 'Hej' },
        contact: { email: 'hej@example.se', phone: '070-1' },
        social: { instagram: 'https://instagram.com/norr', facebook: null, tiktok: null },
        map: { lat: 59.33, lon: 18.06 },
        opening_hours: [{ day: 'Måndag', time: '09–17' }],
        seo: { title: 'Norr', description: 'Klippning' },
      },
      branding: {
        color_primary: '#112233',
        logo_url: 'https://img/logo.png',
        hero_images: ['https://img/hero.png'],
      },
      location: { address: 'Storgatan 1' },
    })
    expect(JSON.stringify(snapshot)).not.toMatch(/poison|must-not-leak|services/)
    expect(snapshot.branding).not.toHaveProperty('team')
    expect(snapshot.settings.booking).not.toHaveProperty('staff')
  })
})

describe('deriveSiteScheduleHours', () => {
  it('prefills every weekday from the real outer staff schedule envelope', () => {
    const detail = {
      staffList: [
        { hours: [{ weekday: 1, start: '09:00', end: '16:00' }, { weekday: 2, start: '10:30', end: '17:00' }] },
        { hours: [{ weekday: 1, start: '08:30', end: '18:00' }] },
      ],
    } as unknown as TenantDetail

    expect(deriveSiteScheduleHours(detail)).toEqual([
      { day: 'Måndag', time: '08:30–18' },
      { day: 'Tisdag', time: '10:30–17' },
      { day: 'Onsdag', time: 'Stängt' },
      { day: 'Torsdag', time: 'Stängt' },
      { day: 'Fredag', time: 'Stängt' },
      { day: 'Lördag', time: 'Stängt' },
      { day: 'Söndag', time: 'Stängt' },
    ])
  })

  it('returns null when no schedules exist', () => {
    expect(deriveSiteScheduleHours({ staffList: [] } as unknown as TenantDetail)).toBeNull()
  })
})

describe('sanitizeSiteSnapshot', () => {
  it('sanerar exakt legacy Snitt-standard men bevarar kundskapad statistik', () => {
    const legacyStats = [
      ['5,0★', 'Snittbetyg'],
      ['Tre', 'Stolar'],
      ['75 min', 'Snitt per besök'],
    ]
    const ownerStats = [['4,8★', 'Verifierat betyg']]

    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      settings: { ...validSnapshot.settings, theme: 'snitt' },
      branding: { stats: legacyStats },
    })?.branding.stats).toEqual([])
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      settings: { ...validSnapshot.settings, theme: 'snitt' },
      branding: { stats: ownerStats },
    })?.branding.stats).toEqual(ownerStats)
  })

  it('normalizes contact links and rejects invalid email/social hrefs', () => {
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      settings: {
        ...validSnapshot.settings,
        contact: { email: ' Hej@example.se ', phone: null },
        social: {
          instagram: ' instagram.com/corevo ',
          facebook: 'https://facebook.com/corevo',
          tiktok: null,
        },
      },
    })?.settings).toMatchObject({
      contact: { email: 'Hej@example.se', phone: null },
      social: {
        instagram: 'https://instagram.com/corevo',
        facebook: 'https://facebook.com/corevo',
        tiktok: null,
      },
    })

    for (const email of ['inte-en-adress', `${'a'.repeat(190)}@example.se`]) {
      expect(sanitizeSiteSnapshot({
        ...validSnapshot,
        settings: { ...validSnapshot.settings, contact: { email, phone: null } },
      })).toBeNull()
    }
    for (const instagram of ['javascript:alert(1)', 'ftp://example.com/corevo', 'https://']) {
      expect(sanitizeSiteSnapshot({
        ...validSnapshot,
        settings: {
          ...validSnapshot.settings,
          social: { ...validSnapshot.settings.social, instagram },
        },
      })).toBeNull()
    }
  })

  it('drops client poison at every owned boundary and keeps the canonical booking shape', () => {
    const sanitized = sanitizeSiteSnapshot({
      ...validSnapshot,
      poison: 'root',
      settings: {
        ...validSnapshot.settings,
        poison: 'settings',
        copy: { heroTitle: 'Hej', poison: 'copy' },
        booking: { ...validSnapshot.settings.booking, poison: 'booking' },
      },
      branding: { ...validSnapshot.branding, team: [{ name: 'Injected' }], poison: 'branding' },
    })
    expect(sanitized).not.toBeNull()
    expect(sanitized?.settings.booking).toEqual(validSnapshot.settings.booking)
    expect(JSON.stringify(sanitized)).not.toMatch(/poison|Injected/)
    expect(sanitized?.branding).not.toHaveProperty('team')
  })

  it('rejects malformed full snapshots instead of coercing arbitrary objects', () => {
    expect(sanitizeSiteSnapshot({ tenant: {}, settings: [], branding: {}, location: {} })).toBeNull()
  })

  it('rejects malformed branding values before they can reach storefront token parsing', () => {
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      branding: { color_accent: {}, logo_url: 'javascript:alert(1)' },
    })).toBeNull()
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      branding: { hero_images: ['https://img/ok.webp', { poison: true }] },
    })).toBeNull()
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      branding: { stats: [['5,0', { poison: true }]] },
    })).toBeNull()
  })

  it('emits the same trimmed, bounded normal form enforced by the database RPCs', () => {
    const sanitized = sanitizeSiteSnapshot({
      ...validSnapshot,
      tenant: { name: ' Studio Norr ' },
      settings: {
        ...validSnapshot.settings,
        contact: { email: '   ', phone: ' 070-1 ' },
        opening_hours: [],
        seo: { title: ' Norr ', description: '' },
      },
      branding: { color_primary: ' #112233 ', font_body: ' Inter ', logo_url: ' /logo.svg ' },
      location: { address: ' Storgatan 1 ' },
    })

    expect(sanitized).toMatchObject({
      tenant: { name: 'Studio Norr' },
      settings: {
        contact: { email: null, phone: '070-1' },
        opening_hours: null,
        seo: { title: 'Norr', description: null },
      },
      branding: { color_primary: '#112233', font_body: 'Inter', logo_url: '/logo.svg' },
      location: { address: 'Storgatan 1' },
    })
  })

  it('rejects values outside the database bounds and unsafe font characters', () => {
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      tenant: { name: 'x'.repeat(201) },
    })).toBeNull()
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      branding: { font_body: 'Inter$' },
    })).toBeNull()
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      settings: { ...validSnapshot.settings, booking: { ...validSnapshot.settings.booking, variant: 'modal' } },
    })).toBeNull()
  })

  it('matches PostgreSQL character counts and JavaScript Unicode whitespace trimming', () => {
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      tenant: { name: '😀'.repeat(200) },
    })?.tenant.name).toBe('😀'.repeat(200))
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      tenant: { name: '😀'.repeat(201) },
    })).toBeNull()
    expect(sanitizeSiteSnapshot({
      ...validSnapshot,
      tenant: { name: '\t\n\u00a0\ufeff' },
    })).toBeNull()
  })
})

describe('loadSiteRevisionState', () => {
  it('reads the tenant draft and latest published history through the provided RLS client', async () => {
    const draft = {
      id: 'draft-1', tenant_id: 'tenant-1', status: 'draft', snapshot: validSnapshot, lock_version: 4,
      source_revision_id: null, created_by: 'u1', updated_by: 'u1', published_by: null,
      created_at: '2026-07-16T10:00:00Z', updated_at: '2026-07-16T11:00:00Z', published_at: null,
    }
    const published = { ...draft, id: 'pub-1', status: 'published', lock_version: 3, published_at: '2026-07-16T09:00:00Z' }
    const calls: Array<{ table: string; filters: unknown[] }> = []
    const from = vi.fn((table: string) => {
      const filters: unknown[] = []
      calls.push({ table, filters })
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (key: string, value: unknown) => (filters.push([key, value]), chain),
        order: () => chain,
        limit: async () => ({ data: [published], error: null }),
        maybeSingle: async () => ({ data: draft, error: null }),
      }
      return chain
    })

    const state = await loadSiteRevisionState({ from } as never, 'tenant-1', { historyLimit: 5 })

    expect(state.draft?.id).toBe('draft-1')
    expect(state.history.map((r) => r.id)).toEqual(['pub-1'])
    expect(calls).toHaveLength(2)
    expect(calls.every((c) => c.table === 'site_revisions')).toBe(true)
    expect(calls.every((c) => c.filters.some((f) => JSON.stringify(f) === '["tenant_id","tenant-1"]'))).toBe(true)
  })

  it('rejects a corrupt persisted snapshot instead of blindly casting it', async () => {
    const row = {
      id: 'draft-bad', tenant_id: 'tenant-1', status: 'draft', snapshot: { poison: true }, lock_version: 1,
      source_revision_id: null, created_by: null, updated_by: null, published_by: null,
      created_at: '2026-07-16T10:00:00Z', updated_at: '2026-07-16T10:00:00Z', published_at: null,
    }
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain, order: () => chain,
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
      }
      return chain
    })
    await expect(loadSiteRevisionState({ from } as never, 'tenant-1')).rejects.toThrow(/snapshot/i)
  })

  it('skips corrupt immutable history without bricking a valid active draft', async () => {
    const good = {
      id: 'pub-good', tenant_id: 'tenant-1', status: 'published', snapshot: validSnapshot, lock_version: 1,
      source_revision_id: null, created_by: null, updated_by: null, published_by: null,
      created_at: '2026-07-16T10:00:00Z', updated_at: '2026-07-16T10:00:00Z', published_at: '2026-07-16T10:00:00Z',
    }
    let read = 0
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {
        select: () => chain, eq: () => chain, order: () => chain,
        limit: async () => ({ data: [{ ...good, id: 'pub-bad', snapshot: { poison: true } }, good], error: null }),
        maybeSingle: async () => ({ data: read++ === 0 ? null : null, error: null }),
      }
      return chain
    })
    const state = await loadSiteRevisionState({ from } as never, 'tenant-1')
    expect(state.history.map((row) => row.id)).toEqual(['pub-good'])
  })
})
