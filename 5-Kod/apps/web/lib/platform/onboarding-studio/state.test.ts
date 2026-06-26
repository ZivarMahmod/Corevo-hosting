import { describe, it, expect } from 'vitest'
import { initStudioCfg, applyBranch } from './model'
import { makeStudioReducer, buildCreateTenantFormData } from './state'
import type { VerticalPresetData } from '@/lib/platform/verticals-shared'

// Same minimal real-shaped presets as model.test.ts (VerticalPreset has only
// key/name/defaultTemplate/defaultModules/terminology — no hero/services/defaultPos).
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

const reducer = makeStudioReducer(presets)

describe('makeStudioReducer — slug auto-sync + slugTouched lock', () => {
  it('auto-syncs the slug from the name while slugTouched is false', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'setName', value: 'Klippoteket' })
    expect(cfg.name).toBe('Klippoteket')
    expect(cfg.slug).toBe('klippoteket')
    expect(cfg.slugTouched).toBe(false)
  })

  it('locks the slug once edited by hand — later name edits never clobber it', () => {
    let cfg = reducer(initStudioCfg('salvia'), { type: 'setSlug', value: 'min-salong' })
    expect(cfg.slug).toBe('min-salong')
    expect(cfg.slugTouched).toBe(true)
    // a subsequent name edit updates the name but NOT the hand-typed slug
    cfg = reducer(cfg, { type: 'setName', value: 'Helt Annat Namn' })
    expect(cfg.name).toBe('Helt Annat Namn')
    expect(cfg.slug).toBe('min-salong')
  })

  it('applyBranch delegates to the model (seeds theme + module states)', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'applyBranch', key: 'frisor' })
    expect(cfg.branch).toBe('frisor')
    expect(cfg.theme).toBe('salvia')
    expect(cfg.moduleStates.lojalitet).toBe('live')
  })

  it('setModule records a module state on the cfg', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'setModule', key: 'shop', state: 'live' })
    expect(cfg.moduleStates.shop).toBe('live')
  })

  it('setVariant records the chosen booking variant (W3)', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'setVariant', variant: 'compact' })
    expect(cfg.variant).toBe('compact')
  })
})

describe('buildCreateTenantFormData — the Lansera FormData contract (§6)', () => {
  it('emits the required name + slug and the chosen theme', () => {
    const cfg = { ...initStudioCfg('salvia'), name: 'Klippoteket', slug: 'klippoteket' }
    const fd = buildCreateTenantFormData(cfg)
    expect(fd.get('name')).toBe('Klippoteket')
    expect(fd.get('slug')).toBe('klippoteket')
    expect(fd.get('theme')).toBe('salvia')
    expect(fd.get('booking_variant')).toBe('wizard') // cfg.variant default
  })

  it('emits the operator-picked booking_variant (W3 — no longer hardcoded)', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'setVariant', variant: 'compact' })
    expect(buildCreateTenantFormData(cfg).get('booking_variant')).toBe('compact')
  })

  it('floors booking to live in the modules JSON even when stored off', () => {
    // setModule booking → off, then build: the FormData modules map floors it to live.
    const cfg = reducer(applyBranch(initStudioCfg('salvia'), 'frisor', presets), {
      type: 'setModule',
      key: 'booking',
      state: 'off',
    })
    const fd = buildCreateTenantFormData(cfg)
    const modules = JSON.parse(String(fd.get('modules'))) as Record<string, string>
    expect(modules.booking).toBe('live')
    expect(modules.lojalitet).toBe('live')
  })

  it('keeps booking at paused when explicitly paused', () => {
    const cfg = reducer(initStudioCfg('salvia'), { type: 'setModule', key: 'booking', state: 'paused' })
    const fd = buildCreateTenantFormData(cfg)
    const modules = JSON.parse(String(fd.get('modules'))) as Record<string, string>
    expect(modules.booking).toBe('paused')
  })

  it('omits color_accent when no accent is picked, includes it when set', () => {
    const noAccent = buildCreateTenantFormData(initStudioCfg('salvia'))
    expect(noAccent.has('color_accent')).toBe(false)

    const withAccent = buildCreateTenantFormData({ ...initStudioCfg('salvia'), accent: '#5E7361' })
    expect(withAccent.get('color_accent')).toBe('#5E7361')
  })

  it('includes the fixed owner_role + empty site_content_draft hidden fields', () => {
    const fd = buildCreateTenantFormData(initStudioCfg('salvia'))
    expect(fd.get('owner_role')).toBe('salon_admin')
    expect(fd.get('site_content_draft')).toBe('{}')
  })

  it('emits vertical_id always (empty string when no bransch picked)', () => {
    const fd = buildCreateTenantFormData(initStudioCfg('salvia'))
    expect(fd.get('vertical_id')).toBe('')
    const fd2 = buildCreateTenantFormData({ ...initStudioCfg('salvia'), branch: 'frisor' })
    expect(fd2.get('vertical_id')).toBe('frisor')
  })
})
