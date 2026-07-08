'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { uploadImage, deleteByPublicUrl } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { revalidateTenant } from '@/lib/admin/tenant'
import type { TenantBranding } from '@corevo/ui'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── Rikare-tema-media: about_image + closing_image (enkla bild-slots) + stats-par ──
// Används av de RIKARE mallarna (Salvia m.fl.), inte FreshCut. Skriver branding-jsonb;
// mergeBranding bevarar alla övriga fält. All actions platform_admin-gatade.

type SingleSlot = 'about' | 'closing'
function isSingleSlot(v: string): v is SingleSlot {
  return v === 'about' || v === 'closing'
}
function singleKey(s: SingleSlot): 'about_image' | 'closing_image' {
  return s === 'about' ? 'about_image' : 'closing_image'
}

/**
 * Sätt ELLER ta bort en enkel bild-slot (about_image / closing_image). remove=true →
 * null (falla tillbaka på temats standard); annars laddas den bifogade filen upp och
 * url:en sparas. Gamla objektet städas best-effort efter commit (FX-14).
 */
export async function saveTenantSingleImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const slotRaw = String(fd.get('slot') ?? '')
  if (!isSingleSlot(slotRaw)) return { error: 'Ogiltig bild-slot.' }
  const key = singleKey(slotRaw)
  const remove = String(fd.get('remove') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const prevUrl = typeof prev[key] === 'string' ? (prev[key] as string) : null

  let nextUrl: string | null = prevUrl
  if (remove) {
    nextUrl = null
  } else {
    const image = fd.get('image')
    if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }
    const res = await uploadImage(image, `tenants/${tenantId}/storefront`)
    if (!res.ok) return { error: 'Uppladdningen misslyckades. Försök igen (PNG/JPG/WEBP, max 2 MB).' }
    nextUrl = res.url
  }

  const branding = mergeBranding(prev, { [key]: nextUrl } as Partial<TenantBranding>)
  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantSingleImage.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  // Städa gamla objektet när det byttes/togs bort (aldrig blockerande).
  if (prevUrl && prevUrl !== nextUrl) await deleteByPublicUrl(prevUrl)

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: remove ? 'tenant.storefront_image_remove' : 'tenant.storefront_image_add',
    tenantId,
    actorId: user.id,
    meta: { slot: slotRaw },
  })
  return { success: remove ? 'Bild borttagen. Publika sajten uppdaterad.' : 'Bild sparad. Publika sajten uppdaterad.' }
}

const STAT_ROWS = 4 // enough for the richest theme's stat strip

/**
 * Spara statistik-paren (branding.stats = [label, value][]). Läser stat_label_i /
 * stat_value_i; en rad tas med bara när BÅDA fälten är ifyllda. Tom lista = falla
 * tillbaka på temats standard-stats.
 */
export async function saveTenantStats(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar salong.' }

  const stats: [string, string][] = []
  for (let i = 0; i < STAT_ROWS; i++) {
    const label = String(fd.get(`stat_label_${i}`) ?? '').trim().slice(0, 60)
    const value = String(fd.get(`stat_value_${i}`) ?? '').trim().slice(0, 60)
    if (label && value) stats.push([label, value])
  }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const branding = mergeBranding(prev, { stats } as Partial<TenantBranding>)
  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantStats.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, { action: 'tenant.storefront_copy', tenantId, actorId: user.id, meta: { stats: stats.length } })
  return { success: 'Fakta sparad. Publika sajten uppdaterad.' }
}
