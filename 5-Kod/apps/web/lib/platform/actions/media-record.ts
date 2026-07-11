import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/observability'

/** Vilken yta som lade in bilden — syns som filter-tagg i Bildbiblioteket. */
export type MediaRecordSource = 'branding' | 'sajtbyggare'

/** Hex sha-256 av filens bytes — samma dubblett-nyckel som uploadMediaAssets
 *  (media_assets.content_hash). Web Crypto: finns på Workers + node ≥18. */
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Registrera en redan LYCKAD R2-upload som en media_assets-rad så bilden blir
 * synlig i kundens Bildbibliotek (goal-54 A9 — tredje bildspåret: branding-/
 * sajtbyggar-uploads skrev R2 men aldrig media_assets → osynliga bilder).
 *
 * DUBBLETT-VAKT: finns tenantens content_hash redan är detta en no-op (samma
 * kontrakt som uploadMediaAssets). BEST-EFFORT: hela funktionen är try/catch:ad
 * och får ALDRIG fälla själva uppladdningen — fel loggas strukturerat och sväljs.
 * Kräver DB-check-widening 0053 (source 'branding'|'sajtbyggare').
 */
export async function recordMediaAsset(
  supabase: SupabaseClient,
  tenantId: string,
  file: File,
  res: { url: string; key: string },
  source: MediaRecordSource,
): Promise<void> {
  try {
    const hash = await sha256Hex(await file.arrayBuffer())

    const { data: dup } = await supabase
      .from('media_assets')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('content_hash', hash)
      .limit(1)
      .maybeSingle()
    if (dup) return // redan i biblioteket — no-op

    const { error } = await supabase.from('media_assets').insert({
      tenant_id: tenantId,
      r2_key: res.key,
      url: res.url,
      type: 'image',
      size_bytes: file.size,
      source,
      content_hash: hash,
    })
    if (error) {
      logger.warn('media.record_asset_failed', { tenantId, source, code: error.code })
    }
  } catch (e) {
    logger.warn('media.record_asset_failed', {
      tenantId,
      source,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
