'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx, sidaCtx, siteRevisionCtx } from '../guard'
import { logPlatformAction } from '../audit'
import {
  isBookingVariant,
  type BookingVariant,
  isBookingVerificationMode,
  type BookingVerificationMode,
} from '../booking-variant'
import { revalidateTenant } from '@/lib/admin/tenant'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import {
  BOOKING_PROVIDERS,
  normalizeBookingExternalUrl,
  parseBookingExternalCtaUrls,
  type BookingProviderKind,
} from '../booking-external-url'
import { parseTenantLegalInput } from '@/lib/tenant-region'
import { isCustomerPortalMode } from '@/lib/customer-portal/mode'
import { createServiceClient } from '@/lib/platform/service'

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
  revalidatePath(`/kunder/${tenantId}`)
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

  const legal = parseTenantLegalInput(fd.get('org_nr'), fd.get('vat_rate'))
  if (!legal) return { error: 'Momssatsen ska vara ett tal mellan 0 och 100 (t.ex. 25).' }
  const { orgNr, vatRate } = legal

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
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { legal_org_nr: orgNr ? 'set' : 'cleared', legal_vat_rate: vatRate },
  })
  return { success: 'Juridikuppgifter sparade. Villkor och kvitton uppdaterade.' }
}

/** Save only the booking provider and external destinations. Presentation is
 * owned by the site revision so an older draft cannot overwrite these values. */
export async function updateBookingSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, tenantId } = await siteRevisionCtx({
    tenantId: String(fd.get('tenantId') ?? ''),
  })
  if (!tenantId) return { error: 'Saknar kund.' }

  const verificationModeRaw = String(fd.get('booking_verification_mode') ?? '')
  const providerRaw = String(fd.get('booking_provider') ?? '')
  const externalUrlRaw = String(fd.get('booking_external_url') ?? '').trim()
  const externalUrl = normalizeBookingExternalUrl(externalUrlRaw)
  const externalCtaUrls = parseBookingExternalCtaUrls(fd)
  if (!(BOOKING_PROVIDERS as readonly string[]).includes(providerRaw)) {
    return { error: 'Välj Corevo-bokning eller extern bokning.' }
  }
  if (externalUrlRaw && !externalUrl) {
    return { error: 'Extern bokningslänk måste vara en fullständig https-länk.' }
  }
  if (!externalCtaUrls) {
    return { error: 'En knapp har en ogiltig extern bokningslänk.' }
  }
  const provider = providerRaw as BookingProviderKind
  if (provider === 'corevo' && !isBookingVerificationMode(verificationModeRaw)) {
    return { error: 'Välj kanal för bokningskoder.' }
  }
  if (verificationModeRaw && !isBookingVerificationMode(verificationModeRaw)) {
    return { error: 'Ogiltigt kanalval för bokningskoder.' }
  }
  if (provider === 'external' && !externalUrl) {
    return { error: 'Extern bokning kräver en standardlänk med https.' }
  }
  const verificationMode = verificationModeRaw
    ? verificationModeRaw as BookingVerificationMode
    : null

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const { error } = await supabase.rpc('update_booking_operational_settings', {
    p_tenant: tenantId,
    p_provider: provider,
    p_external_url: externalUrl,
    p_external_cta_urls: externalCtaUrls,
    p_verification_mode: verificationMode,
  })
  if (error) {
    await reportActionError('updateBookingSettings.rpc', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/sida')
  revalidatePath('/admin/bokning')
  return { success: 'Bokningsinställningar sparade. Publika sajten uppdaterad.' }
}

/** Platform owner for the tenant's one canonical customer-portal mode. */
export async function setTenantCustomerPortalMode(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase, tenantId } = await sidaCtx(fd)
  if (!tenantId) return { error: 'Saknar kund.' }

  const mode = fd.get('customer_portal_mode')
  if (!isCustomerPortalMode(mode) || mode === 'global_account') {
    return { error: 'Ogiltigt kundportalläge.' }
  }

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd kund.' }

  const service = createServiceClient()
  if (!service) return { error: GENERIC }
  const { error } = await service.rpc('set_customer_portal_mode', {
    p_tenant: tenantId,
    p_mode: mode,
  })
  if (error) {
    await reportActionError('setTenantCustomerPortalMode.rpc', error, { tenantId })
    return { error: GENERIC }
  }

  revalidateTenant(tenant.slug)
  revalidatePath(`/kunder/${tenantId}`)
  revalidatePath('/admin/installningar')
  await logPlatformAction(supabase, {
    action: 'tenant.update',
    tenantId,
    actorId: user.id,
    meta: { customer_portal_mode: mode },
  })
  return {
    success: mode === 'passwordless_tenant'
      ? 'Lösenordsfri kundportal är vald.'
      : mode === 'legacy_account'
        ? 'Kundkonton med inloggning är valda.'
        : 'Kundportal är avstängd. Gästbokning och gästköp står kvar.',
  }
}
