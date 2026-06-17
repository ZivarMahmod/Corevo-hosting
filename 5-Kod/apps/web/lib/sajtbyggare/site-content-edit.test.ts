// Spar-kärna (Sajtbyggare S2) — fail-closed + region-granulär merge, utan Supabase.

import { describe, expect, it } from 'vitest'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'
import { applySiteContentEdits } from './site-content-edit'

const M = SALVIA_REGION_MANIFEST

describe('applySiteContentEdits — text → settings.copy', () => {
  it('writes a sanitized TEXT override into settings.copy.<field>', () => {
    const r = applySiteContentEdits(M, null, null, [{ regionKey: 'hero.title', value: 'Ny <strong>rubrik</strong>' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect((r.settings.copy as Record<string, unknown>).heroTitle).toBe('Ny <strong>rubrik</strong>')
  })

  it('strips XSS from a TEXT value but still saves (text is always ok)', () => {
    const r = applySiteContentEdits(M, null, null, [
      { regionKey: 'about.copy', value: 'Hej<script>alert(1)</script>' },
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const v = (r.settings.copy as Record<string, unknown>).aboutCopy as string
    expect(v).toContain('Hej')
    expect(v.toLowerCase()).not.toContain('<script')
  })

  it('empty TEXT value clears the override (→ falls back via resolver)', () => {
    const r = applySiteContentEdits(M, { copy: { heroTitle: 'gammal' } }, null, [
      { regionKey: 'hero.title', value: '   ' },
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect((r.settings.copy as Record<string, unknown>).heroTitle).toBe('')
  })
})

describe('applySiteContentEdits — branding (color/font/logo/image)', () => {
  it('writes a valid colour into branding.<field>', () => {
    const r = applySiteContentEdits(M, null, null, [{ regionKey: 'color.primary', value: '#112233' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.branding.color_primary).toBe('#112233')
  })

  it('FAIL-CLOSED: an invalid colour rejects the whole save (writes nothing)', () => {
    const r = applySiteContentEdits(M, null, null, [
      { regionKey: 'hero.title', value: 'ok' },
      { regionKey: 'color.primary', value: 'red;}body{display:none' },
    ])
    expect(r.ok).toBe(false)
  })

  it('FAIL-CLOSED: a javascript: image URL rejects the save', () => {
    const r = applySiteContentEdits(M, null, null, [
      { regionKey: 'hero.image', value: 'javascript:alert(1)' },
    ])
    expect(r.ok).toBe(false)
  })

  it('FAIL-CLOSED: a CSS-breaking font rejects the save', () => {
    const r = applySiteContentEdits(M, null, null, [{ regionKey: 'font.body', value: 'x;}body{}' }])
    expect(r.ok).toBe(false)
  })

  it('array-bound image (hero.image → hero_images[0]) writes index 0, preserves index 1', () => {
    const r = applySiteContentEdits(M, null, { hero_images: ['old0', 'keep1'] }, [
      { regionKey: 'hero.image', value: 'https://cdn/new0.jpg' },
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.branding.hero_images).toEqual(['https://cdn/new0.jpg', 'keep1'])
  })

  it('clearing hero.image when it is the ONLY image removes the field (→ theme default), never [null]', () => {
    const r = applySiteContentEdits(M, null, { hero_images: ['only'] }, [{ regionKey: 'hero.image', value: '' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // never [null] (would render a broken <img>); field gone → resolveThemeContent falls back
    expect('hero_images' in r.branding).toBe(false)
  })

  it('clearing hero.image when others exist splices index 0 (promotes the next image)', () => {
    const r = applySiteContentEdits(M, null, { hero_images: ['a', 'b'] }, [{ regionKey: 'hero.image', value: '' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.branding.hero_images).toEqual(['b'])
  })

  it('logo URL (https) is accepted', () => {
    const r = applySiteContentEdits(M, null, null, [{ regionKey: 'logo', value: 'https://cdn/logo.png' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.branding.logo_url).toBe('https://cdn/logo.png')
  })
})

describe('applySiteContentEdits — fences + preservation', () => {
  it('FAIL-CLOSED: an unknown region key rejects the save', () => {
    const r = applySiteContentEdits(M, null, null, [{ regionKey: 'hero.NOPE', value: 'x' }])
    expect(r.ok).toBe(false)
  })

  it('preserves unrelated settings + branding keys (region-granular merge)', () => {
    const r = applySiteContentEdits(
      M,
      { layout: 'wide', copy: { heroLede: 'behåll' } },
      { color_bg: '#F6F4EE', hero_images: ['a'] },
      [{ regionKey: 'hero.title', value: 'ny' }, { regionKey: 'color.primary', value: '#000' }],
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.settings.layout).toBe('wide') // unrelated settings key kept
    expect((r.settings.copy as Record<string, unknown>).heroLede).toBe('behåll') // unrelated copy field kept
    expect((r.settings.copy as Record<string, unknown>).heroTitle).toBe('ny')
    expect(r.branding.color_bg).toBe('#F6F4EE') // unrelated branding key kept
    expect(r.branding.color_primary).toBe('#000')
  })

  it('does not mutate the caller-provided prev objects', () => {
    const prevSettings = { copy: { heroTitle: 'orig' } }
    const prevBranding = { color_bg: '#fff' }
    applySiteContentEdits(M, prevSettings, prevBranding, [{ regionKey: 'hero.title', value: 'ny' }])
    expect(prevSettings.copy.heroTitle).toBe('orig')
    expect(prevBranding.color_bg).toBe('#fff')
  })
})
