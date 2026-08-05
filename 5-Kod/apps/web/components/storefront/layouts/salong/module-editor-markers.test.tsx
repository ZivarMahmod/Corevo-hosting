import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { editorFieldTargets } from '@/components/platform/SidaStudioV2.pick'
import { buildSiteEditorManifest } from '@/lib/platform/site-editor-manifest'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { THEME_SUITES } from '@/lib/storefront/themes/registry'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { BloggPost } from '@/lib/storefront/blogg/types'
import type { ShopData } from '@/lib/storefront/shop/types'
import { themeModuleViews } from '../runtime'

const data = {
  config: { fulfilment: 'ship' },
  products: [{
    id: 'p1', name: 'Produkt', priceCents: 39900, currency: 'SEK', imageUrl: null,
    variants: [{ id: 'v1', name: 'Standard', priceCents: 39900, available: null }],
    category: null, badge: null, compareAtPriceCents: null, priceFrom: false,
  }],
  categories: [], activeCategory: null,
} as unknown as ShopData

const posts = [{
  id: 'b1', title: 'Inlägg', slug: 'inlagg', excerpt: 'Text', coverImageUrl: null, publishedAt: '2026-05-01',
}] as BloggPost[]

describe.each(THEME_SUITES.salong.map(({ key }) => key as StorefrontTheme))('salong module markers: %s', (theme) => {
  it('keeps the visible shop and blog page copy connected to SidaStudio', () => {
    const views = themeModuleViews(theme)
    const Shop = views.shop!
    const Blogg = views.blogg!
    const content = resolveThemeContent(theme, null, null)
    const kind = theme === 'kalla' || theme === 'snitt' ? theme : 'generic'
    const manifest = buildSiteEditorManifest(kind, content, theme)
    const targets = new Set(
      editorFieldTargets([...manifest.tabs, ...(manifest.modules ?? [])], 'hem').map(({ field }) => field),
    )
    const shopHtml = renderToStaticMarkup(<CartProvider><Shop data={data} content={content} tenantName="Test" /></CartProvider>)
    const blogHtml = renderToStaticMarkup(<Blogg posts={posts} content={content} tenantName="Test" />)

    for (const [html, field] of [[shopHtml, 'shopTitle'], [blogHtml, 'blogTitle']] as const) {
      expect(html).toContain(`data-corevo-editor-field="${field}"`)
      expect(targets).toContain(field)
    }
  })
})
