// load-team: tenant-stängslet + de två sanningsflaggorna (active && show_on_site) +
// tom lista som giltigt svar. INGEN modul-gate — teamet är kundens folk, inte en modul.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}))

const calls: { table: string; eq: [string, unknown][] }[] = []
let staffRows: unknown[] = []

function chain(table: string, rows: unknown) {
  const rec: { table: string; eq: [string, unknown][] } = { table, eq: [] }
  calls.push(rec)
  const q: Record<string, unknown> = {}
  const self = () => q
  q.select = self
  q.order = self
  q.eq = (col: string, val: unknown) => {
    rec.eq.push([col, val])
    return q
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return q
}

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({ from: (table: string) => chain(table, staffRows) }),
}))

const { loadTeamMembers } = await import('./load-team')

beforeEach(() => {
  calls.length = 0
  staffRows = []
})

describe('loadTeamMembers', () => {
  it('TENANT-STÄNGSEL + de två flaggorna: tenant_id, active och show_on_site filtreras i app-lagret', async () => {
    await loadTeamMembers('t1', 'Salong')
    const q = calls.find((c) => c.table === 'staff')!
    // anon-RLS isolerar INTE tenants → .eq('tenant_id') ÄR grinden.
    expect(q.eq).toContainEqual(['tenant_id', 't1'])
    expect(q.eq).toContainEqual(['active', true])
    expect(q.eq).toContainEqual(['show_on_site', true])
  })

  it('TOM LISTA är ett giltigt svar (ingen synlig personal → inget team renderas)', async () => {
    staffRows = []
    expect(await loadTeamMembers('t1', 'salong')).toEqual([])
  })

  it('mappar presentationsfälten; blanka fält blir null (render-on-present, aldrig påhitt)', async () => {
    staffRows = [
      {
        id: 's1',
        title: 'Vera Lund',
        short_name: 'Vera',
        specialties: 'Korta klipp · Siluetter',
        bio: 'Tio år i yrket.',
        avatar_url: 'https://cdn/v.jpg',
      },
      {
        id: 's2',
        title: 'Ola Berg',
        short_name: '   ', // bara whitespace → null, inte en tom rad på sidan
        specialties: null,
        bio: null,
        avatar_url: null,
      },
    ]
    const members = await loadTeamMembers('t1', 'salong')
    expect(members[0]).toEqual({
      id: 's1',
      name: 'Vera Lund',
      shortName: 'Vera',
      title: 'Vera Lund',
      specialties: 'Korta klipp · Siluetter',
      bio: 'Tio år i yrket.',
      imageUrl: 'https://cdn/v.jpg',
    })
    expect(members[1]!.shortName).toBeNull()
    expect(members[1]!.bio).toBeNull()
    expect(members[1]!.imageUrl).toBeNull()
  })

  it('en NAMNLÖS rad utelämnas — "Namnlös medarbetare" är ingen person besökaren kan möta', async () => {
    staffRows = [
      { id: 's1', title: null, short_name: null, specialties: null, bio: null, avatar_url: null },
      { id: 's2', title: 'Vera', short_name: null, specialties: null, bio: null, avatar_url: null },
    ]
    const members = await loadTeamMembers('t1', 'salong')
    expect(members.map((m) => m.id)).toEqual(['s2'])
  })
})
