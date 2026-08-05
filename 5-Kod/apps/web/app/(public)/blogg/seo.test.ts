import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bloggLive: true,
  kurserLive: true,
  galleriLive: true,
  post: {
    id: 'post-1',
    title: 'Sommarens buketter',
    slug: 'sommarens-buketter',
    excerpt: 'Så binder vi säsongens buketter.',
    body: 'Längre brödtext.',
    coverAssetId: 'asset-1',
    publishedAt: '2026-07-29T08:00:00.000Z',
    coverImageUrl: 'https://cdn.example/post.webp',
    coverImageAlt: 'En sommarbukett',
    tag: 'Inspiration',
  },
  sitemapRows: [
    { slug: 'sommarens-buketter', publishedAt: '2026-07-29T08:00:00.000Z' },
  ],
}))

vi.mock('@/lib/tenant-data', () => ({
  currentTenant: vi.fn(async () => ({
    tenant: {
      id: 'tenant-1', slug: 'ateljen', name: 'Ateljén',
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z',
    },
    settings: {},
  })),
}))
vi.mock('@/lib/storefront/blogg/load-blogg-post', () => ({ loadBlogPostBySlug: vi.fn(async () => mocks.post) }))
vi.mock('@/lib/storefront/blogg/load-blogg', () => ({ loadPublishedBlogSitemapRows: vi.fn(async () => mocks.sitemapRows) }))
vi.mock('@/lib/tenant-modules', () => ({
  getTenantModuleStates: vi.fn(async () => ({
    blogg: mocks.bloggLive ? 'live' : 'off', kurser: mocks.kurserLive ? 'live' : 'off', galleri: mocks.galleriLive ? 'live' : 'off',
  })),
  isModuleLive: (states: Record<string, string>, key: string) => states[key] === 'live',
}))
vi.mock('@/lib/url', () => ({ requestOrigin: vi.fn(async () => 'https://ateljen.corevo.se') }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('not-found') }) }))

import { generateMetadata } from './[slug]/page'
import sitemap from '../sitemap'
import { loadPublishedBlogSitemapRows } from '@/lib/storefront/blogg/load-blogg'

describe('blogg SEO', () => {
  beforeEach(() => {
    mocks.bloggLive = true
    mocks.kurserLive = true
    mocks.galleriLive = true
    vi.clearAllMocks()
  })

  it('uses the post truth for canonical, description and open graph image', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: mocks.post.slug }) })
    expect(metadata).toMatchObject({
      title: mocks.post.title, description: mocks.post.excerpt,
      alternates: { canonical: `/blogg/${mocks.post.slug}` },
      openGraph: {
        type: 'article', url: `/blogg/${mocks.post.slug}`, publishedTime: mocks.post.publishedAt,
        images: [{ url: mocks.post.coverImageUrl, alt: mocks.post.coverImageAlt }],
      },
    })
  })

  it('adds published posts only when blogg is live', async () => {
    const live = await sitemap()
    expect(live).toContainEqual(expect.objectContaining({ url: `https://ateljen.corevo.se/blogg/${mocks.post.slug}`, lastModified: mocks.post.publishedAt }))
    mocks.bloggLive = false
    vi.clearAllMocks()
    const hidden = await sitemap()
    expect(hidden.some((row) => row.url.includes('/blogg/'))).toBe(false)
    expect(loadPublishedBlogSitemapRows).not.toHaveBeenCalled()
  })

  it('publishes live kurser and galleri routes under their own module gates', async () => {
    const rows = await sitemap()
    expect(rows).toContainEqual(expect.objectContaining({ url: 'https://ateljen.corevo.se/kurser' }))
    expect(rows).toContainEqual(expect.objectContaining({ url: 'https://ateljen.corevo.se/galleri' }))
    mocks.kurserLive = false
    mocks.galleriLive = false
    const hidden = await sitemap()
    expect(hidden.some((row) => row.url.endsWith('/kurser'))).toBe(false)
    expect(hidden.some((row) => row.url.endsWith('/galleri'))).toBe(false)
  })
})
