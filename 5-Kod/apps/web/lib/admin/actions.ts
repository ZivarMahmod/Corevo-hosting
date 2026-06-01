'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from './tenant'
import { kronorToCents } from './format'
import { uploadImage, uploadErrorMessage } from '@/lib/r2/upload'
import { BOOKING_STATUSES } from './format'

export type ActionState = { error?: string; success?: string }

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Authorization fence for EVERY admin mutation. RLS only isolates tenants, it is
 * NOT role-aware (a level-2 kund shares the tenant claim), so the role gate lives
 * here in the server action. Also resolves the tenant (id + slug) needed to scope
 * writes and invalidate the public cache.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

// ── Services ────────────────────────────────────────────────────────────────
export async function createService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  const category = String(fd.get('category') ?? '').trim()
  const duration = Number(fd.get('duration_min'))
  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0

  if (!name) return { error: 'Ange ett namn.' }
  if (!Number.isInteger(duration) || duration <= 0) return { error: 'Ange en giltig varaktighet (minuter).' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').insert({
    tenant_id: ctx.tenant.id,
    location_id: ctx.tenant.locationId,
    name,
    category: category || null,
    duration_min: duration,
    price_cents: priceCents,
    active: true,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst skapad.' }
}

export async function updateService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const name = String(fd.get('name') ?? '').trim()
  const category = String(fd.get('category') ?? '').trim()
  const duration = Number(fd.get('duration_min'))
  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0

  if (!id) return { error: 'Saknar tjänst.' }
  if (!name) return { error: 'Ange ett namn.' }
  if (!Number.isInteger(duration) || duration <= 0) return { error: 'Ange en giltig varaktighet (minuter).' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ name, category: category || null, duration_min: duration, price_cents: priceCents })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst uppdaterad.' }
}

export async function toggleServiceActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: active ? 'Tjänst aktiverad.' : 'Tjänst inaktiverad.' }
}

export async function deleteService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) {
    // FK from bookings(service_id) → can't delete a service with history.
    if (error.code === '23503')
      return { error: 'Tjänsten har bokningar och kan inte tas bort. Inaktivera den i stället.' }
    return { error: GENERIC }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst borttagen.' }
}

// ── Staff ─────────────────────────────────────────────────────────────────────
function revalidateStaff(slug: string) {
  revalidateTenant(slug) // staff/staff_services are read live by M3, but services list is cached
  revalidatePath('/admin/personal')
  revalidatePath('/admin/scheman')
}

export async function createStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange ett namn/en titel.' }

  const supabase = await createClient()
  const { error } = await supabase.from('staff').insert({
    tenant_id: ctx.tenant.id,
    location_id: ctx.tenant.locationId,
    title,
    active: true,
  })
  if (error) return { error: GENERIC }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Medarbetare tillagd.' }
}

export async function updateStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const title = String(fd.get('title') ?? '').trim()
  if (!id) return { error: 'Saknar medarbetare.' }
  if (!title) return { error: 'Ange ett namn/en titel.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ title })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Sparad.' }
}

export async function toggleStaffActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar medarbetare.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateStaff(ctx.tenant.slug)
  return { success: active ? 'Medarbetare aktiverad.' : 'Medarbetare inaktiverad.' }
}

export async function deleteStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar medarbetare.' }

  const supabase = await createClient()
  const { error } = await supabase.from('staff').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) {
    if (error.code === '23503')
      return { error: 'Medarbetaren har bokningar och kan inte tas bort. Inaktivera i stället.' }
    return { error: GENERIC }
  }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Medarbetare borttagen.' }
}

/** Replace the set of services a staff member performs (staff_services join). */
export async function setStaffServices(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  if (!staffId) return { error: 'Saknar medarbetare.' }
  const requested = fd.getAll('service_id').map(String).filter(Boolean)

  const supabase = await createClient()

  // Keep only service ids that actually belong to this tenant (defence-in-depth:
  // staff_services.service_id has no same-tenant FK constraint).
  const { data: own } = await supabase
    .from('services')
    .select('id')
    .eq('tenant_id', ctx.tenant.id)
    .in('id', requested.length ? requested : ['00000000-0000-0000-0000-000000000000'])
  const valid = new Set((own ?? []).map((r) => r.id))
  const toInsert = requested.filter((id) => valid.has(id))

  // Replace: clear this staff's links, then insert the new set.
  const del = await supabase
    .from('staff_services')
    .delete()
    .eq('tenant_id', ctx.tenant.id)
    .eq('staff_id', staffId)
  if (del.error) return { error: GENERIC }

  if (toInsert.length) {
    const rows = toInsert.map((service_id) => ({
      tenant_id: ctx.tenant.id,
      staff_id: staffId,
      service_id,
    }))
    const ins = await supabase.from('staff_services').insert(rows)
    if (ins.error) return { error: GENERIC }
  }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Tjänster kopplade.' }
}

// ── Working hours (schedules, per staff) ──────────────────────────────────────
const TIME_RE = /^\d{2}:\d{2}$/

export async function addStaffWorkingHours(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const weekday = Number(fd.get('weekday'))
  const start = String(fd.get('start_time') ?? '')
  const end = String(fd.get('end_time') ?? '')

  if (!staffId) return { error: 'Välj en medarbetare.' }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: 'Välj en veckodag.' }
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: 'Ange giltiga tider (HH:MM).' }
  if (end <= start) return { error: 'Sluttiden måste vara efter starttiden.' }

  const supabase = await createClient()
  // Confirm the staff row is ours (and grab its location) before writing.
  const { data: member } = await supabase
    .from('staff')
    .select('id, location_id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

  const { error } = await supabase.from('working_hours').insert({
    tenant_id: ctx.tenant.id,
    staff_id: member.id,
    location_id: member.location_id ?? ctx.tenant.locationId,
    weekday,
    start_time: start,
    end_time: end,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/scheman')
  return { success: 'Arbetstid tillagd.' }
}

export async function deleteStaffWorkingHours(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('working_hours')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/scheman')
  return { success: 'Arbetstid borttagen.' }
}

// ── Branding (white-label) ────────────────────────────────────────────────────
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function hexOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return HEX_RE.test(v) ? v : undefined // undefined = invalid (caller rejects)
}

type Branding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  font_body?: string | null
  logo_url?: string | null
}

export async function saveBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const colorPrimary = hexOrNull(fd.get('color_primary'))
  const colorBg = hexOrNull(fd.get('color_bg'))
  const colorFg = hexOrNull(fd.get('color_fg'))
  if (colorPrimary === undefined || colorBg === undefined || colorFg === undefined)
    return { error: 'Ogiltig färgkod. Använd hex, t.ex. #1f6feb.' }
  const fontBody = String(fd.get('font_body') ?? '').trim().slice(0, 120)
  const removeLogo = String(fd.get('remove_logo') ?? '') === 'true'
  const logo = fd.get('logo')

  const supabase = await createClient()
  // Merge onto existing branding so a colors-only save keeps the logo and vice versa.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as Branding

  let logoUrl = prev.logo_url ?? null
  let warning: string | null = null
  if (removeLogo) logoUrl = null
  if (logo instanceof File && logo.size > 0) {
    const res = await uploadImage(logo, `tenants/${ctx.tenant.id}/branding`)
    if (res.ok) logoUrl = res.url
    else warning = uploadErrorMessage(res.reason)
  }

  const branding: Branding = {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    font_body: fontBody || null,
    logo_url: logoUrl,
  }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/varumarke')
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika webbplatsen uppdaterad.' }
}

// ── Salon settings ────────────────────────────────────────────────────────────
const PAYMENT_MODES = ['on_site', 'online', 'both', 'coming_soon'] as const

function isValidTz(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  const paymentMode = String(fd.get('payment_mode') ?? 'on_site')
  const cancelRaw = String(fd.get('cancellation_cutoff_hours') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  const locationName = String(fd.get('location_name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const contactEmail = String(fd.get('contact_email') ?? '').trim()
  const contactPhone = String(fd.get('contact_phone') ?? '').trim()
  const customerAccounts = String(fd.get('customer_accounts_enabled') ?? '') === 'true'

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (!PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number]))
    return { error: 'Ogiltigt betalningsläge.' }
  const cancelHours = cancelRaw === '' ? 24 : Number(cancelRaw)
  if (!Number.isFinite(cancelHours) || cancelHours < 0 || cancelHours > 8760)
    return { error: 'Avbokningsregel måste vara ett antal timmar (0–8760).' }
  if (timezone && !isValidTz(timezone)) return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }

  const supabase = await createClient()

  // 1) tenant name (feeds the cached public bundle).
  const t = await supabase.from('tenants').update({ name }).eq('id', ctx.tenant.id)
  if (t.error) return { error: GENERIC }

  // 2) tenant_settings: merge into the existing settings jsonb so we never clobber
  //    layout / custom_override that the public theming layer relies on.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = {
    ...prev,
    cancellation_cutoff_hours: cancelHours, // read by M4 (kund avbokning)
    contact: { email: contactEmail || null, phone: contactPhone || null },
    customer_accounts_enabled: customerAccounts, // G12: storefront login/konto toggle
  }
  const s = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, payment_mode: paymentMode, settings }, { onConflict: 'tenant_id' })
  if (s.error) return { error: GENERIC }

  // 3) primary location (timezone + name + address), if the tenant has one.
  if (ctx.tenant.locationId) {
    const locUpdate: { timezone?: string; name?: string; address?: string | null } = {}
    if (timezone) locUpdate.timezone = timezone
    if (locationName) locUpdate.name = locationName
    locUpdate.address = address || null
    const l = await supabase
      .from('locations')
      .update(locUpdate)
      .eq('id', ctx.tenant.locationId)
      .eq('tenant_id', ctx.tenant.id)
    if (l.error) return { error: GENERIC }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/installningar')
  return { success: 'Inställningar sparade.' }
}

// ── Bookings overview ─────────────────────────────────────────────────────────
export async function setBookingStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const bookingId = String(fd.get('bookingId') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }
  if (!BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number]))
    return { error: 'Ogiltig status.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenant.id)
  if (error) {
    // Reactivating a booking can collide with the no_double_booking EXCLUDE.
    if (error.code === '23P01')
      return { error: 'Tiden krockar med en annan aktiv bokning för medarbetaren.' }
    return { error: GENERIC }
  }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: 'Status uppdaterad.' }
}
