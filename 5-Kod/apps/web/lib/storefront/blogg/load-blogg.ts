// Caller gates the live module. Every anon query must keep the explicit tenant_id
// and published-status filters.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import {
  bloggPageRange,
  mapBloggPost,
  parseBloggConfig,
  type BloggConfig,
  type BloggData,
} from './types'

/**
 * Load the tenant's blogg config + published posts. Cached per-tenant and tagged
 * with the SAME `tenant:<slug>` tag the rest of the storefront uses, so a config
 * change (variant swap) or post edit that busts that tag refreshes here too.
 *
 * Returns null when the tenant has no blogg module row at all (nothing to render).
 * Returns a BloggData with an empty post list when the blogg is configured but has
 * no published posts yet (the section then shows an honest empty state).
 */
export async function loadBloggData(
  tenantId: string,
  slug: string,
  page = 1,
): Promise<BloggData | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<BloggData | null> => {
      const supabase = createPublicClient()

      // The blogg module's per-tenant config (variant + params). No row → null.
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'blogg')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: BloggConfig = parseBloggConfig(moduleRow.config)
      const { from, to } = bloggPageRange(page, config.postsPerPage)

      // Published posts for this tenant, newest first, joined to their cover asset
      // for the image. id is the stable tie-breaker when timestamps match.
      const { data: rows, count } = await supabase
        .from('blog_posts')
        .select(
          'id, title, slug, excerpt, body, cover_asset_id, published_at, tag, media_assets(url, alt)',
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)

      const posts = (rows ?? []).map(mapBloggPost)

      const total = count ?? posts.length
      return {
        config,
        posts,
        pagination: {
          page,
          total,
          totalPages: Math.max(1, Math.ceil(total / config.postsPerPage)),
        },
      }
    },
    ['blogg-data-by-tenant', tenantId, norm, String(page)],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

export type BloggSitemapRow = {
  slug: string
  publishedAt: string | null
}

/** Published post URLs for the tenant sitemap. The caller owns the live-module gate. */
export async function loadPublishedBlogSitemapRows(
  tenantId: string,
  tenantSlug: string,
): Promise<BloggSitemapRow[]> {
  const norm = tenantSlug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<BloggSitemapRow[]> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('blog_posts')
        .select('slug, published_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .neq('slug', '')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(50_000)
      return (data ?? []).map((row) => ({
        slug: row.slug,
        publishedAt: row.published_at ?? null,
      }))
    },
    ['blogg-sitemap-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
