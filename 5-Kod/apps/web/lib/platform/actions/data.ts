'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx, sidaCtx } from '../guard'
import { logPlatformAction } from '../audit'
import {
  isBookingVariant,
  DEFAULT_BOOKING_VARIANT,
  PICKER_MODES,
  STAFF_AVATAR_MODES,
  type BookingVariant,
  type PickerMode,
  type StaffAvatarMode,
} from '../booking-variant'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// ── §2.1B Operativ data-kontroll ("Supabase med mitt UI", no-code) ──────────────

/** https-URL or null (empty), else undefined = invalid. Mirrors M6's httpsUrlOrNull
 *  so the operator gets the same friendly rejection on a bad review link. */
function httpsUrlOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  try {
    return new URL(v).protocol === 'https:' ? v : undefined
  } catch {
    return undefined
  }
}

/**
 * Edit a tenant's safe operative fields from the platform UI: salon name,
 * Google-review link, and the booking-vy-val (Variant 3/4). This is Zivar's
 * "klicka i mitt UI istället för rå Supabase" surface.
 *
 * MERGE, never clobber: settings is a jsonb co-owned with M6 (contact,
 * notifications, cancellation, layout, theme …). We read prev settings and spread
 * `...prev` before writing OUR keys — the B1/§3 settings-krock guard. `slug` is
 * deliberately NOT editable here (live subdomain, cached + RLS-bound).
 */
export async function saveTenantData(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }

  const name = String(fd.get('name') ?? '').trim()
  // Stad (#14): editable here too. Absent field → undefined = leave as-is; present but
  // blank → null (clear). Lets a later edit-UI thread city without forcing it.
  const cityRaw = fd.get('city')
  const city = cityRaw === null ? undefined : String(cityRaw).trim().slice(0, 120) || null
  const reviewUrl = httpsUrlOrNull(fd.get('google_review_url'))
  // Boknings-vyn redigeras numera i Sida-fliken (saveTenantBookingView). Fältet kan
  // ändå skickas av äldre formulär: giltigt värde skrivs, saknat/ogiltigt fält lämnar
  // den sparade varianten ORÖRD (tidigare föll den tyst tillbaka till default — en
  // namn-spar utan radios nollade salongens val).
  const variantRaw = String(fd.get('booking_variant') ?? '')

  if (!name) return { error: 'Ange ett företagsnamn.' }
  if (reviewUrl === undefined)
    return { error: 'Ogiltig recensionslänk. Använd en https-länk, t.ex. https://g.page/r/.../review.' }
  const bookingVariant: BookingVariant | null = isBookingVariant(variantRaw) ? variantRaw : null

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  // 1) tenant name (+ city when the field is present) — feeds the cached public bundle
  //    (same field M6 saveSettings edits). city omitted = untouched; '' = cleared.
  const tenantPatch: { name: string; city?: string | null } = { name }
  if (city !== undefined) tenantPatch.city = city
  const { error: nErr } = await supabase.from('tenants').update(tenantPatch).eq('id', tenantId)
  if (nErr) {
    await reportActionError('saveTenantData.tenant_update', nErr, { tenantId })
    return { error: GENERIC }
  }

  // 2) settings jsonb — MERGE prev (never replace). google_review_url is co-owned
  //    with M6; booking.variant is M7's key (M3 reads tenant_settings.settings.booking).
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevBooking = (prev.booking ?? {}) as Record<string, unknown>
  const settings = {
    ...prev,
    google_review_url: reviewUrl, // M6/M7 co-own (FAS0 §3) — null = nudge off
    // variant bara när formuläret faktiskt skickade en giltig — annars behåll prev.
    booking: { ...prevBooking, variant: bookingVariant ?? (prevBooking.variant as string | undefined) },
  }
  const { error: sErr } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (sErr) {
    await reportActionError('saveTenantData.settings_upsert', sErr, { tenantId })
    return { error: GENERIC }
  }

  // Bust the cached public bundle so the new name/review link/variant show live.
  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { name, booking_variant: bookingVariant, review_url: reviewUrl ? 'set' : 'cleared' },
  })
  return { success: 'Kunddata sparad. Publika sajten uppdaterad.' }
}

/**
 * Juridikfält (goal-72 etapp 1c, plan 003-slutet): org-nr + moms-sats till
 * settings.legal ({ org_nr, vat_rate } — samma seam som lib/tenant-data parsar
 * för villkorssidan och kvittot). MERGE, aldrig clobber. Tomt fält = null =
 * konsumenterna utelämnar raden.
 */
export async function saveTenantLegal(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }

  const orgNr = String(fd.get('org_nr') ?? '').trim().slice(0, 40) || null
  const vatRaw = String(fd.get('vat_rate') ?? '').trim().replace(',', '.')
  let vatRate: number | null = null
  if (vatRaw) {
    const n = Number(vatRaw)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { error: 'Momssatsen ska vara ett tal mellan 0 och 100 (t.ex. 25).' }
    }
    vatRate = n
  }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevLegal = (prev.legal ?? {}) as Record<string, unknown>
  const settings = { ...prev, legal: { ...prevLegal, org_nr: orgNr, vat_rate: vatRate } }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('saveTenantLegal.settings_upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { legal_org_nr: orgNr ? 'set' : 'cleared', legal_vat_rate: vatRate },
  })
  return { success: 'Juridikuppgifter sparade. Villkor och kvitton uppdaterade.' }
}

/**
 * Salongsnamn — eget thin-kort i Sida-flikens Allmänt (Zivar: "salongsnamnet från
 * Drift ska komma in här — det är högst upp på sidan om ingen logga finns").
 * Sparar ENDAST tenants.name så det inte drar med sig recensionslänk/variant
 * (saveTenantData nollar google_review_url när fältet saknas i formuläret).
 */
export async function saveTenantName(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  if (!name) return { error: 'Ange ett företagsnamn.' }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { error } = await supabase.from('tenants').update({ name }).eq('id', tenantId)
  if (error) {
    await reportActionError('saveTenantName.tenant_update', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { name },
  })
  return { success: 'Namn sparat. Publika sajten uppdaterad.' }
}


/**
 * Bokningsinställningar — designpaketet "Frisörbokningsformulär redesign" ⭐-kravet:
 * ALLT i bokningsflödet valbart per salong från admin (/admin/bokning + kundkortets
 * Sida-flik), utan kodändring per kund. Skriver de TRE booking-prefs-axlarna i ETT
 * svep till tenant_settings.settings.booking (samma seam som saveTenantBookingView):
 *   variant      — 'wizard' | 'compact' | 'drawer' | 'inline'  (bokningssätt)
 *   pickerMode   — 'calendar' | 'strip'                        (tid-väljare)
 *   staffAvatars — 'foto' | 'initialer' | 'namn'               (barberarbilder)
 * MERGE, aldrig clobber: settings är co-owned jsonb — prev spread:as, och prev
 * booking-nycklar utanför de tre behålls. Färgerna går INTE här — de bor i
 * branding (savePlatformBranding), som injectTenantTokens redan konsumerar.
 */
export async function updateBookingSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const variantRaw = String(fd.get('booking_variant') ?? '')
  const pickerRaw = String(fd.get('picker_mode') ?? '')
  const avatarsRaw = String(fd.get('staff_avatars') ?? '')
  // Okänt/saknat värde → samma defaults som läs-seamen (readPickerMode/
  // readStaffAvatarMode) så spar aldrig kan landa på ett odefinierat läge.
  const variant: BookingVariant = isBookingVariant(variantRaw) ? variantRaw : DEFAULT_BOOKING_VARIANT
  const pickerMode: PickerMode = (PICKER_MODES as readonly string[]).includes(pickerRaw)
    ? (pickerRaw as PickerMode)
    : 'calendar'
  const staffAvatars: StaffAvatarMode = (STAFF_AVATAR_MODES as readonly string[]).includes(avatarsRaw)
    ? (avatarsRaw as StaffAvatarMode)
    : 'initialer'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevBooking = (prev.booking ?? {}) as Record<string, unknown>
  const settings = { ...prev, booking: { ...prevBooking, variant, pickerMode, staffAvatars } }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('updateBookingSettings.settings_upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/sida')
  revalidatePath('/admin/bokning')
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { booking_variant: variant, picker_mode: pickerMode, staff_avatars: staffAvatars },
  })
  return { success: 'Bokningsinställningar sparade. Publika sajten uppdaterad.' }
}

/**
 * goal-62 A2 — Kund-konton av/på från KUNDKORTET.
 *
 * Reglaget fanns bara i kundens egen admin (/admin/installningar). Zivar sitter i
 * superbooking och hittade det aldrig → för honom fanns det "bara i backend".
 * Samma settings-nyckel (`customer_accounts_enabled`), samma läs-seam
 * (tenant-data.ts:143) — bara en andra ingång. MERGE, aldrig clobber.
 *
 * Av = inloggning, "Mitt konto" och /registrera försvinner från kundens publika sajt
 * (gästbokning/gästköp står kvar).
 */
export async function setTenantCustomerAccounts(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const enabled = String(fd.get('customer_accounts_enabled') ?? '') === 'true'

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, customer_accounts_enabled: enabled }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, settings }, { onConflict: 'tenant_id' })
  if (error) {
    await reportActionError('setTenantCustomerAccounts.settings_upsert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/salonger/${tenantId}`)
  revalidatePath('/admin/installningar')
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { customer_accounts_enabled: enabled },
  })
  return {
    success: enabled
      ? 'Kund-konton PÅ — inloggning och Mitt konto visas på kundens sajt.'
      : 'Kund-konton AV — inloggning och Mitt konto dolda. Gästbokning/gästköp står kvar.',
  }
}
