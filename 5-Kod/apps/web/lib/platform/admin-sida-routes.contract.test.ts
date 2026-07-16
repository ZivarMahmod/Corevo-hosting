import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const canonical = readFileSync(path.join(WEB_ROOT, 'app/(admin)/admin/sida/page.tsx'), 'utf8')
const legacy = readFileSync(path.join(WEB_ROOT, 'app/(admin)/admin/sida/redigera/page.tsx'), 'utf8')

describe('admin site editor routes', () => {
  it('mounts the revision-backed editor directly on /admin/sida', () => {
    expect(canonical).toContain('SidaStudioV2')
    expect(canonical).toContain('getTenantDetail')
    expect(canonical).toContain('buildSiteSnapshot')
    expect(canonical).toContain('loadSiteRevisionState')
    expect(canonical).not.toContain('href="/admin/sida/redigera"')
  })

  it('redirects the legacy editor route to the canonical route', () => {
    expect(legacy).toContain("redirect('/admin/sida')")
    expect(legacy).not.toContain('SidaStudio')
  })

  it('locks the exact Kalla and Snitt tab labels from the design package', () => {
    const contract = canonical.match(/const ACCEPTANCE_TAB_LABELS = \{([\s\S]*?)\n\} as const/)?.[1]
    const labels = (key: 'kalla' | 'snitt') =>
      contract
        ?.match(new RegExp(`${key}: \\[([^\\]]*)\\]`))?.[1]
        ?.match(/'([^']+)'/g)
        ?.map((label) => label.slice(1, -1))

    expect(labels('kalla')).toEqual([
      'Allmänt', 'Hem', 'Behandlingar', 'Terapeuter', 'Om oss',
      'Kontakt', 'Bokning', 'Apoteket', 'Anteckningar',
    ])
    expect(labels('snitt')).toEqual([
      'Allmänt', 'Postern', 'Tjänster', 'Teamet', 'Galleriet', 'Kontakt', 'Bokning',
    ])
  })

  it('opens a real booking preview and keeps Snitt rating data fetched-only', () => {
    expect(canonical).toContain("path: '?boka=1'")
    expect(canonical).toContain('caps.homeStats && defaults.stats.length')
    expect(canonical).toContain("title: 'Betygsraden'")
    expect(canonical).toContain('Google-recensioner')
    expect(canonical).toContain("imageLimit: kind === 'snitt' ? 3 : kind === 'kalla' ? 1 : defaults.heroImages.length")
  })

  it('builds home controls from the active theme contract without a false Snitt gallery image source', () => {
    expect(canonical).toContain("THEME_EXTRA_HOME[theme]")
    expect(canonical).toContain('themeCaps(theme)')
    expect(canonical).toContain("id: 'about-home-image'")
    expect(canonical).toContain('Galleribilderna hanteras i gallerimodulen')
    expect(canonical).not.toMatch(/id: 'gallery-copy',[\s\S]*?imageSlot: 'gallery_images'/)
  })

  it('places persistent and route-owned copy where the storefront renders it', () => {
    expect(canonical).toContain("field(defaults, 'tagline', 'Sidfotens text')")
    expect(canonical).toContain("field(defaults, 'closingLede', 'Kontakttext', { rows: 3 })")
    expect(canonical).toContain("...(kind !== 'kalla' ? [field(defaults, 'italic', 'Kursiv rad')] : [])")
    expect(canonical).toContain('caps.homeStats && defaults.stats.length')
    expect(canonical).toContain("field(defaults, 'italic', 'Kursiv rad', { rows: 3 })")
    expect(canonical).toContain("id: 'about-stats', title: 'Fakta / statistik', statsDefaults: defaults.stats")
  })

  it('retains capability-owned home media and every generic live module route', () => {
    expect(canonical).toContain('caps.homeGallery')
    expect(canonical).toContain("imageSlot: 'gallery_images'")
    for (const [module, label, route] of [
      ['shop', 'Butik', '/shop'],
      ['kurser', 'Kurser', '/kurser'],
      ['blogg', 'Blogg', '/blogg'],
      ['offert', 'Offert', '/offert'],
      ['presentkort', 'Presentkort', '/presentkort'],
      ['lojalitet', 'Klubb', '/klubb'],
      ['galleri', 'Galleri', '/galleri'],
    ]) {
      expect(canonical).toContain(`module: '${module}'`)
      expect(canonical).toContain(`label: '${label}'`)
      expect(canonical).toContain(`path: '${route}'`)
    }
    expect(canonical).toContain('genericModuleTabs(themeHomeFields)')
  })

  it('keeps theme defaults, including intentional empty optional fields, in the exact route manifest', () => {
    expect(canonical).toContain('mergeThemeDefaults(defaults, themeHomeFields)')
    expect(canonical).toContain('defaultValue: entry.default')
    expect(canonical).toContain('MODULE_FIELD_PREFIXES')
    expect(canonical).toContain('fields.filter((field) => prefixes.some((prefix) => field.name.startsWith(prefix)))')
  })

  it('never exposes the forbidden template word in customer-facing manifest copy', () => {
    expect(canonical).not.toMatch(/(?:text|title|label|sub|help):\s*['`][^'`]*mall/i)
  })
})
