// Caller gates the live module. Every anon query must keep the explicit tenant_id,
// slug and published-status filters.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { mapBloggPost, type BloggPost } from './types'

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
        .select(
          'id, title, slug, excerpt, body, cover_asset_id, published_at, tag, media_assets(url, alt)',
        )
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('status', 'published')
        .eq('slug', post)
        .maybeSingle()
      if (error || !r) return null

      return mapBloggPost(r)
    },
    ['blogg-post-by-slug', tenantId, norm, post],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
