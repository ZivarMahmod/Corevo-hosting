import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { GalleryAdminRow } from '@/components/platform/GalleriCard'

/**
 * Kundens galleri för ADMIN-ytan (goal-64) — ALLA rader, även avstängda (active=false),
 * så en dold bild förblir synlig och återställbar för operatören. Den PUBLIKA loadern
 * (lib/storefront/galleri/load-galleri.ts) filtrerar bort dem.
 *
 * Tenant-scopad: bara rader där tenant_id = tenantId (RLS är djupförsvar; den explicita
 * .eq är den primära grinden — samma söm som listMediaAssets). Returnerar [] vid fel så
 * en läs-miss aldrig kraschar kundkortet.
 */
export async function listGalleryItems(tenantId: string): Promise<GalleryAdminRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gallery_items')
    .select('id, asset_id, caption, tag, year_label, aspect_ratio, sort_order, active, media_assets(url)')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500)

  if (!data) return []

  return (
    data as unknown as {
      id: string
      asset_id: string | null
      caption: string | null
      tag: string | null
      year_label: string | null
      aspect_ratio: string | null
      sort_order: number
      active: boolean
      media_assets: { url: string } | { url: string }[] | null
    }[]
  ).map((r) => {
    const asset = Array.isArray(r.media_assets) ? r.media_assets[0] : r.media_assets
    return {
      id: r.id,
      assetId: r.asset_id ?? null,
      imageUrl: asset?.url ?? null,
      caption: r.caption ?? null,
      tag: r.tag ?? null,
      yearLabel: r.year_label ?? null,
      aspectRatio: r.aspect_ratio ?? null,
      sortOrder: r.sort_order ?? 0,
      active: r.active !== false,
    }
  })
}
