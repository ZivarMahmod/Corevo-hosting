import { describe, it, expect } from 'vitest'
import {
  THEME_CONTENT,
  resolveTenantCopy,
  resolveThemeContent,
  type CopyOverride,
} from '@/components/storefront/theme-content'

// M2↔M6 copy-content contract. Owner copy lives in tenant_settings.settings.copy
// and is read here with a defensive per-field fallback to the per-theme default in
// THEME_CONTENT. `parseSettings` (frozen) does NOT validate `copy`, so the object
// reaching these functions is effectively unknown-shaped — these tests pin that
// only a non-empty (post-trim) string overrides; everything else falls back.

const FIELDS = ['heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'tagline', 'italic'] as const

describe('resolveTenantCopy — per-field owner-vs-default fallback', () => {
  it('owner value wins over the theme default for every editable field', () => {
    const copy: CopyOverride = {
      heroEyebrow: '— Min salong',
      heroTitle: 'Egen rubrik',
      heroLede: 'Egen ingress.',
      aboutCopy: 'Egen om-text.',
      tagline: 'Egen tagline',
      italic: 'Egen kursiv fras.',
    }
    const out = resolveTenantCopy('leander', copy)
    expect(out.heroEyebrow).toBe('— Min salong')
    expect(out.heroTitle).toBe('Egen rubrik')
    expect(out.heroLede).toBe('Egen ingress.')
    expect(out.aboutCopy).toBe('Egen om-text.')
    expect(out.tagline).toBe('Egen tagline')
    expect(out.italic).toBe('Egen kursiv fras.')
  })

  it('missing copy (undefined) → all fields fall back to the theme default', () => {
    const base = THEME_CONTENT.salvia
    const out = resolveTenantCopy('salvia', undefined)
    for (const f of FIELDS) expect(out[f]).toBe(base[f])
  })

  it('null copy → all fields fall back to the theme default', () => {
    const base = THEME_CONTENT.zigge
    const out = resolveTenantCopy('zigge', null)
    for (const f of FIELDS) expect(out[f]).toBe(base[f])
  })

  it('empty-string field → theme default (clearing a field reverts to theme copy)', () => {
    const base = THEME_CONTENT.edit
    const out = resolveTenantCopy('edit', { heroTitle: '' })
    expect(out.heroTitle).toBe(base.heroTitle)
  })

  it('whitespace-only field → theme default', () => {
    const base = THEME_CONTENT.linnea
    const out = resolveTenantCopy('linnea', { heroLede: '   \n  \t ' })
    expect(out.heroLede).toBe(base.heroLede)
  })

  it('a subset override leaves the untouched fields at the theme default', () => {
    const base = THEME_CONTENT.leander
    const out = resolveTenantCopy('leander', { tagline: 'Bara tagline' })
    expect(out.tagline).toBe('Bara tagline')
    expect(out.heroTitle).toBe(base.heroTitle)
    expect(out.italic).toBe(base.italic)
  })

  it('non-string values (number/object/array) are rejected → theme default', () => {
    const base = THEME_CONTENT.salvia
    // Simulate malformed jsonb that frozen parseSettings does not validate.
    const malformed = { heroTitle: 42, heroLede: {}, tagline: ['x'] } as unknown as CopyOverride
    const out = resolveTenantCopy('salvia', malformed)
    expect(out.heroTitle).toBe(base.heroTitle)
    expect(out.heroLede).toBe(base.heroLede)
    expect(out.tagline).toBe(base.tagline)
  })

  it('preserves an internal newline in an owner heroTitle (only outer whitespace trims the check)', () => {
    const out = resolveTenantCopy('edit', { heroTitle: '  Rad ett\nRad två  ' })
    // Used verbatim — leading/trailing space and the inner \n are preserved.
    expect(out.heroTitle).toBe('  Rad ett\nRad två  ')
    expect(out.heroTitle).toContain('\n')
  })
})

describe('resolveThemeContent — copy override threaded through', () => {
  it('drops only the exact saved legacy Snitt fact triple', () => {
    const legacy = [
      ['5,0★', 'Snittbetyg'],
      ['Tre', 'Stolar'],
      ['75 min', 'Snitt per besök'],
    ] as [string, string][]
    const ownerStats = [
      ['4,8★', 'Verifierat betyg'],
      ['Fyra', 'Stolar'],
    ] as [string, string][]

    expect(resolveThemeContent('snitt', { stats: legacy }).stats).toEqual([])
    expect(resolveThemeContent('snitt', { stats: ownerStats }).stats).toEqual(ownerStats)
    expect(resolveThemeContent('salvia', { stats: legacy }).stats).toEqual(legacy)
  })

  it('without the 3rd arg, behaves exactly as before (theme-default copy)', () => {
    const base = THEME_CONTENT.leander
    const out = resolveThemeContent('leander', null)
    for (const f of FIELDS) expect(out[f]).toBe(base[f])
    // Media still falls back to the theme default when no branding is supplied.
    expect(out.heroImages).toEqual(base.heroImages)
  })

  it('owner copy override wins while theme media defaults are preserved', () => {
    const base = THEME_CONTENT.zigge
    const out = resolveThemeContent('zigge', null, { heroTitle: 'Override', italic: 'Min fras' })
    expect(out.heroTitle).toBe('Override')
    expect(out.italic).toBe('Min fras')
    // Un-overridden copy fields keep the theme default…
    expect(out.heroEyebrow).toBe(base.heroEyebrow)
    // …and media is untouched by copy resolution.
    expect(out.heroImages).toEqual(base.heroImages)
    // Team is owner-only now (no stock-face default) → empty when no branding.team.
    expect(out.team).toEqual([])
  })

  it('team is owner-only — no theme stock default, blank-name entries dropped', () => {
    // No branding.team → empty (layout hides the section), NOT the stock default.
    expect(resolveThemeContent('salvia', null).team).toEqual([])
    expect(resolveThemeContent('salvia', { team: [] }).team).toEqual([])
    // Real owner-uploaded members pass through; blank/nameless entries are filtered.
    const owner = [
      { name: 'Anna', role: 'Frisör', img: 'https://pub-test.r2.dev/t/anna.png' },
      { name: '   ', role: 'x', img: 'y' },
    ]
    expect(resolveThemeContent('salvia', { team: owner }).team).toEqual([owner[0]])
  })

  it('owner branding media and owner copy compose without clobbering each other', () => {
    const out = resolveThemeContent(
      'salvia',
      { hero_images: ['https://pub-test.r2.dev/t/hero.png'] },
      { tagline: 'Komponerad tagline' },
    )
    expect(out.heroImages).toEqual(['https://pub-test.r2.dev/t/hero.png'])
    expect(out.tagline).toBe('Komponerad tagline')
  })

  it('empty/whitespace copy fields fall back even when the 3rd arg is present', () => {
    const base = THEME_CONTENT.linnea
    const out = resolveThemeContent('linnea', null, { heroTitle: '   ', heroLede: '' })
    expect(out.heroTitle).toBe(base.heroTitle)
    expect(out.heroLede).toBe(base.heroLede)
  })

  it('keeps the home image caption separate from the gallery-page eyebrow', () => {
    const separated = resolveThemeContent('onyx', null, {
      homeGalleryEyebrow: 'STARTSIDANS FIGURTEXT',
      galleryEyebrow: 'GALLERISIDANS EYEBROW',
    })
    expect(separated.homeGalleryEyebrow).toBe('STARTSIDANS FIGURTEXT')
    expect(separated.galleryEyebrow).toBe('GALLERISIDANS EYEBROW')

    // Äldre sparningar hade bara galleryEyebrow. De fortsätter påverka hemmet tills
    // ägaren sparar den nya startsidesnyckeln, så ändringen kräver ingen migration.
    const legacy = resolveThemeContent('onyx', null, { galleryEyebrow: 'GAMMAL TEXT' })
    expect(legacy.homeGalleryEyebrow).toBe('GAMMAL TEXT')
  })
})
