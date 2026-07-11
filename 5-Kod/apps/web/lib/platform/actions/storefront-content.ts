'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { uploadImage, deleteByPublicUrl } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { TenantBranding } from '@corevo/ui'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { recordMediaAsset } from './media-record'

// ── Super-admin storefront CONTENT (editorial copy + hero/gallery photos) ─────────
// The platform operator manages a CHOSEN tenant's public storefront from
// /salonger/[id] without logging into the salon's own admin. Two co-owned jsonb
// columns are touched, each by the ONE action that owns its slice:
//   • COPY   → tenant_settings.settings.copy   (the M2↔M6 CopyOverride contract)
//   • MEDIA  → tenant_settings.branding.{hero_images,gallery_images}
// Both are read-modify-write (spread `...prev` / mergeBranding): every OTHER key —
// settings.theme/look/booking/contact/flags · branding.colours/font/logo/about/
// closing/team/stats — MUST survive untouched (the savePlatformBranding-clobber
// bug). Each `.upsert({ tenant_id, <col> })` writes ONLY that column (ON CONFLICT
// DO UPDATE SET <col>=…), so the sibling column is never even in the write set.
// All actions are dual-guarded via sidaCtx (platform admin: any tenant via form; salon admin: OWN tenant forced from the session) and validate the tenant
// server-side (the `select('slug')` read doubles as the existence check + the slug
// needed to bust the cached public bundle so the change goes live immediately).

// EN sanning för vilka copy-nycklar som finns: COPY_OVERRIDE_KEYS i theme-content.ts
// (samma lista som resolvern läser och bransch-mallen sparar). Den lokala literal-
// listan här var en TYST DUBBLETT — flora-editorns 20 nya pelare/band-fält fanns i
// editorn och i resolvern men inte här, så spar-loopen slängde dem med grön toast.
import { COPY_OVERRIDE_KEYS } from '@/components/storefront/theme-content'
const COPY_FIELDS = COPY_OVERRIDE_KEYS
type CopyField = (typeof COPY_FIELDS)[number]

// Längd-tak per fältTYP i stället för per fält (generöst; temats defaults ligger
// långt under). Brödtext-fält får långt tak, ledes mellanting, resten rubrik-tak.
function copyMax(field: CopyField): number {
  if (field.endsWith('Body') || field.endsWith('Copy') || field === 'aboutCopyHome') return 4000
  if (field.endsWith('Lede') || field.endsWith('Intro') || field.endsWith('Lead') || field === 'italic') return 600
  return 200
}

/**
 * Save a tenant's storefront editorial COPY (heroEyebrow/heroTitle/heroLede/
 * aboutCopy/tagline/italic) into `settings.copy`. Per the CopyOverride contract a
 * BLANK field means "fall back to the theme default", so a blank field is OMITTED
 * from the stored object (never persisted as an empty override). heroTitle may carry
 * an inner `\n` (two-line hero) — only outer whitespace is trimmed for the is-it-set
 * test and the stored value. MERGE: spread `...prev` settings, then set only `copy`,
 * so theme/look/booking/contact/flags are all preserved.
 */
export async function saveTenantStorefrontCopy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar salong.' }

  // Existence check + slug for the cache-bust (server-side tenant validation).
  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevCopy = (prev.copy && typeof prev.copy === 'object' ? prev.copy : {}) as Record<string, string>

  // Build the override — PER FÄLT (Sida v4 delar texten över flera formulär, ett per
  // publik sida): ett fält som INTE skickades (fd.get === null) behåller sitt sparade
  // värde, ett skickat BLANKT fält rensas (= temats standard), ett skickat värde
  // skrivs. Så kan Hem-formuläret aldrig nolla Om-sidans text.
  const copy: Record<string, string> = { ...prevCopy }
  for (const field of COPY_FIELDS) {
    const posted = fd.get(field)
    if (posted === null) continue // fältet fanns inte i formuläret → rör ej
    const raw = String(posted).trim()
    if (raw.length > 0) copy[field] = raw.slice(0, copyMax(field))
    else delete copy[field]
  }

  // MERGE: preserve every existing settings key; overwrite ONLY `copy`. An empty
  // `copy` object is a legit "all fields follow the theme" state.
  const settings = { ...prev, copy }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantStorefrontCopy.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // Bust the cached public bundle so the copy shows live, + refresh the admin view.
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.storefront_copy',
    tenantId,
    actorId: user.id,
    meta: { fields: Object.keys(copy).length },
  })
  return { success: 'Storefront-text sparad. Publika sajten uppdaterad.' }
}

type Slot = 'hero' | 'gallery'
function slotKey(slot: Slot): 'hero_images' | 'gallery_images' {
  return slot === 'hero' ? 'hero_images' : 'gallery_images'
}
function isSlot(v: string): v is Slot {
  return v === 'hero' || v === 'gallery'
}
/** Human-readable Swedish message for a non-ok upload (storefront-photo wording). */
function photoUploadError(reason: string): string {
  switch (reason) {
    case 'bad_type':
      return 'Bilden måste vara PNG, JPG, WEBP, SVG eller GIF.'
    case 'too_large':
      return 'Bilden är för stor (max 8 MB).'
    case 'no_public_base':
    case 'no_binding':
      return 'Bilduppladdning är inte aktiverad i denna miljö (kräver R2 + R2_PUBLIC_BASE_URL).'
    default:
      return 'Uppladdningen misslyckades. Försök igen.'
  }
}

/**
 * Upload one storefront photo and APPEND its public url to `branding.hero_images`
 * (slot='hero') or `branding.gallery_images` (slot='gallery'). MERGE-preserves every
 * other branding key (colours/font/logo/about/closing/team/stats) via mergeBranding.
 */
export async function uploadTenantStorefrontImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar salong.' }

  const slotRaw = String(fd.get('slot') ?? '')
  if (!isSlot(slotRaw)) return { error: 'Ogiltig bild-slot.' }
  const slot = slotRaw

  const image = fd.get('image')
  if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const res = await uploadImage(image, `tenants/${tenantId}/storefront`)
  if (!res.ok) return { error: photoUploadError(res.reason) }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const key = slotKey(slot)
  const prevArr = prev[key]
  const arr = Array.isArray(prevArr) ? prevArr : []
  const next = [...arr, res.url]
  // MERGE: write ONLY this slot's array; every other branding key falls through prev.
  const patch: Partial<TenantBranding> = slot === 'hero' ? { hero_images: next } : { gallery_images: next }
  const branding = mergeBranding(prev, patch)

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('uploadTenantStorefrontImage.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // A9: synlig i Bildbiblioteket (best-effort, fäller aldrig save).
  await recordMediaAsset(supabase, tenantId, image, res, 'sajtbyggare')

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.storefront_image_add',
    tenantId,
    actorId: user.id,
    meta: { slot, count: next.length },
  })
  return { success: slot === 'hero' ? 'Hero-bild tillagd. Publika sajten uppdaterad.' : 'Galleri-bild tillagd. Publika sajten uppdaterad.' }
}

/**
 * Remove ONE storefront photo (by url) from `branding.hero_images` or
 * `branding.gallery_images`. MERGE-preserves every other branding key; the removed
 * R2 object is deleted best-effort AFTER the DB write (FX-14 replace-don't-accumulate,
 * never throws / never blocks the save).
 */
export async function removeTenantStorefrontImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar salong.' }

  const slotRaw = String(fd.get('slot') ?? '')
  if (!isSlot(slotRaw)) return { error: 'Ogiltig bild-slot.' }
  const slot = slotRaw

  const url = String(fd.get('url') ?? '').trim()
  if (!url) return { error: 'Saknar bild.' }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const key = slotKey(slot)
  const prevArr = prev[key]
  const arr = Array.isArray(prevArr) ? prevArr : []
  // Tenant-scope fence: url är klient-input — bara en bild som faktiskt LIGGER i
  // den här tenantens slot får röras. Utan kollen kunde en salon_admin R2-radera
  // en annan salongs (publikt läsbara) bild-URL via sin egen action.
  if (!arr.includes(url)) return { error: 'Bilden finns inte i denna slot.' }
  const next = arr.filter((u) => u !== url)
  // MERGE: write ONLY this slot's array; every other branding key falls through prev.
  const patch: Partial<TenantBranding> = slot === 'hero' ? { hero_images: next } : { gallery_images: next }
  const branding = mergeBranding(prev, patch)

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('removeTenantStorefrontImage.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // Best-effort R2 cleanup AFTER the commit (never blocks / never throws).
  await deleteByPublicUrl(url)

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.storefront_image_remove',
    tenantId,
    actorId: user.id,
    meta: { slot, count: next.length },
  })
  return { success: 'Bild borttagen. Publika sajten uppdaterad.' }
}
