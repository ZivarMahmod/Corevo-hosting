'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { uploadImage, uploadErrorMessage, deleteByPublicUrl } from '@/lib/r2/upload'
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
  const { user, supabase, tenantId } = await sidaCtx(fd)
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
    if (!res.ok) return { error: uploadErrorMessage(res.reason) }
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
  revalidatePath('/admin/sida')
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
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar salong.' }

  const stats: [string, string][] = []
  for (let i = 0; i < STAT_ROWS; i++) {
    const label = String(fd.get(`stat_label_${i}`) ?? '').trim().slice(0, 60)
    const value = String(fd.get(`stat_value_${i}`) ?? '').trim().slice(0, 60)
    // ORDNING = ThemeStat = [värde, etikett] — mallarna renderar ([n, l]) med n som
    // stora talet. Tidigare sparades [etikett, värde] → omkastat på publika sidan.
    if (label && value) stats.push([value, label])
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
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, { action: 'tenant.storefront_copy', tenantId, actorId: user.id, meta: { stats: stats.length } })
  return { success: 'Fakta sparad. Publika sajten uppdaterad.' }
}

type TeamMember = { name: string; role: string; img: string }

/**
 * Team på Om oss-sidan (branding.team) — Zivar: "det finns en barberare men inget
 * står om den i storefront; Om oss-sidan är för bild och lite text på barberaren,
 * Personal-fliken sköter det tekniska". En medlem per submit: index='' = lägg till,
 * index=N = uppdatera (bild valfri — behåller den gamla), remove=true = ta bort.
 * Ersatta/borttagna foton städas best-effort ur R2 efter commit (FX-14).
 */
export async function saveTenantTeamMember(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar salong.' }

  const idxRaw = String(fd.get('index') ?? '')
  const index = idxRaw === '' ? null : Number(idxRaw)
  if (index !== null && (!Number.isInteger(index) || index < 0)) return { error: 'Ogiltig medlem.' }
  const remove = String(fd.get('remove') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const team: TeamMember[] = (Array.isArray(prev.team) ? prev.team : []).map((m) => ({
    name: typeof m?.name === 'string' ? m.name : '',
    role: typeof m?.role === 'string' ? m.role : '',
    img: typeof m?.img === 'string' ? m.img : '',
  }))

  let removedImg: string | null = null
  if (remove) {
    if (index === null || index >= team.length) return { error: 'Okänd medlem.' }
    removedImg = team[index]!.img || null
    team.splice(index, 1)
  } else {
    const name = String(fd.get('name') ?? '').trim().slice(0, 80)
    const role = String(fd.get('role') ?? '').trim().slice(0, 300)
    if (!name) return { error: 'Ange ett namn.' }

    const prevImg = index !== null ? (team[index]?.img ?? '') : ''
    let img = prevImg
    const image = fd.get('image')
    if (image instanceof File && image.size > 0) {
      const res = await uploadImage(image, `tenants/${tenantId}/team`)
      if (!res.ok) return { error: uploadErrorMessage(res.reason) }
      img = res.url
      if (prevImg) removedImg = prevImg
    }

    const member: TeamMember = { name, role, img }
    if (index === null) team.push(member)
    else if (index < team.length) team[index] = member
    else return { error: 'Okänd medlem.' }
  }

  const branding = mergeBranding(prev, { team } as Partial<TenantBranding>)
  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, branding }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantTeamMember.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  if (removedImg) await deleteByPublicUrl(removedImg)

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.storefront_copy',
    tenantId,
    actorId: user.id,
    meta: { team: team.length, removed: remove },
  })
  return { success: remove ? 'Medlem borttagen. Publika sajten uppdaterad.' : 'Medlem sparad. Publika sajten uppdaterad.' }
}
