'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import {
  managedUploadErrorMessage,
  uploadManagedImage,
} from '@/lib/media/lifecycle'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Upload one or more images into the tenant's library.
 * Every file uses the shared DB reserve -> R2 -> DB finalize path. Quota and
 * same-tenant SHA-256 dedupe are serialized in Postgres before bytes reach R2.
 */
export async function uploadMediaAssets(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData, 'media_library')
  if (!ctx) return { error: NO_TENANT }

  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return { error: 'Välj minst en bild att ladda upp.' }
  }

  const supabase = await createClient()

  let succeeded = 0
  let skipped = 0
  let firstFailure: string | null = null

  for (const file of files) {
    const res = await uploadManagedImage(
      supabase,
      ctx.tenant.id,
      file,
      'upload',
    )
    if (!res.ok) {
      if (!firstFailure) firstFailure = managedUploadErrorMessage(res.reason)
      continue
    }
    if (res.duplicate) skipped += 1
    else succeeded += 1
  }

  revalidatePath('/admin/media')
  revalidatePath('/admin/galleri')

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
 * Marks the row deleting and durably queues R2 cleanup. The worker deletes the
 * object before the DB row can become deleted.
 */
export async function deleteMediaAsset(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData, 'media_library')
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar bild.' }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('request_media_delete', {
    p_tenant: ctx.tenant.id,
    p_asset: id,
  })
  if (error?.code === '23503' || error?.message?.includes('media_asset_in_use')) {
    return {
      error:
        'Bilden används i galleri, blogg, webshop eller på sidan. Ta bort användningen först.',
    }
  }
  if (error?.code === 'P0002' || error?.message?.includes('media_asset_not_found')) {
    return { error: 'Bilden hittades inte.' }
  }
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/media')
  revalidatePath('/admin/galleri')
  const outcome = Array.isArray(data) ? data[0]?.outcome : undefined
  return {
    success:
      outcome === 'already_deleted'
        ? 'Bilden är redan borttagen.'
        : 'Bilden är köad för säker borttagning.',
  }
}

/**
 * Update an image's alt-text (accessibility caption).
 *
 * Trims the input; empty → null. Tenant-scoped update. No payment/billing writes.
 * Never throws.
 */
export async function updateMediaAlt(formData: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(formData, 'media_library')
  if (!ctx) return { error: NO_TENANT }

  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar bild.' }

  const altRaw = String(formData.get('alt') ?? '').trim()
  const alt = altRaw || null

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_media_alt', {
    p_tenant: ctx.tenant.id,
    p_asset: id,
    p_alt: alt ?? '',
  })
  if (error?.code === 'P0002' || error?.message?.includes('media_asset_not_found')) {
    return { error: 'Bilden hittades inte.' }
  }
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/media')
  revalidatePath('/admin/galleri')
  return { success: 'Alt-text sparad.' }
}
