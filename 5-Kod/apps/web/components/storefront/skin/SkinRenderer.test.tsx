import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ResolvedSkin } from '@/lib/storefront/skin/types'
import { SkinRenderer } from './SkinRenderer'

// Slice-1 renderer: text → <p>, resolved asset → <img>, everything unresolved
// (null text, null url, module, empty) → nothing. Tokens land as --sf-* inline vars.

function skin(sections: ResolvedSkin['sections'], cssVars: Record<string, string> = {}): ResolvedSkin {
  return { templateKey: 'salvia', tokens: {}, cssVars, slots: {}, sections, hasTenantContent: true }
}

describe('SkinRenderer', () => {
  it('renders text slots and resolved assets, skips unresolved/module/empty', () => {
    const html = renderToStaticMarkup(
      <SkinRenderer
        skin={skin([
          {
            sectionKey: 'hero',
            slots: [
              { kind: 'text', slotKey: 'title', value: 'Hej', text: 'Hej' },
              { kind: 'text', slotKey: 'blank', value: null, text: null },
              {
                kind: 'asset',
                slotKey: 'pic',
                assetId: 'a1',
                url: 'https://x/a.png',
                alt: 'Alt',
                width: 800,
                height: 600,
                defaultAssetKey: null,
              },
              {
                kind: 'asset',
                slotKey: 'nopic',
                assetId: null,
                url: null,
                alt: null,
                width: null,
                height: null,
                defaultAssetKey: 'k',
              },
              { kind: 'module', slotKey: 'm', moduleRef: null },
              { kind: 'empty', slotKey: 'e' },
            ],
          },
        ])}
      />,
    )
    expect(html).toContain('data-section="hero"')
    expect(html).toContain('<p>Hej</p>')
    expect(html).toContain('src="https://x/a.png"')
    expect(html).toContain('alt="Alt"')
    // unresolved text/asset + module + empty produce no extra elements
    expect(html).not.toContain('blank')
    expect(html).not.toContain('nopic')
    expect(html.match(/<p>/g)).toHaveLength(1)
    expect(html.match(/<img/g)).toHaveLength(1)
  })

  it('applies cssVars as --sf-* inline style on the wrapper', () => {
    const html = renderToStaticMarkup(
      <SkinRenderer skin={skin([], { '--sf-color-bg': '#111' })} />,
    )
    expect(html).toContain('--sf-color-bg:#111')
    expect(html).toContain('data-skin-template="salvia"')
  })
})
