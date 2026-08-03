import { describe, it, expect } from 'vitest'
import {
  modulesForVertical,
  type VerticalPresetData,
} from '@/lib/platform/verticals-shared'

// Multi-bransch spår 5 — the bransch → module-preset resolution the wizard uses.
// modulesForVertical is the pure half: catalog modules × the chosen vertical's
// default_modules preset, with off as the fallback.

const DATA: VerticalPresetData = {
  verticals: [
    {
      key: 'frisör',
      name: 'Frisör',
      defaultTemplate: 'salvia',
      defaultModules: { booking: 'live', lojalitet: 'live', shop: 'off' },
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
    { key: 'lojalitet', name: 'Lojalitet' },
  ],
  templatesByVertical: {},
}

describe('modulesForVertical', () => {
  it('annotates every catalog module with the chosen vertical preset state', () => {
    const out = modulesForVertical(DATA, 'frisör')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('live') // from preset
    expect(byKey.lojalitet).toBe('live') // from preset
    expect(byKey.media_library).toBe('off') // not in preset → non-booking fallback off
  })

  it('returns ALL catalog modules regardless of preset coverage', () => {
    const out = modulesForVertical(DATA, 'frisör')
    expect(out.map((m) => m.key).sort()).toEqual(['booking', 'lojalitet', 'media_library'])
  })

  it('a vertical with an empty preset keeps every module off', () => {
    const out = modulesForVertical(DATA, 'restaurang')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('off')
    expect(byKey.media_library).toBe('off')
    expect(byKey.lojalitet).toBe('off')
  })

  it('no vertical picked means every module is off', () => {
    const out = modulesForVertical(DATA, null)
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('off')
    expect(byKey.lojalitet).toBe('off')
    expect(byKey.media_library).toBe('off')
  })

  it('an unknown vertical key behaves like no preset', () => {
    const out = modulesForVertical(DATA, 'does-not-exist')
    const byKey = Object.fromEntries(out.map((m) => [m.key, m.defaultState]))
    expect(byKey.booking).toBe('off')
    expect(byKey.lojalitet).toBe('off')
  })

  it('preserves module display names from the catalog', () => {
    const out = modulesForVertical(DATA, 'frisör')
    expect(out.find((m) => m.key === 'media_library')?.name).toBe('Bildbibliotek')
  })
})
