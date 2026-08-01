import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const canonical = readFileSync(path.join(WEB_ROOT, 'app/(admin)/admin/sida/page.tsx'), 'utf8')
const manifest = readFileSync(path.join(WEB_ROOT, 'lib/platform/site-editor-manifest.ts'), 'utf8')
const legacy = readFileSync(path.join(WEB_ROOT, 'app/(admin)/admin/sida/redigera/page.tsx'), 'utf8')

describe('admin site editor routes', () => {
  it('passes the flik query to the editor for the first render', () => {
    expect(canonical).toContain('searchParams: Promise<')
    expect(canonical).toContain('const query = await searchParams')
    expect(canonical).toContain('initialTabId={requestedTabId}')
  })

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
    const contract = manifest.match(/const ACCEPTANCE_TAB_LABELS = \{([\s\S]*?)\n\} as const/)?.[1]
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

  it('opens a real booking preview and describes Snitt Google support as link-only', () => {
    expect(manifest).toContain("path: '?boka=1'")
    expect(manifest).toContain('caps.homeStats && defaults.stats.length')
    expect(manifest).toContain("title: 'Google-recensionslänk'")
    expect(manifest).toContain('Ingen betygs- eller recensionsdata hämtas automatiskt')
    expect(manifest).not.toContain('uppdateras automatiskt')
    expect(manifest).toContain("imageLimit: kind === 'snitt' ? 3 : kind === 'kalla' ? 1 : defaults.heroImages.length")
  })

  it('builds home controls from the active theme contract without a false Snitt gallery image source', () => {
    expect(manifest).toContain("THEME_EXTRA_HOME[theme]")
    expect(manifest).toContain('themeCaps(theme)')
    expect(manifest).toContain("id: 'about-home-image'")
    expect(manifest).toContain('Galleribilderna hanteras i gallerimodulen')
    expect(manifest).not.toMatch(/id: 'gallery-copy',[\s\S]*?imageSlot: 'gallery_images'/)
  })

  it('places persistent and route-owned copy where the storefront renders it', () => {
    expect(manifest).toContain("field(defaults, 'tagline', 'Sidfotens text')")
    expect(manifest).toContain("field(defaults, 'closingLede', 'Kontakttext', { rows: 3 })")
    expect(manifest).toContain("...(kind !== 'kalla' ? [field(defaults, 'italic', 'Kursiv rad')] : [])")
    expect(manifest).toContain('caps.homeStats && defaults.stats.length')
    expect(manifest).toContain("field(defaults, 'italic', 'Kursiv rad', { rows: 3 })")
    expect(manifest).toContain("id: 'about-stats', title: 'Fakta / statistik', statsDefaults: defaults.stats")
  })

  it('retains capability-owned home media and every generic live module route', () => {
    expect(manifest).toContain('caps.homeGallery')
    expect(manifest).toContain("imageSlot: 'gallery_images'")
    for (const [module, label, route] of [
      ['shop', 'Butik', '/shop'],
      ['kurser', 'Kurser', '/kurser'],
      ['blogg', 'Blogg', '/blogg'],
      ['offert', 'Offert', '/offert'],
      ['presentkort', 'Presentkort', '/presentkort'],
      ['lojalitet', 'Klubb', '/klubb'],
      ['galleri', 'Galleri', '/galleri'],
    ]) {
      expect(manifest).toContain(`module: '${module}'`)
      expect(manifest).toContain(`label: '${label}'`)
      expect(manifest).toContain(`path: '${route}'`)
    }
    expect(manifest).toContain('genericModuleTabs(themeHomeFields)')
  })

  it('keeps theme defaults, including intentional empty optional fields, in the exact route manifest', () => {
    expect(manifest).toContain('mergeThemeDefaults(defaults, themeHomeFields)')
    expect(manifest).toContain('defaultValue: entry.default')
    expect(manifest).toContain('MODULE_FIELD_PREFIXES')
    expect(manifest).toContain('fields.filter((field) => prefixes.some((prefix) => field.name.startsWith(prefix)))')
  })

  it('never exposes the forbidden template word in customer-facing manifest copy', () => {
    expect(manifest).not.toMatch(/(?:text|title|label|sub|help):\s*['`][^'`]*mall/i)
  })
})
