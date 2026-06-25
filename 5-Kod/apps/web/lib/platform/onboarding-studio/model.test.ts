import { describe, it, expect } from 'vitest'
import { initStudioCfg, applyBranch, resolveModuleState, studioSlugify } from './model'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

// Minimal real-shaped presets: VerticalPreset has NO hero/services/defaultPos (those
// were cfg-data mockup) — only key/name/defaultTemplate/defaultModules/terminology.
const presets: VerticalPresetData = {
  verticals: [
    {
      key: 'frisor',
      name: 'Frisörsalong',
      defaultTemplate: 'salvia',
      defaultModules: { booking: 'live', lojalitet: 'live', presentkort: 'live' },
      terminology: { service: 'Behandling' },
    },
    { key: 'generell', name: 'Generell', defaultTemplate: null, defaultModules: {}, terminology: {} },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'lojalitet', name: 'Lojalitet' },
    { key: 'shop', name: 'Webshop' },
  ],
  templatesByVertical: { generell: [{ key: 'edit', name: 'Edit' }] },
}

describe('initStudioCfg', () => {
  it('starts with no bransch, empty fields and the given default theme', () => {
    const cfg = initStudioCfg('salvia')
    expect(cfg.branch).toBeNull()
    expect(cfg.name).toBe('')
    expect(cfg.slug).toBe('')
    expect(cfg.theme).toBe('salvia')
    expect(cfg.moduleStates).toEqual({})
    expect(cfg.ownerEmail).toBe('')
  })
})

describe('applyBranch', () => {
  it('sets the bransch, prefills the theme from defaultTemplate and seeds module states', () => {
    const cfg = applyBranch(initStudioCfg('salvia'), 'frisor', presets)
    expect(cfg.branch).toBe('frisor')
    expect(cfg.theme).toBe('salvia')
    expect(cfg.moduleStates.booking).toBe('live')
    expect(cfg.moduleStates.lojalitet).toBe('live')
    // not in the bransch preset → modulesForVertical fallback 'off'
    expect(cfg.moduleStates.shop).toBe('off')
  })

  it('falls back to the first bransch-filtered template when defaultTemplate is null', () => {
    const cfg = applyBranch(initStudioCfg('salvia'), 'generell', presets)
    expect(cfg.branch).toBe('generell')
    expect(cfg.theme).toBe('edit') // templatesByVertical.generell[0]
  })

  it('keeps the current theme when the bransch has neither defaultTemplate nor templates', () => {
    const bare: VerticalPresetData = { ...presets, templatesByVertical: {} }
    const cfg = applyBranch(initStudioCfg('salvia'), 'generell', bare)
    expect(cfg.theme).toBe('salvia')
  })
})

describe('resolveModuleState', () => {
  it('floors booking to live even when its stored state is off', () => {
    const cfg = { ...initStudioCfg('salvia'), moduleStates: { booking: 'off' as const } }
    expect(resolveModuleState(cfg, 'booking', presets)).toBe('live')
  })

  it('lets booking sit at paused', () => {
    const cfg = { ...initStudioCfg('salvia'), moduleStates: { booking: 'paused' as const } }
    expect(resolveModuleState(cfg, 'booking', presets)).toBe('paused')
  })

  it('returns a non-booking module state as picked, else off', () => {
    const cfg = applyBranch(initStudioCfg('salvia'), 'frisor', presets)
    expect(resolveModuleState(cfg, 'lojalitet', presets)).toBe('live')
    expect(resolveModuleState(cfg, 'shop', presets)).toBe('off')
  })
})

describe('studioSlugify', () => {
  it('mirrors the existing wizard slugify (lowercase, non-alnum → dash, trimmed)', () => {
    expect(studioSlugify('Klippoteket')).toBe('klippoteket')
    expect(studioSlugify('My Salon!!')).toBe('my-salon')
    expect(studioSlugify('  Hej  ')).toBe('hej')
  })
})
