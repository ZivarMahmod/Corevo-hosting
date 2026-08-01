// Blogg-modul — SERVER data loader. Fetches the tenant's blogg config (from
// tenant_modules.config) + its published posts via the anonymous public client,
// shaping them for BloggSection. Modeled ORDAGRANT on lib/storefront/offert/
// load-offert.ts + lib/storefront/shop/load-shop.ts.
//
// NOT a 'server-only' module by import convention: it uses the cookie-less anon
// public client (safe inside unstable_cache) exactly like load-shop.ts /
// load-offert.ts / tenant-modules.ts. It is still only ever called from server
// components.
//
// CRITICAL (same fence as tenant-data.ts / tenant-modules.ts, ADR 01 §2): the
// `anon` role carries NO tenant_id claim, so RLS does NOT isolate tenants for the
// public client. Every query filters by the resolved tenant_id IN THE APP LAYER
// (.eq('tenant_id', …)). RLS (0034) is defense-in-depth only — it additionally
// caps anon reads to status='published', but we still set status here in the app
// layer for clarity + parity with the shop loader's active-filter.
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// storefront resolves tenant_modules.state via getTenantModuleStates() and only
// renders BloggSection when blogg === 'live' (same shape as the booking + shop +
// offert gate). Off/draft når aldrig loadern; paused laddas som läsbar men stängd modul.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import {
  bloggPageRange,
  parseBloggConfig,
  type BloggConfig,
  type BloggData,
  type BloggPost,
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

      const posts: BloggPost[] = (rows ?? []).map((r) => {
        // Supabase types the embedded relation as object | array depending on the
        // FK cardinality; normalize to a single asset defensively.
        const asset = Array.isArray(r.media_assets) ? r.media_assets[0] : r.media_assets
        return {
          id: r.id,
          title: r.title,
          slug: r.slug ?? null,
          excerpt: r.excerpt ?? null,
          body: r.body ?? null,
          coverAssetId: r.cover_asset_id ?? null,
          publishedAt: r.published_at ?? null,
          coverImageUrl: asset?.url ?? null,
          coverImageAlt: asset?.alt ?? null,
          // goal-64 (0057): tom sträng blir null → mallen renderar aldrig en tom etikett.
          tag: r.tag?.trim() || null,
        }
      })

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
