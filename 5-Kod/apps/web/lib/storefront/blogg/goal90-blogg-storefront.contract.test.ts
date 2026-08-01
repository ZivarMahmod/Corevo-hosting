import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const loader = readFileSync(new URL('./load-blogg.ts', import.meta.url), 'utf8')
const listPage = readFileSync(
  new URL('../../../app/(public)/blogg/page.tsx', import.meta.url),
  'utf8',
)
const detailPage = readFileSync(
  new URL('../../../app/(public)/blogg/[slug]/page.tsx', import.meta.url),
  'utf8',
)
const sitemap = readFileSync(
  new URL('../../../app/(public)/sitemap.ts', import.meta.url),
  'utf8',
)
const bridge = readFileSync(
  new URL('../../../components/platform/SidaPreviewBridge.tsx', import.meta.url),
  'utf8',
)
const pagination = readFileSync(
  new URL('../../../components/storefront/blogg/BloggPagination.tsx', import.meta.url),
  'utf8',
)
const previewDetail = new URL(
  '../../../app/salong-preview/[slug]/blogg/[postSlug]/page.tsx',
  import.meta.url,
)

describe('Goal 90 blogg storefront contract', () => {
  it('uses exact count, an inclusive range and a deterministic tie-breaker', () => {
    expect(loader).toContain("{ count: 'exact' }")
    expect(loader).toContain('.range(from, to)')
    const publishedOrder = loader.indexOf(".order('published_at', { ascending: false })")
    const idOrder = loader.indexOf(".order('id', { ascending: false })")
    expect(publishedOrder).toBeGreaterThan(-1)
    expect(idOrder).toBeGreaterThan(publishedOrder)
  })

  it('validates the page parameter and exposes accessible previous/next links', () => {
    expect(listPage).toContain('parseBloggPage')
    expect(listPage).toContain('searchParams')
    expect(pagination).toContain('aria-label="Bloggsidor"')
    expect(pagination).toContain('Föregående')
    expect(pagination).toContain('Nästa')
  })

  it('emits canonical, description and real cover metadata for a post', () => {
    expect(detailPage).toContain('alternates: { canonical }')
    expect(detailPage).toContain('description')
    expect(detailPage).toContain('images')
    expect(detailPage).toContain("type: 'article'")
  })

  it('adds only published post slugs when the blogg module is live', () => {
    expect(sitemap).toContain('loadPublishedBlogSitemapRows')
    expect(sitemap).toContain("isModuleLive(states, 'blogg')")
    expect(loader).toContain(".eq('status', 'published')")
    expect(loader).toContain(".neq('slug', '')")
  })

  it('keeps post navigation inside a real preview detail route', () => {
    expect(existsSync(previewDetail)).toBe(true)
    const source = existsSync(previewDetail) ? readFileSync(previewDetail, 'utf8') : ''
    expect(source).toContain('loadBlogPostBySlug')
    expect(source).toContain('BloggPostView')
    expect(bridge).toContain("target.startsWith('blogg/')")
  })
})
