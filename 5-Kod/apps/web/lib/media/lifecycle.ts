import 'server-only'

import type { Json } from '@corevo/db'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/observability'
import {
  deleteByPublicUrl,
  keyFromPublicUrl,
  uploadErrorMessage,
  uploadImageAtKey,
  type UploadResult,
} from '@/lib/r2/upload'

export type ManagedMediaSource = 'upload' | 'branding' | 'sajtbyggare'
type R2FailureReason = Extract<UploadResult, { ok: false }>['reason']
export type ManagedUploadFailureReason =
  | R2FailureReason
  | 'quota'
  | 'pending'
  | 'unavailable'
  | 'database'

export type ManagedUploadResult =
  | { ok: true; assetId: string; url: string; key: string; duplicate: boolean }
  | { ok: false; reason: ManagedUploadFailureReason }

type ReservationRow = {
  asset_id: string
  r2_key: string
  status: string
  published: boolean
  url: string | null
  variants: Json
  outcome: string
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function fixedVariants(url: string): Record<'thumb' | 'card' | 'hero', string> {
  // No transform runtime is installed. The fixed contract remains explicit and
  // all three slots safely fall back to the finalized original URL.
  return { thumb: url, card: url, hero: url }
}

function firstRow<T>(data: T[] | T | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data
}

export async function resolveReadyTenantAssetId(
  supabase: SupabaseClient,
  tenantId: string,
  raw: string,
): Promise<string | null> {
  const id = raw.trim()
  if (!id) return null

  const { data } = await supabase
    .from('media_assets')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'ready')
    .maybeSingle()

  return data ? id : null
}

function isTenantOwnedLegacyKey(key: string | null, tenantId: string): boolean {
  if (!key) return false
  if (key.startsWith(`tenants/${tenantId}/`)) return true
  if (!key.startsWith(`media/${tenantId}/`)) return false
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(key)
}

async function cancelReservation(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  errorCode: string,
  cleanupRequired: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('cancel_media_upload', {
    p_tenant: tenantId,
    p_asset: assetId,
    p_error: errorCode,
    p_cleanup_required: cleanupRequired,
  })
  if (error) {
    logger.warn('media.cancel_reservation_failed', {
      tenantId,
      assetId,
      code: error.code,
      cleanupRequired,
    })
  }
}

/**
 * One lifecycle-safe upload path shared by the media library and the historical
 * site/branding sibling flow. Postgres reserves quota/key first, R2 receives the
 * bytes second, and Postgres alone can finalize the row as ready.
 */
export async function uploadManagedImage(
  supabase: SupabaseClient,
  tenantId: string,
  file: File,
  source: ManagedMediaSource,
): Promise<ManagedUploadResult> {
  const contentHash = await sha256Hex(await file.arrayBuffer())
  const reserved = await supabase.rpc('reserve_media_upload', {
    p_tenant: tenantId,
    p_content_hash: contentHash,
    p_size_bytes: file.size,
    p_source: source,
  })

  if (reserved.error) {
    const message = reserved.error.message ?? ''
    if (message.includes('media_quota_exceeded')) return { ok: false, reason: 'quota' }
    if (message.includes('media_size_invalid')) return { ok: false, reason: 'too_large' }
    logger.warn('media.reserve_failed', {
      tenantId,
      source,
      code: reserved.error.code,
    })
    return { ok: false, reason: 'database' }
  }

  const reservation = firstRow(reserved.data as ReservationRow[] | null)
  if (!reservation) return { ok: false, reason: 'database' }

  if (reservation.outcome === 'duplicate_ready' && reservation.url) {
    return {
      ok: true,
      assetId: reservation.asset_id,
      key: reservation.r2_key,
      url: reservation.url,
      duplicate: true,
    }
  }
  const resumedPending = reservation.outcome === 'duplicate_pending'
  if (reservation.outcome.startsWith('duplicate_')) {
    if (!resumedPending) return { ok: false, reason: 'unavailable' }
  }
  if (reservation.outcome !== 'reserved' && !resumedPending) {
    return { ok: false, reason: 'database' }
  }

  const uploaded = await uploadImageAtKey(file, reservation.r2_key)
  if (!uploaded.ok) {
    await cancelReservation(
      supabase,
      tenantId,
      reservation.asset_id,
      'r2_upload_failed',
      uploaded.reason === 'failed',
    )
    return uploaded
  }

  const variants = fixedVariants(uploaded.url)
  const finalize = () => supabase.rpc('finalize_media_upload', {
    p_tenant: tenantId,
    p_asset: reservation.asset_id,
    p_url: uploaded.url,
    p_variants: variants,
    p_published: false,
  })
  let finalized = await finalize()
  let finalizedRow = firstRow(finalized.data as Array<{ asset_id: string }> | null)
  if (finalized.error || !finalizedRow) {
    logger.warn('media.finalize_retry', {
      tenantId,
      assetId: reservation.asset_id,
      code: finalized.error?.code,
    })
    finalized = await finalize()
    finalizedRow = firstRow(finalized.data as Array<{ asset_id: string }> | null)
  }
  if (!finalized.error && finalizedRow) {
    return {
      ok: true,
      assetId: reservation.asset_id,
      key: uploaded.key,
      url: uploaded.url,
      duplicate: resumedPending,
    }
  }

  logger.warn('media.finalize_failed', {
    tenantId,
    assetId: reservation.asset_id,
    code: finalized.error?.code,
  })
  await cancelReservation(
    supabase,
    tenantId,
    reservation.asset_id,
    'media_finalize_failed',
    true,
  )
  return { ok: false, reason: 'database' }
}

/**
 * Retire URLs only after their owning DB reference has committed. Managed rows
 * always go through request_media_delete; pre-lifecycle URLs keep the old
 * best-effort R2 fallback.
 */
export async function retireManagedImages(
  supabase: SupabaseClient,
  tenantId: string,
  oldUrls: Array<string | null | undefined>,
  newUrls: Array<string | null | undefined> = [],
): Promise<void> {
  const keep = new Set(newUrls.filter((value): value is string => Boolean(value)))
  const retiring = new Set(oldUrls.filter((value): value is string => Boolean(value)))

  for (const url of retiring) {
    if (keep.has(url)) continue
    try {
      const lookup = await supabase
        .from('media_assets')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('url', url)
        .neq('status', 'deleted')
        .limit(1)
        .maybeSingle()

      if (lookup.error) {
        logger.warn('media.retire_lookup_failed', {
          tenantId,
          code: lookup.error.code,
        })
        continue
      }
      if (!lookup.data) {
        if (isTenantOwnedLegacyKey(keyFromPublicUrl(url), tenantId)) {
          await deleteByPublicUrl(url)
        }
        continue
      }

      const retired = await supabase.rpc('request_media_delete', {
        p_tenant: tenantId,
        p_asset: lookup.data.id,
      })
      if (
        retired.error
        && retired.error.code !== '23503'
        && !retired.error.message?.includes('media_asset_in_use')
      ) {
        logger.warn('media.retire_failed', {
          tenantId,
          assetId: lookup.data.id,
          code: retired.error.code,
        })
      }
    } catch (error) {
      logger.warn('media.retire_failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function managedUploadErrorMessage(reason: ManagedUploadFailureReason): string {
  switch (reason) {
    case 'quota':
      return 'Bildkvoten är full. Ta bort en oanvänd bild och försök igen.'
    case 'pending':
      return 'Samma bild håller redan på att laddas upp. Försök igen om en stund.'
    case 'unavailable':
      return 'Samma bild väntar på städning. Försök igen när städningen är klar.'
    case 'database':
      return 'Bilden kunde inte sparas säkert. Försök igen.'
    default:
      return uploadErrorMessage(reason)
  }
}
