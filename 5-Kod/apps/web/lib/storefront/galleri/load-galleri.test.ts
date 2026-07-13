// load-galleri: modul-gaten (ingen modulrad → null), tenant-stängslet (varje query
// MÅSTE filtrera på tenant_id — anon-RLS isolerar INTE) och tomma listan som giltigt svar.
//
// unstable_cache stubbas till en genomskinlig pass-through (samma trick som resten av
// storefront-testerna behöver): funktionen ska köras direkt, inte cachas.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown) => fn,
}))

/** Alla .eq()-anrop som gjordes, per tabell — bevisar tenant-stängslet. */
const calls: { table: string; eq: [string, unknown][] }[] = []

/** En kedjebar fejk-query som samlar .eq/.order och löser ut till `rows`. */
function chain(table: string, rows: unknown, single = false) {
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
  q.maybeSingle = async () => ({ data: rows, error: null })
  // Non-single queries are awaited directly → make the object thenable.
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null })
  return single ? q : q
}

let moduleRow: unknown = { config: {} }
let itemRows: unknown[] = []

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: (table: string) =>
      table === 'tenant_modules' ? chain(table, moduleRow, true) : chain(table, itemRows),
  }),
}))

const { loadGalleriData } = await import('./load-galleri')

beforeEach(() => {
  calls.length = 0
  moduleRow = { config: {} }
  itemRows = []
})

describe('loadGalleriData', () => {
  it('MODUL-GATE: ingen tenant_modules-rad → null (inget att rendera)', async () => {
    moduleRow = null
    expect(await loadGalleriData('t1', 'salong')).toBeNull()
  })

  it('TENANT-STÄNGSEL: både modul- och bild-queryn filtrerar på tenant_id i app-lagret', async () => {
    await loadGalleriData('t1', 'Salong')

    const modQ = calls.find((c) => c.table === 'tenant_modules')!
    expect(modQ.eq).toContainEqual(['tenant_id', 't1'])
    expect(modQ.eq).toContainEqual(['module_key', 'galleri'])

    const itemQ = calls.find((c) => c.table === 'gallery_items')!
    expect(itemQ.eq).toContainEqual(['tenant_id', 't1'])
    // Publikt visas bara aktiva bilder (RLS är djupförsvar, app-lagret är grinden).
    expect(itemQ.eq).toContainEqual(['active', true])
  })

  it('TOM LISTA är ett giltigt svar (modulen finns, kunden har inga bilder än)', async () => {
    itemRows = []
    const data = await loadGalleriData('t1', 'salong')
    expect(data).toEqual({ items: [] })
  })

  it('mappar raden + joinar bilden ur media_assets; saknade fält blir null (aldrig påhitt)', async () => {
    itemRows = [
      {
        id: 'g1',
        caption: 'samling nr 13',
        tag: 'Klipp',
        year_label: 'juni 2026',
        aspect_ratio: '3/2',
        media_assets: { url: 'https://cdn/1.jpg', alt: 'ranunkel' },
      },
      // Array-formen (Supabase typar relationen olika beroende på FK-kardinalitet) +
      // helt tomma presentationsfält.
      {
        id: 'g2',
        caption: null,
        tag: null,
        year_label: null,
        aspect_ratio: null,
        media_assets: [{ url: 'https://cdn/2.jpg', alt: null }],
      },
    ]
    const data = await loadGalleriData('t1', 'salong')
    expect(data!.items[0]).toEqual({
      id: 'g1',
      imageUrl: 'https://cdn/1.jpg',
      imageAlt: 'ranunkel',
      caption: 'samling nr 13',
      tag: 'Klipp',
      yearLabel: 'juni 2026',
      aspectRatio: '3/2',
    })
    expect(data!.items[1]).toEqual({
      id: 'g2',
      imageUrl: 'https://cdn/2.jpg',
      imageAlt: null,
      caption: null,
      tag: null,
      yearLabel: null,
      aspectRatio: null,
    })
  })
})
