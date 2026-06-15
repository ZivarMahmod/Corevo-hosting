import { describe, it, expect } from 'vitest'
import { modulesForVertical, type VerticalPresetData } from '@/lib/platform/verticals'

// Multi-bransch spår 5 — the bransch → module-preset resolution the wizard uses.
// modulesForVertical is the pure half: catalog modules × the chosen vertical's
// default_modules preset, with sane fallbacks (booking → live, others → off).

const DATA: VerticalPresetData = {
  verticals: [
    {
      key: 'frisör',
      name: 'Frisör',
      defaultTemplate: 'salvia',
      defaultModules: { booking: 'live', loyalty: 'draft', shop: 'off' },
      terminology: { staff: 'Stylist', service: 'Klippning' },
    },
    {
      key: 'restaurang',
      name: 'Restaurang',
      defaultTemplate: null,
      defaultModules: {},
      terminology: {},
    },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'media_library', name: 'Bildbibliotek' },
    { key: 'loyalty', name: 'Lojalitet' },
  ],
  templatesByVertical: {},
}

describe('modulesForVertical', () => {
  it('annotates every catalog module with the chosen vertical preset state', () => {
    const out = modulesForVertical(DATA, 'frisör')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('live') // from preset
    expect(byKey.loyalty).toBe('draft') // from preset
    expect(byKey.media_library).toBe('off') // not in preset → non-booking fallback off
  })

  it('returns ALL catalog modules regardless of preset coverage', () => {
    const out = modulesForVertical(DATA, 'frisör')
    expect(out.map((m) => m.key).sort()).toEqual(['booking', 'loyalty', 'media_library'])
  })

  it('a vertical with an empty preset still floors booking to live, others off', () => {
    const out = modulesForVertical(DATA, 'restaurang')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('live')
    expect(byKey.media_library).toBe('off')
    expect(byKey.loyalty).toBe('off')
  })

  it('no vertical picked (null) → booking live, everything else off', () => {
    const out = modulesForVertical(DATA, null)
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('live')
    expect(byKey.loyalty).toBe('off')
    expect(byKey.media_library).toBe('off')
  })

  it('an unknown vertical key behaves like no preset (booking live, rest off)', () => {
    const out = modulesForVertical(DATA, 'does-not-exist')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('live')
    expect(byKey.loyalty).toBe('off')
  })

  it('preserves module display names from the catalog', () => {
    const out = modulesForVertical(DATA, 'frisör')
    expect(out.find((m) => m.key === 'media_library')?.name).toBe('Bildbibliotek')
  })
})
