import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { MediaAssetRow, StorageUsage } from './types'

/**
 * Load every image in a tenant's library, newest first.
 * Tenant-scoped: only rows where tenant_id = tenantId are returned (RLS is
 * defence-in-depth; the explicit .eq is the primary gate). Maps the snake_case DB
 * row onto the camelCase MediaAssetRow the UI consumes. Returns [] on any error so
 * a read miss can never crash the admin page.
 */
export async function listMediaAssets(tenantId: string): Promise<MediaAssetRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('media_assets')
    .select('id,url,r2_key,type,alt,size_bytes,width,height,source,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    // ponytail: cap (goal-56 A5) — 1000 newest images; paginate if a library outgrows it.
    .limit(1000)

  if (!data) return []

  return data.map((r) => ({
    id: r.id,
    url: r.url,
    r2Key: r.r2_key,
    type: r.type,
    alt: r.alt,
    sizeBytes: r.size_bytes ?? 0,
    width: r.width,
    height: r.height,
    source: r.source,
    createdAt: r.created_at,
  }))
}

/**
 * Sum the tenant's stored image bytes against the module's byte quota.
 * Tenant-scoped (.eq('tenant_id', …)); reduces size_bytes across the rows. Returns
 * { usedBytes: 0, quotaBytes } on any error so the usage bar degrades to "0 used"
 * rather than crashing the page.
 */
export async function getStorageUsage(tenantId: string, quotaBytes: number): Promise<StorageUsage> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('media_assets')
    .select('size_bytes')
    .eq('tenant_id', tenantId)
    // ponytail: cap (goal-56 A5) — matches listMediaAssets' ceiling; upgrade = 0054
    // tenant_storage_usage() RPC (DB-side SUM) once the migration is applied.
    .limit(1000)

  if (!data) return { usedBytes: 0, quotaBytes }

  const usedBytes = data.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0)
  return { usedBytes, quotaBytes }
}
