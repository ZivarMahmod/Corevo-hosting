'use server'

import { revalidatePath } from 'next/cache'
import { sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { geocodeAddress } from './geocode'
import { normalizeContactEmail, normalizeSocialUrl } from '../contact-validation'

// ── Publik kontakt: e-post + telefon (settings.contact) + adress (primär location) ──
// Super-admin redigerar det som visas i storefrontens footer, utan att logga in i
// kundens egen admin. Öppettider redigeras INTE här — de härleds ur personalens
// veckoscheman (Personal-fliken). Merge, never clobber: settings är co-owned jsonb.

export async function saveTenantContact(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const email = normalizeContactEmail(fd.get('email'))
  if (email === undefined) return { error: 'Ogiltig e-postadress.' }
  const phone = String(fd.get('phone') ?? '').trim().slice(0, 40) || null
  const address = String(fd.get('address') ?? '').trim().slice(0, 300) || null
  const instagram = normalizeSocialUrl(fd.get('instagram'))
  const facebook = normalizeSocialUrl(fd.get('facebook'))
  const tiktok = normalizeSocialUrl(fd.get('tiktok'))
  if (instagram === undefined || facebook === undefined || tiktok === undefined) {
    return { error: 'Ogiltig länk till sociala medier.' }
  }
  const social = { instagram, facebook, tiktok }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, name')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  // 1) contact (email/phone) → settings.contact. MERGE: spread prev, sätt bara contact.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>

  // Karta (settings.map): geokoda bara när adressen ÄNDRATS (Nominatim är rate-
  // begränsad); oförändrad adress behåller sina koordinater. Ingen adress → ingen karta.
  const prevMap = (prev.map ?? null) as { lat?: number; lon?: number; q?: string } | null
  let map: { lat: number; lon: number; q: string } | null =
    prevMap && typeof prevMap.lat === 'number' && typeof prevMap.lon === 'number' && prevMap.q === address
      ? { lat: prevMap.lat, lon: prevMap.lon, q: address ?? '' }
      : null
  if (address && !map) {
    const hit = await geocodeAddress(address)
    if (hit) map = { ...hit, q: address }
  }
  if (!address) map = null

  const settings = { ...prev, contact: { email, phone }, social, map }
  const { error: sErr } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (sErr) {
    await reportActionError('saveTenantContact.settings', sErr, { tenantId })
    return { error: GENERIC }
  }

  // 2) adress → primär location. Uppdatera om den finns; skapa annars en primär plats
  //    (bara när en adress angetts — vi skapar ingen tom plats).
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (loc?.id) {
    const { error: lErr } = await supabase
      .from('locations')
      .update({ address })
      .eq('id', loc.id)
      .eq('tenant_id', tenantId)
    if (lErr) {
      await reportActionError('saveTenantContact.locUpdate', lErr, { tenantId })
      return { error: GENERIC }
    }
  } else if (address) {
    const { error: lErr } = await supabase.from('locations').insert({
      tenant_id: tenantId,
      name: tenant.name ?? 'Huvudadress',
      address,
      timezone: 'Europe/Stockholm',
      is_primary: true,
      active: true,
    })
    if (lErr) {
      await reportActionError('saveTenantContact.locInsert', lErr, { tenantId })
      return { error: GENERIC }
    }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, { action: 'tenant.contact', tenantId, actorId: user.id })
  return {
    success: `Kontakt & adress sparad. Publika sajten uppdaterad.${address && !map ? ' (Kartan hittade inte adressen — kontrollera stavningen.)' : ''}`,
  }
}

// ── Kontakt-INKORGEN: markera läst / arkivera (goal-64) ────────────────────────
// Kontaktformuläret skriver rader i contact_messages och mejlar dem till kunden. Men
// mejl försvinner i en inkorg — kunden måste också kunna LÄSA och beta av dem här.
// Status-FSM:n är avsiktligt trivial: new → read → archived (och tillbaka), inget mer.

const CONTACT_STATUSES = ['new', 'read', 'archived'] as const
type ContactStatus = (typeof CONTACT_STATUSES)[number]

/**
 * Sätt status på ETT kontaktmeddelande. tenant_id tas ur sidaCtx (super-admin ur
 * formuläret, salongsadmin tvingat ur JWT) och läggs som .eq-filter på UPDATE:n —
 * så en kund kan aldrig röra en annan kunds meddelande, oavsett vilket id klienten
 * skickar in.
 */
export async function setContactMessageStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const id = String(fd.get('id') ?? '').trim()
  const status = String(fd.get('status') ?? '').trim() as ContactStatus
  if (!id) return { error: 'Saknar meddelande.' }
  if (!CONTACT_STATUSES.includes(status)) return { error: 'Ogiltig status.' }

  const { error } = await supabase.rpc('platform_set_contact_message_status', {
    p_tenant: tenantId,
    p_message: id,
    p_status: status,
  })
  if (error) {
    await reportActionError('setContactMessageStatus', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/kontakt')
  return { success: status === 'archived' ? 'Meddelandet arkiverat.' : 'Meddelandet markerat som läst.' }
}

// Fasta dag-etiketter (mån→sön) för de manuella öppettiderna.
const OH_DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'] as const

/**
 * Manuella öppettider (settings.opening_hours) — Zivar: "öppettiderna borde kunna
 * ändras under Kontakt; sidan är ju alltid live". Sju rader mån→sön; text per dag
 * (t.ex. "10–19" eller "Stängt"), tomma rader hoppas över. ALLA tomma → nyckeln tas
 * bort och storefronten härleder ur personalens veckoscheman som förut.
 */
export async function saveTenantOpeningHours(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const rows: { day: string; time: string }[] = []
  OH_DAYS.forEach((day, i) => {
    const time = String(fd.get(`hours_${i}`) ?? '').trim().slice(0, 60)
    if (time) rows.push({ day, time })
  })

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev } as { [key: string]: import('@corevo/db').Json }
  if (rows.length > 0) settings.opening_hours = rows
  else delete settings.opening_hours

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantOpeningHours.upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.contact',
    tenantId,
    actorId: user.id,
    meta: { opening_hours: rows.length },
  })
  return {
    success:
      rows.length > 0
        ? 'Öppettider sparade. Publika sajten uppdaterad.'
        : 'Egna öppettider rensade — tiderna härleds ur personalens scheman igen.',
  }
}
