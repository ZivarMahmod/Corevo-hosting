import { describe, expect, it } from 'vitest'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { buildSiteEditorManifest } from './site-editor-manifest'
import { editorFieldTargets } from '@/components/platform/SidaStudioV2.pick'

describe('FreshCut site editor manifest', () => {
  it('uses the customer site’s real one-page sections instead of generic pages', () => {
    const manifest = buildSiteEditorManifest(
      'generic',
      resolveThemeContent('freshcut', null, null),
      'freshcut',
    )

    expect(manifest.tabs.map((tab) => [tab.id, tab.path])).toEqual([
      ['allmant', ''],
      ['hem', ''],
      ['tjanster', '/#tjanster'],
      ['resultat', '/#resultat'],
      ['salongen', '/#salongen'],
      ['kontakt', '/#kontakt'],
      ['bokning', '?boka=1'],
    ])

    expect(editorFieldTargets(manifest.tabs, 'hem').map((target) => target.field)).toEqual(expect.arrayContaining([
      'utility',
      'heroTitle',
      'servicesIntro',
      'resultsLede',
      'resultImage1Caption',
      'studioPoint1',
      'contactLede',
    ]))
  })
})
