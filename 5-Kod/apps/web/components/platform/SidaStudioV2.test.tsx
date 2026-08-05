import { describe, expect, it } from 'vitest'
import { resolveSiteEditorTabId, siteEditorPreviewSrc, siteEditorTabHref } from './SidaStudioV2.tabs'

describe('SidaStudioV2 tab paths', () => {
  it('resolves valid deep-linked tabs and preserves the URL contract', () => {
    const tabs = [{ id: 'allmant' }, { id: 'kontakt' }, { id: 'bokning' }]
    expect(resolveSiteEditorTabId(tabs, 'bokning')).toBe('bokning')
    expect(resolveSiteEditorTabId(tabs, 'saknas')).toBe('allmant')
    expect(siteEditorTabHref('/admin/sida', 'bokning', 'kampanj=sommar&flik=kontakt'))
      .toBe('/admin/sida?kampanj=sommar&flik=bokning')
  })

  it('keeps preview anchors on the current editor route', () => {
    expect(siteEditorPreviewSrc('/salong-preview/freshcut', '#kontakt', 'freshcut', 'keep'))
      .toBe('/salong-preview/freshcut?theme=freshcut&copy=keep#kontakt')
  })
})
