import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(__dirname, '..', '..')
const read = (relative: string) => readFileSync(path.join(WEB_ROOT, relative), 'utf8')

const adminRoute = read('app/(admin)/admin/sida/page.tsx')
const platformRoute = read('app/(platform)/kunder/(board)/[id]/page.tsx')
const studio = read('components/platform/SidaStudioV2.tsx')
const studioRoutes = read('components/platform/SidaStudioV2.tabs.ts')
const css = read('components/platform/SidaStudioV2.module.css')

describe('Goal 88 shared platform site editor', () => {
  it('mounts the same revision-backed V2 contract on both routes', () => {
    for (const route of [adminRoute, platformRoute]) {
      expect(route).toContain('SidaStudioV2Lazy')
      expect(route).toContain('buildSiteSnapshot')
      expect(route).toContain('loadSiteRevisionState')
      expect(route).toContain('buildSiteEditorManifest')
      expect(route).toContain('deriveSiteScheduleHours')
    }
    expect(adminRoute).toContain('surface="standalone"')
    expect(adminRoute).toContain('<BookingPanel')
    expect(adminRoute).toContain('normalizeBookingExternalUrl')
    expect(platformRoute).toContain('surface="embedded"')
    expect(platformRoute).not.toContain('<SidaStudioLazy')
  })

  it('keeps the accepted embedded split without changing standalone geometry', () => {
    expect(studio).toContain("surface: 'standalone' | 'embedded'")
    expect(css).toMatch(
      /\.embedded \.workspace\s*\{[^}]*grid-template-columns:\s*minmax\(400px,\s*1fr\)\s+minmax\(480px,\s*1\.15fr\);[^}]*gap:\s*16px;[^}]*align-items:\s*start;/s,
    )
    expect(css).toMatch(
      /\.embedded \.preview\s*\{[^}]*position:\s*sticky;[^}]*top:\s*78px;[^}]*height:\s*calc\(100vh - 220px\);[^}]*min-height:\s*420px;/s,
    )
    expect(css).toMatch(
      /@media \(max-width:\s*991px\)[\s\S]*?\.embedded \.workspace\s*\{[^}]*grid-template-columns:\s*1fr;/,
    )
    expect(studio).toContain("const previewWidth = device === 'desktop' ? 1360 : 390")
  })

  it('shows template switching only to root and never replays a revision over template copy', () => {
    expect(platformRoute).toContain('const operator = await requirePlatformOperator()')
    expect(platformRoute).toContain('canChangeTemplate={operator.platformAdmin}')
    expect(studio).toContain('canChangeTemplate && !dirty && !hasDraft')
    expect(studioRoutes).toContain("params.set('theme', theme)")
    expect(studio).toContain('siteEditorPreviewSrc(previewPath')
    expect(studio).toContain("previewCopyMode === 'template'")
    expect(studio).toContain('if (previewingTemplateDefaults) return')
  })
})
