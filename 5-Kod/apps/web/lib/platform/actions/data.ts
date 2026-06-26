'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { isBookingVariant, DEFAULT_BOOKING_VARIANT, type BookingVariant } from '../booking-variant'
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
  if (!tenantId) return { error: 'Saknar salong.' }

  const name = String(fd.get('name') ?? '').trim()
  // Stad (#14): editable here too. Absent field → undefined = leave as-is; present but
  // blank → null (clear). Lets a later edit-UI thread city without forcing it.
  const cityRaw = fd.get('city')
  const city = cityRaw === null ? undefined : String(cityRaw).trim().slice(0, 120) || null
  const reviewUrl = httpsUrlOrNull(fd.get('google_review_url'))
  const variantRaw = String(fd.get('booking_variant') ?? '')

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (reviewUrl === undefined)
    return { error: 'Ogiltig recensionslänk. Använd en https-länk, t.ex. https://g.page/r/.../review.' }
  const bookingVariant: BookingVariant = isBookingVariant(variantRaw)
    ? variantRaw
    : DEFAULT_BOOKING_VARIANT

  const { data: tenant } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Okänd salong.' }

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
    booking: { ...prevBooking, variant: bookingVariant }, // M7-ägd; M3 läser
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
  return { success: 'Salongsdata sparad. Publika sajten uppdaterad.' }
}
