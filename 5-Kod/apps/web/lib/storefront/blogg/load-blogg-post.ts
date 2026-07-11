// Blogg-modul — SERVER data loader för ETT inlägg (detaljsidan /blogg/[slug]).
// Systerloader till load-blogg.ts: samma cookie-lösa anon public client, samma
// unstable_cache + `tenant:<slug>`-tagg, samma app-layer tenant-isolering.
//
// CRITICAL (same fence as load-blogg.ts, ADR 01 §2): the `anon` role carries NO
// tenant_id claim, so RLS does NOT isolate tenants for the public client. Every
// query filters by the resolved tenant_id IN THE APP LAYER (.eq('tenant_id', …)).
// RLS (0034) caps anon reads to status='published' as defense-in-depth, but we
// still set status here in the app layer for clarity + parity with the list loader.
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// detail page resolves tenant_modules.state exactly like /blogg does and only
// calls this when blogg is live/paused.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { BloggPost } from './types'

/**
 * Load ONE published post by its slug for the tenant. Cached per-tenant+postSlug
 * and tagged with the SAME `tenant:<slug>` tag as the list loader, so a post edit
 * that busts that tag refreshes here too.
 *
 * Returns null when the slug doesn't match a published post for this tenant
 * (okänd slug → caller calls notFound()).
 */
export async function loadBlogPostBySlug(
  tenantId: string,
  tenantSlug: string,
  postSlug: string,
): Promise<BloggPost | null> {
  const norm = tenantSlug.trim().toLowerCase()
  const post = postSlug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<BloggPost | null> => {
      const supabase = createPublicClient()

      const { data: r, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, body, cover_asset_id, published_at, media_assets(url, alt)')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('status', 'published')
        .eq('slug', post)
        .maybeSingle()
      if (error || !r) return null

      // Supabase types the embedded relation as object | array depending on the
      // FK cardinality; normalize to a single asset defensively (same as list).
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
      }
    },
    ['blogg-post-by-slug', tenantId, norm, post],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
