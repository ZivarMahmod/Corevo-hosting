'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import type { ActionState } from '@/lib/admin/actions'
import { uploadImage, deleteByPublicUrl, uploadErrorMessage } from '@/lib/r2/upload'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/** Hex sha-256 of a file's bytes — the dubblett-nyckel (content-addressed, the
 *  media_assets.content_hash column's documented purpose). Web Crypto: finns både
 *  på Workers och i node ≥18, inga beroenden. */
async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Upload one or more images into the tenant's library.
 *
 * Each file is written to Cloudflare R2 under media/<tenantId>/… via uploadImage
 * (server-only, never throws — we inspect res.ok). A successful upload is recorded
 * as a media_assets row scoped to ctx.tenant.id; alt/width/height default to null
 * (nullable columns — we do NOT decode image dimensions here). Per-file failures are
 * collected and the loop continues, so one bad file never blocks the rest. NEVER
 * touches any payment/billing table. Never throws.
 *
 * DUBBLETT-VAKT (Zivar: "att det inte blir dubbelt när jag laddar upp"): a file
 * whose sha-256 matches an existing library row's content_hash is SKIPPED (also
 * within the same batch — pick the same file twice, it uploads once). The original
 * filename is not persisted anywhere in media_assets, so the spec's "namn+storlek"
 * degrades to the stronger content check; for LEGACY rows (uploaded before hashing,
 * content_hash IS NULL) an exact size_bytes match is treated as a duplicate — the
 * best available signal until those rows age out. New rows always store their hash.
 */
export async function uploadMediaAssets(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData)
  if (!ctx) return { error: NO_TENANT }

  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return { error: 'Välj minst en bild att ladda upp.' }
  }

  const supabase = await createClient()

  // The library's dubblett-index: known content hashes + the byte sizes of legacy
  // rows without a hash. One tenant-scoped read; small tables (personal library).
  const { data: existing } = await supabase
    .from('media_assets')
    .select('size_bytes, content_hash')
    .eq('tenant_id', ctx.tenant.id)
  const knownHashes = new Set(
    (existing ?? []).map((r) => r.content_hash).filter((h): h is string => Boolean(h)),
  )
  const legacySizes = new Set(
    (existing ?? []).filter((r) => !r.content_hash).map((r) => r.size_bytes),
  )

  let succeeded = 0
  let skipped = 0
  let firstFailure: string | null = null

  for (const file of files) {
    const hash = await sha256Hex(await file.arrayBuffer())
    if (knownHashes.has(hash) || legacySizes.has(file.size)) {
      skipped += 1
      continue
    }

    const res = await uploadImage(file, `media/${ctx.tenant.id}`)
    if (!res.ok) {
      if (!firstFailure) firstFailure = uploadErrorMessage(res.reason)
      continue
    }

    const { error } = await supabase.from('media_assets').insert({
      tenant_id: ctx.tenant.id,
      r2_key: res.key,
      url: res.url,
      type: 'image',
      size_bytes: file.size,
      source: 'upload',
      content_hash: hash,
    })

    if (error) {
      // Row failed to persist — best-effort remove the just-uploaded object so we
      // don't leave an orphan in R2, then record the failure and continue.
      await deleteByPublicUrl(res.url)
      if (!firstFailure) firstFailure = GENERIC
      continue
    }

    // In-batch dedupe: the second copy of the same picked file skips too.
    knownHashes.add(hash)
    succeeded += 1
  }

  revalidatePath('/admin/media')

  const skippedMsg = `Hoppade över ${skipped} dubblett(er).`
  if (succeeded === 0) {
    // Everything was a duplicate and nothing failed → that's a calm success, not
    // an error: the library already holds the images.
    if (skipped > 0 && !firstFailure) {
      return { success: `${skippedMsg} Bilderna finns redan i biblioteket.` }
    }
    return { error: firstFailure ?? GENERIC }
  }

  const parts = [`${succeeded} bild(er) uppladdade.`]
  if (skipped > 0) parts.push(skippedMsg)
  if (firstFailure) parts.push(firstFailure)
  return { success: parts.join(' ') }
}

/**
 * Delete one image from the tenant's library.
 *
 * Fetches the row's public URL first (tenant-scoped), deletes the row (tenant-scoped),
 * then best-effort removes the R2 object by URL (deleteByPublicUrl never throws and
 * runs only AFTER a successful DB delete). No payment/billing writes. Never throws.
 */
export async function deleteMediaAsset(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData)
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar bild.' }

  const supabase = await createClient()

  // Read the URL first so we can prune the R2 object after the row is gone.
  const { data: row } = await supabase
    .from('media_assets')
    .select('url')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()

  const { error } = await supabase
    .from('media_assets')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  // Best-effort cleanup — runs after the DB delete committed; never blocks success.
  await deleteByPublicUrl(row?.url)

  revalidatePath('/admin/media')
  return { success: 'Bild borttagen.' }
}

/**
 * Update an image's alt-text (accessibility caption).
 *
 * Trims the input; empty → null. Tenant-scoped update. No payment/billing writes.
 * Never throws.
 */
export async function updateMediaAlt(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData)
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar bild.' }

  const altRaw = String(formData.get('alt') ?? '').trim()
  const alt = altRaw || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('media_assets')
    .update({ alt })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath('/admin/media')
  return { success: 'Alt-text sparad.' }
}
