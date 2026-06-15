import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { BlogPostRow } from './types'

/**
 * List all blog posts for a tenant, ordered by sort_order ascending then
 * created_at descending (newest first within the same sort position).
 * Returns an empty array on error — a read miss must never crash an admin page.
 */
export async function listBlogPosts(tenantId: string): Promise<BlogPostRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('blog_posts')
    .select(
      'id, title, slug, excerpt, body, cover_asset_id, status, published_at, sort_order, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  return data ?? []
}
