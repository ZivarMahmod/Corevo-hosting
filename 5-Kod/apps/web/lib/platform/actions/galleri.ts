'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { revalidateTenantById } from '@/lib/admin/tenant'

// GALLERIET — super-adminens skrivväg (goal-64, tabell gallery_items i 0057).
//
// Galleriet är den sida ALLA 12 Claude Design-paket har i sitt manifest. Datat måste
// alltså gå att FYLLA, annars är sidan bara en tom mall — och en mall vi inte kan fylla
// är exakt den mock Zivar förbjöd.
//
// Samma söm som services.ts: allt går via platformCtx() (RLS-bypass via platform_admin),
// validerar server-side, litar ALDRIG på klientens tenant_id, och varje write är scopad
// `.eq('tenant_id', tenantId)` så ett manipulerat formulär inte kan röra en annan kunds
// galleri. Efter varje write bustas `tenant:<slug>` (revalidateTenantById) — annars satt
// den nya bilden i unstable_cache i upp till 300 s och kundkortet såg ut att ljuga.
//
// BILDEN ÄGS AV MEDIA_ASSETS: vi laddar aldrig upp här. Operatören VÄLJER en bild ur
// kundens bildbibliotek (asset_id → media_assets). Det håller EN sanning för kundens
// foton, och en bild som raderas ur biblioteket sätter asset_id till null (0057:
// on delete set null) i stället för att lämna en trasig <img>.
//
// De generade Supabase-typerna känner ännu inte 0057 → skrivningar castas till `never`
// (kringgår rad-typkollen) precis som services.ts gör för 0046. Runtime är säker: 0057
// appliceras innan detta shippar.
type GalleryPatch = Record<string, unknown>

/** Fri text → trimmad sträng eller null (blankt = rensa). Capad defensivt. */
function optionalText(fd: FormData, field: string, max: number): string | null {
  const raw = String(fd.get(field) ?? '').trim()
  return raw ? raw.slice(0, max) : null
}

/** "3" → 3 (icke-negativt heltal); blankt/ogiltigt → 0 (standardordning). */
function parseSort(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : 0
}

/**
 * Lägg till en bild i kundens galleri. Bilden MÅSTE komma ur kundens EGET bildbibliotek
 * (asset_id verifieras mot media_assets för samma tenant) — annars kunde ett manipulerat
 * formulär hänga en annan kunds foto i galleriet.
 */
export async function createGalleryItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const assetId = String(fd.get('assetId') ?? '').trim()
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!assetId) return { error: 'Välj en bild ur bildbiblioteket.' }

  // Bilden måste tillhöra DENNA kund (fence mot manipulerade id:n).
  const { data: asset } = await supabase
    .from('media_assets')
    .select('id')
    .eq('id', assetId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!asset) return { error: 'Bilden finns inte i kundens bildbibliotek.' }

  const row: GalleryPatch = {
    tenant_id: tenantId,
    asset_id: assetId,
    caption: optionalText(fd, 'caption', 240),
    tag: optionalText(fd, 'tag', 60),
    year_label: optionalText(fd, 'year_label', 40),
    aspect_ratio: optionalText(fd, 'aspect_ratio', 12),
    sort_order: parseSort(fd.get('sort_order')),
    active: true,
  }

  const { data: created, error } = await supabase
    .from('gallery_items')
    .insert(row as never)
    .select('id')
    .single()
  if (error || !created) {
    await reportActionError('createGalleryItem.insert', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.gallery_item_create',
    tenantId,
    actorId: user.id,
    entityId: created.id,
  })
  return { success: 'Bild tillagd i galleriet.' }
}

/** Redigera en galleribilds text/ordning/synlighet. Scopad till kunden. */
export async function updateGalleryItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const itemId = String(fd.get('itemId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!itemId) return { error: 'Saknar bild.' }

  const patch: GalleryPatch = {
    caption: optionalText(fd, 'caption', 240),
    tag: optionalText(fd, 'tag', 60),
    year_label: optionalText(fd, 'year_label', 40),
    aspect_ratio: optionalText(fd, 'aspect_ratio', 12),
    sort_order: parseSort(fd.get('sort_order')),
    active: fd.get('active') === 'on',
  }

  const { error } = await supabase
    .from('gallery_items')
    .update(patch as never)
    .eq('id', itemId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('updateGalleryItem.update', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.gallery_item_update',
    tenantId,
    actorId: user.id,
    entityId: itemId,
  })
  return { success: 'Bild sparad.' }
}

/**
 * Ta bort en galleribild. Raderar BARA gallery_items-raden — själva fotot bor kvar i
 * kundens bildbibliotek (media_assets). Att radera R2-objektet härifrån vore att kasta
 * bort en bild kunden kanske använder på en annan sida.
 */
export async function deleteGalleryItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const itemId = String(fd.get('itemId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!itemId) return { error: 'Saknar bild.' }

  const { error } = await supabase
    .from('gallery_items')
    .delete()
    .eq('id', itemId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('deleteGalleryItem.delete', error, { tenantId })
    return { error: GENERIC }
  }

  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.gallery_item_delete',
    tenantId,
    actorId: user.id,
    entityId: itemId,
  })
  return { success: 'Bild borttagen ur galleriet. Fotot finns kvar i bildbiblioteket.' }
}
