'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, type AdminTenant } from '@/lib/admin/tenant'
import type { ActionState } from '@/lib/admin/actions'
import { uploadImage, deleteByPublicUrl, uploadErrorMessage } from '@/lib/r2/upload'

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Authorization fence for every media mutation. Mirrors lib/admin/presentkort/actions.ts:
 * requirePortal('admin') + getAdminTenant, which together verify the caller's role AND
 * resolve the tenant (id + slug) for scoped writes. RLS is defence-in-depth, not a
 * substitute.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
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
 */
export async function uploadMediaAssets(formData: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const files = formData
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) {
    return { error: 'Välj minst en bild att ladda upp.' }
  }

  const supabase = await createClient()

  let succeeded = 0
  let firstFailure: string | null = null

  for (const file of files) {
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
    })

    if (error) {
      // Row failed to persist — best-effort remove the just-uploaded object so we
      // don't leave an orphan in R2, then record the failure and continue.
      await deleteByPublicUrl(res.url)
      if (!firstFailure) firstFailure = GENERIC
      continue
    }

    succeeded += 1
  }

  revalidatePath('/admin/media')

  if (succeeded === 0) {
    return { error: firstFailure ?? GENERIC }
  }

  const base = `${succeeded} bild(er) uppladdade.`
  return { success: firstFailure ? `${base} ${firstFailure}` : base }
}

/**
 * Delete one image from the tenant's library.
 *
 * Fetches the row's public URL first (tenant-scoped), deletes the row (tenant-scoped),
 * then best-effort removes the R2 object by URL (deleteByPublicUrl never throws and
 * runs only AFTER a successful DB delete). No payment/billing writes. Never throws.
 */
export async function deleteMediaAsset(formData: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
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
  const ctx = await adminCtx()
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
