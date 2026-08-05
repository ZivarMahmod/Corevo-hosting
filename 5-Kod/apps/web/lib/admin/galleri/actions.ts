'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { logPlatformAction, type PlatformAuditAction } from '@/lib/platform/audit'
import type { ActionState } from '@/lib/admin/actions'
import { resolveReadyTenantAssetId } from '@/lib/media/lifecycle'
import { GALLERY_RATIOS } from './types'

const READ_ONLY = 'Galleriet kan inte ändras just nu.'
const GENERIC = 'Något gick fel. Försök igen.'

function optionalText(fd: FormData, field: string, max: number): string | null {
  const value = String(fd.get(field) ?? '').trim()
  return value ? value.slice(0, max) : null
}

function galleryFields(fd: FormData):
  | { error: string }
  | {
      asset_id: string
      caption: string | null
      tag: string | null
      year_label: string | null
      aspect_ratio: string | null
      alt_override: string | null
      decorative: boolean
      active: boolean
    } {
  const asset_id = String(fd.get('asset_id') ?? '').trim()
  if (!asset_id) return { error: 'Välj en bild ur Bildbiblioteket.' }

  const decorative = fd.get('decorative') === 'on'
  const alt = optionalText(fd, 'alt_override', 500)
  if (!decorative && !alt) {
    return { error: 'Beskriv bilden eller markera den som dekorativ.' }
  }

  const ratio = String(fd.get('aspect_ratio') ?? '').trim()
  if (ratio && !(GALLERY_RATIOS as readonly string[]).includes(ratio)) {
    return { error: 'Ogiltigt bildformat.' }
  }

  return {
    asset_id,
    caption: optionalText(fd, 'caption', 240),
    tag: optionalText(fd, 'tag', 60),
    year_label: optionalText(fd, 'year_label', 40),
    aspect_ratio: ratio || null,
    alt_override: decorative ? null : alt,
    decorative,
    active: fd.get('active') === 'on',
  }
}

function invalidate(slug: string, tenantId: string) {
  revalidateTenant(slug)
  revalidatePath('/admin/galleri')
  revalidatePath('/admin/media')
  revalidatePath(`/kunder/${tenantId}`)
}

async function platformAudit(
  ctx: Awaited<ReturnType<typeof moduleCtx>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: PlatformAuditAction,
  entityId: string,
) {
  if (!ctx?.user.platformAdmin) return
  await logPlatformAction(supabase, {
    action,
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
    entityId,
  })
}

export async function createGalleryItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'galleri')
  if (!ctx) return { error: READ_ONLY }

  const fields = galleryFields(fd)
  if ('error' in fields) return fields

  const supabase = await createClient()
  if (!await resolveReadyTenantAssetId(supabase, ctx.tenant.id, fields.asset_id)) {
    return { error: 'Bilden finns inte i ditt Bildbibliotek.' }
  }

  const { data, error } = await supabase
    .from('gallery_items')
    .insert({ tenant_id: ctx.tenant.id, ...fields })
    .select('id')
    .maybeSingle()
  if (error || !data) return { error: GENERIC }

  invalidate(ctx.tenant.slug, ctx.tenant.id)
  await platformAudit(ctx, supabase, 'tenant.gallery_item_create', data.id)
  return { success: 'Bilden är tillagd i galleriet.' }
}

export async function updateGalleryItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'galleri')
  if (!ctx) return { error: READ_ONLY }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar galleribild.' }
  const fields = galleryFields(fd)
  if ('error' in fields) return fields

  const supabase = await createClient()
  if (!await resolveReadyTenantAssetId(supabase, ctx.tenant.id, fields.asset_id)) {
    return { error: 'Bilden finns inte i ditt Bildbibliotek.' }
  }

  const { data, error } = await supabase
    .from('gallery_items')
    .update(fields)
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('id')
    .maybeSingle()
  if (error) return { error: GENERIC }
  if (!data) return { error: 'Galleribilden hittades inte.' }

  invalidate(ctx.tenant.slug, ctx.tenant.id)
  await platformAudit(ctx, supabase, 'tenant.gallery_item_update', id)
  return { success: 'Galleribilden är sparad.' }
}

export async function deleteGalleryItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'galleri')
  if (!ctx) return { error: READ_ONLY }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar galleribild.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gallery_items')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('id')
    .maybeSingle()
  if (error) return { error: GENERIC }
  if (!data) return { error: 'Galleribilden hittades inte.' }

  invalidate(ctx.tenant.slug, ctx.tenant.id)
  await platformAudit(ctx, supabase, 'tenant.gallery_item_delete', id)
  return { success: 'Bilden är borttagen ur galleriet. Filen finns kvar i Bildbiblioteket.' }
}

export async function reorderGalleryItems(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'galleri')
  if (!ctx) return { error: READ_ONLY }

  const ids = fd.getAll('ids').map(String).filter(Boolean)
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_gallery_items', {
    p_tenant: ctx.tenant.id,
    p_ids: ids,
  })
  if (error?.message.includes('gallery_reorder_incomplete')) {
    return { error: 'Galleriet ändrades av någon annan. Ladda om och försök igen.' }
  }
  if (error?.message.includes('gallery_module_read_only')) return { error: READ_ONLY }
  if (error) return { error: GENERIC }

  invalidate(ctx.tenant.slug, ctx.tenant.id)
  return { success: 'Ordningen är sparad.' }
}
