import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from '@/components/storefront/theme-content'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'
import type { CascadeInput, ResolvedRegion } from './resolve'
import { resolveRegion, resolveSiteContent } from './resolve'

/** Empty cascade input (no vertical defaults, no tenant overrides). */
const EMPTY: CascadeInput = { verticalDefaults: {}, tenantCopy: null, tenantBranding: null }

const find = (rows: ResolvedRegion[], key: string): ResolvedRegion => {
  const r = rows.find((x) => x.key === key)
  if (!r) throw new Error(`resolved region missing: ${key}`)
  return r
}
const region = (key: string) => {
  const r = SALVIA_REGION_MANIFEST.regions.find((x) => x.key === key)
  if (!r) throw new Error(`manifest region missing: ${key}`)
  return r
}

describe('resolveRegion — three-layer cascade + provenance', () => {
  it('Universal: no vertical, no tenant → theme default, source universal, standard', () => {
    const r = resolveRegion(region('hero.title'), EMPTY)
    expect(r.value).toBe(THEME_CONTENT.salvia.heroTitle)
    expect(r.source).toBe('universal')
    expect(r.provenance).toBe('standard')
  })

  it('Bransch: vertical default present, no tenant → vertical value, source vertical, STILL standard', () => {
    const r = resolveRegion(region('hero.eyebrow'), {
      ...EMPTY,
      verticalDefaults: { 'hero.eyebrow': '— Barbershop' },
    })
    expect(r.value).toBe('— Barbershop')
    expect(r.source).toBe('vertical')
    expect(r.provenance).toBe('standard') // inherited, not tenant-modified
  })

  it('Kund: tenant copy override wins over vertical + universal → modifierad', () => {
    const r = resolveRegion(region('hero.title'), {
      verticalDefaults: { 'hero.title': 'Bransch-rubrik' },
      tenantCopy: { heroTitle: 'Min egen rubrik' },
      tenantBranding: null,
    })
    expect(r.value).toBe('Min egen rubrik')
    expect(r.source).toBe('tenant')
    expect(r.provenance).toBe('modifierad')
  })

  it('Kund branding (colour) override → modifierad', () => {
    const r = resolveRegion(region('color.primary'), {
      ...EMPTY,
      tenantBranding: { color_primary: '#112233' },
    })
    expect(r.value).toBe('#112233')
    expect(r.source).toBe('tenant')
    expect(r.provenance).toBe('modifierad')
  })

  it('Kund branding ARRAY override reads the bound index (hero_images[0]) → modifierad', () => {
    const r = resolveRegion(region('hero.image'), {
      ...EMPTY,
      tenantBranding: { hero_images: ['https://cdn/own-hero.jpg', 'https://cdn/second.jpg'] },
    })
    expect(r.value).toBe('https://cdn/own-hero.jpg')
    expect(r.source).toBe('tenant')
    expect(r.provenance).toBe('modifierad')
  })

  it('blank/whitespace tenant value is NOT an override → falls through to inherited', () => {
    const blank = resolveRegion(region('hero.title'), { ...EMPTY, tenantCopy: { heroTitle: '   ' } })
    expect(blank.source).toBe('universal')
    expect(blank.provenance).toBe('standard')
    expect(blank.value).toBe(THEME_CONTENT.salvia.heroTitle)
  })

  it('non-string tenant value (number/null) is ignored → inherited', () => {
    const num = resolveRegion(region('hero.title'), { ...EMPTY, tenantCopy: { heroTitle: 42 } })
    expect(num.source).toBe('universal')
    const nul = resolveRegion(region('color.bg'), { ...EMPTY, tenantBranding: { color_bg: null } })
    expect(nul.source).toBe('universal')
  })

  it('empty vertical value falls through to universal', () => {
    const r = resolveRegion(region('hero.lede'), { ...EMPTY, verticalDefaults: { 'hero.lede': '  ' } })
    expect(r.source).toBe('universal')
    expect(r.value).toBe(THEME_CONTENT.salvia.heroLede)
  })

  it('logo with no override + no vertical → value null, source universal, standard', () => {
    const r = resolveRegion(region('logo'), EMPTY)
    expect(r.value).toBeNull()
    expect(r.source).toBe('universal')
    expect(r.provenance).toBe('standard')
  })

  it('non-array branding value for an indexed binding is ignored → inherited', () => {
    const r = resolveRegion(region('hero.image'), {
      ...EMPTY,
      tenantBranding: { hero_images: 'not-an-array' },
    })
    expect(r.source).toBe('universal')
    expect(r.value).toBe(THEME_CONTENT.salvia.heroImages[0])
  })
})

describe('resolveSiteContent — full manifest pass', () => {
  it('resolves every region, preserving manifest order', () => {
    const rows = resolveSiteContent(SALVIA_REGION_MANIFEST, EMPTY)
    expect(rows.length).toBe(SALVIA_REGION_MANIFEST.regions.length)
    expect(rows.map((r) => r.key)).toEqual(SALVIA_REGION_MANIFEST.regions.map((r) => r.key))
  })

  it('proves all THREE layers coexist in one resolution', () => {
    const rows = resolveSiteContent(SALVIA_REGION_MANIFEST, {
      verticalDefaults: { 'hero.eyebrow': '— Barbershop' }, // Bransch
      tenantCopy: { heroTitle: 'Min egen rubrik' }, // Kund
      tenantBranding: null,
    })
    // Universal (untouched)
    expect(find(rows, 'hero.lede').source).toBe('universal')
    expect(find(rows, 'hero.lede').provenance).toBe('standard')
    // Bransch (vertical default, still inherited)
    expect(find(rows, 'hero.eyebrow').source).toBe('vertical')
    expect(find(rows, 'hero.eyebrow').provenance).toBe('standard')
    expect(find(rows, 'hero.eyebrow').value).toBe('— Barbershop')
    // Kund (tenant override)
    expect(find(rows, 'hero.title').source).toBe('tenant')
    expect(find(rows, 'hero.title').provenance).toBe('modifierad')
    expect(find(rows, 'hero.title').value).toBe('Min egen rubrik')
  })
})
