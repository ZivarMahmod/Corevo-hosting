import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildSiteEditorManifest } from './site-editor-manifest'
import { resolveTenantTabKey, tenantTabHref } from '@/components/platform/TenantDetailTabs.tabs'

describe('Goal 88 shared site-editor contracts', () => {
  it('keeps the complete manifest assembly out of the admin route', () => {
    const route = readFileSync(path.resolve(import.meta.dirname, '../../app/(admin)/admin/sida/page.tsx'), 'utf8')
    const shared = readFileSync(path.resolve(import.meta.dirname, 'site-editor-manifest.ts'), 'utf8')

    expect(route).toContain('buildSiteEditorManifest(')
    expect(route).not.toContain('function manifestFor(')
    expect(route).not.toContain('function genericModuleTabs(')
    expect(shared).toContain("id: 'hero-images'")
    expect(shared).toContain('mergeThemeDefaults(defaults, themeHomeFields)')
    expect(shared).toContain("admin: '/admin/offerter'")
    expect(shared).toContain("route.id === 'galleri' ? 'Bildbibliotek'")
  })

  it('keeps the manifest React-free and sends module editors to real admin routes', () => {
    const manifest = buildSiteEditorManifest('generic', {
      heroImages: [],
      galleryImages: [],
      stats: [],
    } as never, 'corevo' as never)

    expect(manifest.modules?.find((tab) => tab.id === 'offert')?.cards[0]?.info).toMatchObject({
      href: '/admin/offerter',
      label: 'Öppna Offert',
    })
    expect(manifest.modules?.find((tab) => tab.id === 'galleri')?.cards[0]?.info).toMatchObject({
      href: '/admin/media',
      label: 'Bildbibliotek',
    })
  })

  it('keeps inner editor params on its current pathname and resolves customer tab slugs safely', () => {
    expect(tenantTabHref('/kunder/tenant-1', 'Sida', 'source=board&flik=kontakt'))
      .toBe('/kunder/tenant-1?source=board&flik=kontakt&kundflik=sida')
    expect(resolveTenantTabKey(['Översikt', 'Sida'], 'SIDA')).toBe('Sida')
    expect(resolveTenantTabKey(['Översikt', 'Sida'], 'offerter')).toBe('Översikt')
  })
})
