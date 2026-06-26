import { describe, it, expect } from 'vitest'
import { applySkinOverlay } from './overlay'
import { SALVIA_REGION_MANIFEST } from '@/lib/sajtbyggare/manifest/salvia'
import type { ResolvedSkin, ResolvedSlot } from './types'

// Build a minimal ResolvedSkin from a slot_key → ResolvedSlot map. `authored`
// defaults to ALL provided keys (they represent tenant content); pass an explicit
// subset to simulate a slot that resolved from a TEMPLATE DEFAULT (present value but
// NOT tenant-authored) — that must never override the base.
function skin(slots: Record<string, ResolvedSlot>, authored: string[] = Object.keys(slots)): ResolvedSkin {
  return {
    templateKey: 'salvia',
    tokens: {},
    cssVars: {},
    slots,
    sections: [],
    hasTenantContent: authored.length > 0,
    authoredSlotKeys: authored,
  }
}
const text = (slotKey: string, t: string | null): ResolvedSlot => ({ kind: 'text', slotKey, value: t, text: t })
const asset = (slotKey: string, url: string | null): ResolvedSlot => ({
  kind: 'asset', slotKey, assetId: url ? 'a1' : null, url, alt: null, width: null, height: null, defaultAssetKey: null,
})

const M = SALVIA_REGION_MANIFEST

describe('applySkinOverlay (content_slots → layout, content wins)', () => {
  it('text slot overrides the bound copy field; base copy preserved elsewhere', () => {
    const out = applySkinOverlay(skin({ 'hero.title': text('hero.title', 'Ny rubrik') }), M,
      { heroTitle: 'gammal', heroLede: 'behåll' }, {})
    expect(out.copy.heroTitle).toBe('Ny rubrik') // content wins over base
    expect(out.copy.heroLede).toBe('behåll') // untouched
  })

  it('asset slot with index writes branding.hero_images[0], preserving other indices', () => {
    const out = applySkinOverlay(skin({ 'hero.image': asset('hero.image', 'https://cdn/h.jpg') }), M,
      null, { hero_images: ['OLD0', 'KEEP1'] })
    expect(out.branding.hero_images).toEqual(['https://cdn/h.jpg', 'KEEP1'])
  })

  it('asset slot without index writes the scalar branding field', () => {
    const out = applySkinOverlay(skin({ 'about.image': asset('about.image', 'https://cdn/a.jpg') }), M,
      null, { about_image: 'old', color_bg: '#fff' })
    expect(out.branding.about_image).toBe('https://cdn/a.jpg')
    expect(out.branding.color_bg).toBe('#fff') // unrelated branding untouched
  })

  it('absent/empty resolved values never override the base', () => {
    const out = applySkinOverlay(skin({ 'hero.title': text('hero.title', null), 'hero.image': asset('hero.image', null) }), M,
      { heroTitle: 'kvar' }, { hero_images: ['kvar0'] })
    expect(out.copy.heroTitle).toBe('kvar')
    expect(out.branding.hero_images).toEqual(['kvar0'])
  })

  it('a PRESENT value from a template default (not authored) never overrides the base', () => {
    // Slot resolves to a present value but the tenant did NOT author it (authored=[]).
    // This is the landmine the provenance gate closes: present ≠ tenant-authored.
    const out = applySkinOverlay(
      skin({ 'hero.title': text('hero.title', 'MALL-DEFAULT') }, []),
      M,
      { heroTitle: 'tenant_settings-värde' },
      {},
    )
    expect(out.copy.heroTitle).toBe('tenant_settings-värde') // base wins, default ignored
  })

  it('does not mutate the input copy/branding objects', () => {
    const baseCopy = { heroTitle: 'a' }
    const baseBranding = { about_image: 'b' }
    applySkinOverlay(skin({ 'hero.title': text('hero.title', 'X'), 'about.image': asset('about.image', 'Y') }), M, baseCopy, baseBranding)
    expect(baseCopy).toEqual({ heroTitle: 'a' })
    expect(baseBranding).toEqual({ about_image: 'b' })
  })

  it('a content_slot key with no manifest region (color/font handled elsewhere) is a no-op, no crash', () => {
    // color.primary IS a manifest region but binds to branding (a token, not a text/asset
    // slot value here) — feeding a stray slot must not throw.
    const out = applySkinOverlay(skin({ 'unknown.slot': text('unknown.slot', 'ignored') }), M, { heroTitle: 'base' }, {})
    expect(out.copy.heroTitle).toBe('base')
    expect(out.copy.unknownSlot).toBeUndefined()
  })
})
