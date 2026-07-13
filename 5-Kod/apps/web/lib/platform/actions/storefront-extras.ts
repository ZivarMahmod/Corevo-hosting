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
import { recordMediaAsset } from './media-record'

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
  if (!tenantId) return { error: 'Saknar kund.' }

  const slotRaw = String(fd.get('slot') ?? '')
  if (!isSingleSlot(slotRaw)) return { error: 'Ogiltig bild-slot.' }
  const key = singleKey(slotRaw)
  const remove = String(fd.get('remove') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as TenantBranding
  const prevUrl = typeof prev[key] === 'string' ? (prev[key] as string) : null

  let nextUrl: string | null = prevUrl
  let uploaded: { file: File; url: string; key: string } | null = null
  if (remove) {
    nextUrl = null
  } else {
    const image = fd.get('image')
    if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }
    const res = await uploadImage(image, `tenants/${tenantId}/storefront`)
    if (!res.ok) return { error: uploadErrorMessage(res.reason) }
    nextUrl = res.url
    uploaded = { file: image, url: res.url, key: res.key }
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

  // A9: synlig i Bildbiblioteket (best-effort, fäller aldrig save).
  if (uploaded) await recordMediaAsset(supabase, tenantId, uploaded.file, uploaded, 'sajtbyggare')

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
  if (!tenantId) return { error: 'Saknar kund.' }

  const stats: [string, string][] = []
  for (let i = 0; i < STAT_ROWS; i++) {
    const label = String(fd.get(`stat_label_${i}`) ?? '').trim().slice(0, 60)
    const value = String(fd.get(`stat_value_${i}`) ?? '').trim().slice(0, 60)
    // ORDNING = ThemeStat = [värde, etikett] — mallarna renderar ([n, l]) med n som
    // stora talet. Tidigare sparades [etikett, värde] → omkastat på publika sidan.
    if (label && value) stats.push([value, label])
  }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

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
  if (!tenantId) return { error: 'Saknar kund.' }

  const idxRaw = String(fd.get('index') ?? '')
  const index = idxRaw === '' ? null : Number(idxRaw)
  if (index !== null && (!Number.isInteger(index) || index < 0)) return { error: 'Ogiltig medlem.' }
  const remove = String(fd.get('remove') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

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
  let uploaded: { file: File; url: string; key: string } | null = null
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
      uploaded = { file: image, url: res.url, key: res.key }
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

  // A9: synlig i Bildbiblioteket (best-effort, fäller aldrig save).
  if (uploaded) await recordMediaAsset(supabase, tenantId, uploaded.file, uploaded, 'sajtbyggare')

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

// ── Personal-teamet på publika sidan (staff.avatar_url + staff.show_on_site, 0049) ──
// "Våra barberare" härleds numera ur RIKTIGA staff-rader (lib/tenant-data →
// loadStaffTeam): aktiva medarbetare med show_on_site=true VINNER över den gamla
// settings-listan (branding.team) så fort minst en synlig medlem finns. De två
// actions nedan redigerar den källan från Sida-ytan — delad mellan super-adminens
// kundkort (/salonger/[id]) och kundens /admin/sida via sidaCtx-dubbelguarden,
// precis som övriga SIDA-actions i den här filen.

/**
 * Byt eller ta bort en medarbetares foto (staff.avatar_url) från Sida-ytan.
 * remove=true → null (standard-silhuett visas på sidan); annars laddas den
 * bifogade filen upp till R2 under tenants/<id>/staff. Gamla objektet städas
 * best-effort EFTER commit och BARA när det är medarbetarens EGNA lagrade
 * avatar_url (läst ur DB ovan — aldrig en klient-skickad URL; samma fence-princip
 * som removeTenantStorefrontImage). deleteByPublicUrl vägrar dessutom främmande
 * origins (keyFromPublicUrl base-check), så en förgiftad rad kan inte radera annat.
 */
export async function saveTenantStaffPhoto(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const staffId = String(fd.get('staffId') ?? '')
  if (!staffId) return { error: 'Saknar medarbetare.' }
  const remove = String(fd.get('remove') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  // Medlemskontroll: staffId är klient-input — bekräfta att raden är TENANTENS
  // innan write/städning (samma lucka som setStaffServices vaktar; RLS isolerar
  // inte roller inom tenanten och platform_admin läser allt).
  const { data: member } = await supabase
    .from('staff')
    .select('id, avatar_url')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }
  const prevUrl = member.avatar_url

  let nextUrl: string | null = null
  let uploadedPhoto: { file: File; url: string; key: string } | null = null
  if (!remove) {
    const image = fd.get('image')
    if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }
    const res = await uploadImage(image, `tenants/${tenantId}/staff`)
    if (!res.ok) return { error: uploadErrorMessage(res.reason) }
    nextUrl = res.url
    uploadedPhoto = { file: image, url: res.url, key: res.key }
  }

  const { error } = await supabase
    .from('staff')
    .update({ avatar_url: nextUrl })
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
  if (error) {
    // Nyss uppladdat objekt utan DB-rad → städa direkt så inget orphan blir kvar.
    if (nextUrl) await deleteByPublicUrl(nextUrl)
    await reportActionError('saveTenantStaffPhoto.update', error, { tenantId })
    return { error: GENERIC }
  }

  // Städa gamla objektet när det byttes/togs bort (aldrig blockerande, FX-14).
  if (prevUrl && prevUrl !== nextUrl) await deleteByPublicUrl(prevUrl)

  // A9: synlig i Bildbiblioteket (best-effort, fäller aldrig save).
  if (uploadedPhoto) {
    await recordMediaAsset(supabase, tenantId, uploadedPhoto.file, uploadedPhoto, 'sajtbyggare')
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  revalidatePath('/admin/personal')
  await logPlatformAction(supabase, {
    action: 'tenant.staff_update',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { field: 'avatar_url', removed: remove },
  })
  return {
    success: remove
      ? 'Foto borttaget — standard-silhuett visas. Publika sajten uppdaterad.'
      : 'Foto sparat. Publika sajten uppdaterad.',
  }
}

/**
 * Visa/dölj en medarbetare i publika team-sektionen (staff.show_on_site, 0049).
 * Rör ALDRIG bokningsbarheten — den styrs som förut av staff.active. En dold
 * medarbetare går alltså fortfarande att boka; hen syns bara inte under
 * "Våra barberare".
 */
export async function setTenantStaffOnSite(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const staffId = String(fd.get('staffId') ?? '')
  if (!staffId) return { error: 'Saknar medarbetare.' }
  const show = String(fd.get('show') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  // Samma medlemsfence som saveTenantStaffPhoto (staffId är klient-input).
  const { data: member } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

  const { error } = await supabase
    .from('staff')
    .update({ show_on_site: show })
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('setTenantStaffOnSite.update', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  revalidatePath('/admin/personal')
  await logPlatformAction(supabase, {
    action: 'tenant.staff_update',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { field: 'show_on_site', show },
  })
  return {
    success: show
      ? 'Medarbetaren visas på sidan. Publika sajten uppdaterad.'
      : 'Medarbetaren döljs från sidan (fortfarande bokningsbar). Publika sajten uppdaterad.',
  }
}

/**
 * TEAM-PRESENTATIONEN (goal-64, kolumnerna i 0057): kortnamn · specialiteter · bio.
 *
 * De tre salong-mallarna har `team` som egen nav-punkt och deras teamkort visar just de
 * här tre fälten. Utan skrivväg hade sidan bara kunnat visa namn + foto — dvs. mallen
 * hade amputerats, vilket är förbjudet. Fälten är REN PRESENTATION: de rör aldrig
 * bokningsbarheten (staff.active) eller synligheten (staff.show_on_site).
 *
 * BLANKT = RENSAT (null), aldrig tom sträng: storefronten är render-on-present, och ett
 * fält med "" skulle rendera en tom rad i stället för att försvinna.
 *
 * short_name/specialties/bio ligger i 0057 → de generade Supabase-typerna känner dem inte
 * än, därför `as never` på patchen (samma mönster som services.ts merch-kolumner).
 */
export async function saveTenantStaffProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const staffId = String(fd.get('staffId') ?? '')
  if (!staffId) return { error: 'Saknar medarbetare.' }

  const trim = (field: string, max: number): string | null => {
    const raw = String(fd.get(field) ?? '').trim()
    return raw ? raw.slice(0, max) : null
  }
  const shortName = trim('short_name', 40)
  const specialties = trim('specialties', 200)
  const bio = trim('bio', 1200)

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  // Samma medlemsfence som saveTenantStaffPhoto (staffId är klient-input).
  const { data: member } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

  const { error } = await supabase
    .from('staff')
    .update({ short_name: shortName, specialties, bio } as never)
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('saveTenantStaffProfile.update', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  revalidatePath('/admin/personal')
  await logPlatformAction(supabase, {
    action: 'tenant.staff_update',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { field: 'team_profile' },
  })
  return { success: 'Presentationen sparad. Syns på teamsidan.' }
}
