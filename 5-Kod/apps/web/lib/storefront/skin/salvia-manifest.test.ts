import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from '@/components/storefront/theme-content'
import { SALVIA_REGION_MANIFEST } from './salvia-manifest'
import type { Region, RegionType } from './manifest-types'

const VALID_TYPES: RegionType[] = ['text', 'image', 'color', 'font', 'logo']

describe('SALVIA_REGION_MANIFEST', () => {
  const { regions } = SALVIA_REGION_MANIFEST

  /** Find a region by key (throws if absent) — keeps assertions strict-safe. */
  const get = (key: string): Region => {
    const r = regions.find((x) => x.key === key)
    if (!r) throw new Error(`region not declared: ${key}`)
    return r
  }

  it('targets the salvia template', () => {
    expect(SALVIA_REGION_MANIFEST.templateKey).toBe('salvia')
  })

  it('declares exactly the expected region keys', () => {
    const expected = [
      'hero.eyebrow', 'hero.title', 'hero.lede', 'about.copy', 'footer.tagline', 'about.italic',
      'hero.image', 'about.image', 'closing.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
  })

  it('excludes utility (theme-only, never owner-editable)', () => {
    expect(regions.some((r) => r.key.includes('utility'))).toBe(false)
  })

  it('has no duplicate keys', () => {
    const keys = regions.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every region has a valid type', () => {
    for (const r of regions) expect(VALID_TYPES).toContain(r.type)
  })

  it('every region carries a well-formed tenantBinding', () => {
    for (const r of regions) {
      const b = r.tenantBinding
      expect(['copy', 'branding']).toContain(b.store)
      expect(typeof b.field).toBe('string')
      expect(b.field.length).toBeGreaterThan(0)
      if (b.store === 'branding' && b.index !== undefined) {
        expect(Number.isInteger(b.index)).toBe(true)
        expect(b.index).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('text defaults are referentially the salvia theme copy (DRY link, not a re-typed copy)', () => {
    expect(get('hero.eyebrow').default).toBe(THEME_CONTENT.salvia.heroEyebrow)
    expect(get('hero.title').default).toBe(THEME_CONTENT.salvia.heroTitle)
    expect(get('hero.lede').default).toBe(THEME_CONTENT.salvia.heroLede)
    expect(get('about.copy').default).toBe(THEME_CONTENT.salvia.aboutCopy)
    expect(get('footer.tagline').default).toBe(THEME_CONTENT.salvia.tagline)
    expect(get('about.italic').default).toBe(THEME_CONTENT.salvia.italic)
  })

  it('image defaults are referentially the salvia theme media (DRY link)', () => {
    expect(get('hero.image').default).toBe(THEME_CONTENT.salvia.heroImages[0])
    expect(get('about.image').default).toBe(THEME_CONTENT.salvia.aboutImage)
    expect(get('closing.image').default).toBe(THEME_CONTENT.salvia.closingImage)
  })

  it('colour + font defaults are exact salvia token values; logo has none', () => {
    expect(get('color.primary').default).toBe('#5E7361')
    expect(get('color.bg').default).toBe('#F6F4EE')
    expect(get('color.fg').default).toBe('#232520')
    expect(get('color.accent').default).toBe('#5E7361')
    expect(get('font.body').default).toBe("'Jost', 'Inter', sans-serif")
    expect(get('logo').default).toBeNull()
  })

  it('text regions bind to settings.copy, branding regions bind to the branding column', () => {
    for (const r of regions) {
      if (r.type === 'text') expect(r.tenantBinding.store).toBe('copy')
      else expect(r.tenantBinding.store).toBe('branding')
    }
  })
})
