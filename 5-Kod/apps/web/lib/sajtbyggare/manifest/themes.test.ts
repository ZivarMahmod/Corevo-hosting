// The four non-salvia theme manifests (leander/zigge/linnea/edit) — same shape
// guarantees as salvia.test.ts, parameterised. Each theme's manifest exposes the
// 14 regions its site actually renders (home layout + shared om/kontakt sections)
// — the salvia set MINUS footer.tagline (only salvia's FooterFull renders the
// tagline; the other four use the compact MiniFooter).

import { describe, expect, it } from 'vitest'
import { THEME_CONTENT } from '@/components/storefront/theme-content'
import { LEANDER_REGION_MANIFEST } from './leander'
import { ZIGGE_REGION_MANIFEST } from './zigge'
import { LINNEA_REGION_MANIFEST } from './linnea'
import { EDIT_REGION_MANIFEST } from './edit'
import type { Region, RegionManifest, RegionType } from './types'

const VALID_TYPES: RegionType[] = ['text', 'image', 'color', 'font', 'logo']

// Token defaults mirrored EXACTLY from packages/ui/tokens.css
// ([data-world="storefront"][data-theme="<key>"]); accent = primary (the
// storefront base block re-points --color-accent, "never Corevo gold").
const CASES: {
  theme: 'leander' | 'zigge' | 'linnea' | 'edit'
  manifest: RegionManifest
  primary: string
  bg: string
  fg: string
  fontBody: string
}[] = [
  { theme: 'leander', manifest: LEANDER_REGION_MANIFEST, primary: '#7E6E92', bg: '#FBFAF8', fg: '#2A2630', fontBody: "'Inter', system-ui, sans-serif" },
  { theme: 'zigge', manifest: ZIGGE_REGION_MANIFEST, primary: '#C8743C', bg: '#14120E', fg: '#F2ECE2', fontBody: "'Archivo', 'Inter', sans-serif" },
  { theme: 'linnea', manifest: LINNEA_REGION_MANIFEST, primary: '#B0693F', bg: '#F4EDE1', fg: '#2E2820', fontBody: "'Inter', system-ui, sans-serif" },
  { theme: 'edit', manifest: EDIT_REGION_MANIFEST, primary: '#3A3733', bg: '#F8F6F1', fg: '#232220', fontBody: "'Inter', system-ui, sans-serif" },
]

describe.each(CASES)('$theme region manifest', ({ theme, manifest, primary, bg, fg, fontBody }) => {
  const { regions } = manifest

  /** Find a region by key (throws if absent) — keeps assertions strict-safe. */
  const get = (key: string): Region => {
    const r = regions.find((x) => x.key === key)
    if (!r) throw new Error(`region not declared: ${key}`)
    return r
  }

  it('targets its own template', () => {
    expect(manifest.templateKey).toBe(theme)
  })

  it('declares exactly the expected region keys (salvia set minus footer.tagline)', () => {
    const expected = [
      'hero.eyebrow', 'hero.title', 'hero.lede', 'about.copy', 'about.italic',
      'hero.image', 'about.image', 'closing.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
  })

  it('excludes utility (theme-only) and footer.tagline (not rendered by MiniFooter)', () => {
    expect(regions.some((r) => r.key.includes('utility'))).toBe(false)
    expect(regions.some((r) => r.key === 'footer.tagline')).toBe(false)
  })

  it('has no duplicate keys and every region has a valid type', () => {
    const keys = regions.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
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

  it('text defaults are referentially the theme copy (DRY link, not a re-typed copy)', () => {
    expect(get('hero.eyebrow').default).toBe(THEME_CONTENT[theme].heroEyebrow)
    expect(get('hero.title').default).toBe(THEME_CONTENT[theme].heroTitle)
    expect(get('hero.lede').default).toBe(THEME_CONTENT[theme].heroLede)
    expect(get('about.copy').default).toBe(THEME_CONTENT[theme].aboutCopy)
    expect(get('about.italic').default).toBe(THEME_CONTENT[theme].italic)
  })

  it('image defaults are referentially the theme media (DRY link)', () => {
    expect(get('hero.image').default).toBe(THEME_CONTENT[theme].heroImages[0])
    expect(get('about.image').default).toBe(THEME_CONTENT[theme].aboutImage)
    expect(get('closing.image').default).toBe(THEME_CONTENT[theme].closingImage)
  })

  it('colour + font defaults are exact theme token values; logo has none', () => {
    expect(get('color.primary').default).toBe(primary)
    expect(get('color.bg').default).toBe(bg)
    expect(get('color.fg').default).toBe(fg)
    expect(get('color.accent').default).toBe(primary) // accent re-points to primary
    expect(get('font.body').default).toBe(fontBody)
    expect(get('logo').default).toBeNull()
  })

  it('text regions bind to settings.copy, branding regions bind to the branding column', () => {
    for (const r of regions) {
      if (r.type === 'text') expect(r.tenantBinding.store).toBe('copy')
      else expect(r.tenantBinding.store).toBe('branding')
    }
  })
})
