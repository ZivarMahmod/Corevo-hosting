'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from './tenant'
import { kronorToCents } from './format'
import { uploadImage, uploadErrorMessage, pruneRemovedImages, type UploadResult } from '@/lib/r2/upload'
import { mergeBranding } from '@/lib/branding/merge'
import { resolveRoleMatrix } from '@/lib/platform/roles-permissions'
import { canWrite } from '@/lib/platform/catalog-shared'
import { sendReviewNudgeForBooking } from '@/lib/notifications/google-review'
import { refundBookingPayment } from '@/lib/stripe/refund'
import { BOOKING_STATUSES, ALLOWED_FROM, type BookingStatus } from './format'
import type { CopyOverride } from '@/components/storefront/theme-content'
import { createAdminServiceClient } from './service'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

// ── Locations (platser) ───────────────────────────────────────────────────────
// VÅG 4b: per-salon multi-location management. The PRIMARY location is load-bearing
// — create_public_booking pins bookings.location_id (NOT NULL) to it, and
// getAdminTenant/storefront resolve tz + address from it. New locations default
// is_primary=false + active=true; promotion is atomic via the set_primary_location
// RPC (demote-then-promote, role-fenced). No hard-delete: 6 RESTRICT FKs block it,
// so deactivation (active=false) is the only removal path.
const DEFAULT_TZ = 'Europe/Stockholm'

function revalidateLocations(slug: string) {
  revalidateTenant(slug) // primary tz/address feeds the cached public bundle
  revalidatePath('/admin/platser')
  revalidatePath('/admin/scheman') // schedule location <select> options depend on the active set
}

export async function createLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  if (!name) return { error: 'Ange ett namn.' }
  if (timezone && !isValidTz(timezone)) return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }

  const supabase = await createClient()
  const { error } = await supabase.from('locations').insert({
    tenant_id: ctx.tenant.id,
    name,
    address: address || null,
    timezone: timezone || DEFAULT_TZ,
    is_primary: false, // a new location never steals primary — use "Gör till primär"
    active: true,
  })
  if (error) return { error: GENERIC }

  revalidateLocations(ctx.tenant.slug)
  return { success: 'Plats skapad.' }
}

export async function updateLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const name = String(fd.get('name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  if (!id) return { error: 'Saknar plats.' }
  if (!name) return { error: 'Ange ett namn.' }
  if (timezone && !isValidTz(timezone)) return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }

  const supabase = await createClient()
  const patch: { name: string; address: string | null; timezone?: string } = {
    name,
    address: address || null,
  }
  if (timezone) patch.timezone = timezone
  const { error } = await supabase
    .from('locations')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateLocations(ctx.tenant.slug)
  return { success: 'Plats uppdaterad.' }
}

/**
 * Promote a location to PRIMARY via the set_primary_location RPC (SECURITY DEFINER,
 * role-fenced, atomic demote-then-promote — exactly one is_primary per tenant). We
 * defence-in-depth confirm the row is ours first (p_location is client-supplied),
 * then surface the RPC's own errors. Refuse to promote an INACTIVE location: the
 * primary is load-bearing, and an inactive primary can't be deactivated-away later.
 */
export async function setPrimaryLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar plats.' }

  const supabase = await createClient()
  const { data: loc } = await supabase
    .from('locations')
    .select('id, active, is_primary')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!loc) return { error: 'Okänd plats.' }
  if (loc.is_primary) return { success: 'Platsen är redan primär.' }
  if (!loc.active) return { error: 'Aktivera platsen innan du gör den till primär.' }

  const { error } = await supabase.rpc('set_primary_location', { p_location: id })
  if (error) {
    // Role/tenant fence inside the RPC raises if denied; surface a clear message.
    return { error: 'Kunde inte byta primär plats. Försök igen.' }
  }

  revalidateLocations(ctx.tenant.slug)
  return { success: 'Primär plats uppdaterad.' }
}

/**
 * Soft-deactivate / reactivate a location. REFUSES to deactivate the PRIMARY: it is
 * load-bearing for create_public_booking + bookings.location_id (NOT NULL). Make
 * another location primary first, then deactivate this one. Activating, or toggling
 * a non-primary, always passes.
 */
export async function toggleLocationActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar plats.' }

  const supabase = await createClient()
  const { data: loc } = await supabase
    .from('locations')
    .select('id, is_primary')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!loc) return { error: 'Okänd plats.' }
  // Refuse ONLY: deactivating the primary. Activating a primary or toggling a
  // non-primary is fine.
  if (!active && loc.is_primary)
    return {
      error:
        'Den primära platsen kan inte inaktiveras — bokningar kräver den. Gör en annan plats till primär först.',
    }

  const { error } = await supabase
    .from('locations')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateLocations(ctx.tenant.slug)
  return { success: active ? 'Plats aktiverad.' : 'Plats inaktiverad.' }
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

  // Confirm the staff row is ours before writing — staff_id is client-supplied,
  // and RLS does not isolate roles within a tenant. Same fence as addStaffWorkingHours.
  const { data: member } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

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

/**
 * Invite a staff member by email (M6 §3.4 onboarding). Sends a Supabase magic-link
 * invite (one-time), provisions the public.users row with a tenant-scoped `staff`
 * role (level 3), bakes tenant_id into app_metadata (JWT belt-and-suspenders, same
 * as the platform create-tenant invite), and creates/links the staff row's
 * profile_id so the new account maps to its staff record.
 *
 * ⚠️ Requires SUPABASE_SERVICE_ROLE_KEY (server secret) for the auth-user creation.
 * When the secret is unset (local/dev, mirrors the R2 + platform pattern) the invite
 * degrades gracefully with a clear message — never throws. HANDOFF: verify the
 * secret is wired in the Worker before relying on this in production.
 */
export async function inviteStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const title = String(fd.get('title') ?? '').trim()
  // Optional: invite into an EXISTING staff row (link it) instead of a new one.
  const staffId = String(fd.get('staff_id') ?? '').trim()
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ange en giltig e-postadress.' }

  const svc = createAdminServiceClient()
  if (!svc) {
    return {
      error:
        'Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av drift). Medarbetaren kan läggas till utan konto under tiden.',
    }
  }

  const supabase = await createClient()

  // 1) Tenant-scoped `staff` role (level 3). Idempotent upsert on (tenant_id, name)
  //    avoids a TOCTOU race / unique-violation, then re-select the id. RLS roles_write
  //    admits tenant_id = private.tenant_id() (0002:50), so a salon_admin may do this.
  //    Done BEFORE the auth-user invite so an RLS/DB failure can't orphan an auth user.
  await supabase
    .from('roles')
    .upsert({ tenant_id: ctx.tenant.id, name: 'staff', level: 3 }, { onConflict: 'tenant_id,name', ignoreDuplicates: true })
  const { data: role, error: rErr } = await supabase
    .from('roles')
    .select('id')
    .eq('tenant_id', ctx.tenant.id)
    .eq('name', 'staff')
    .maybeSingle()
  if (rErr || !role) return { error: GENERIC }
  const roleId = role.id

  // 2) Invite the auth user (one-time magic link). Only this step needs svc.
  const { data: invited, error: iErr } = await svc.auth.admin.inviteUserByEmail(email)
  if (iErr || !invited?.user) {
    return { error: `Inbjudan misslyckades: ${iErr?.message ?? 'kontot finns kanske redan'}.` }
  }
  const authId = invited.user.id

  // 3) Bake tenant_id into app_metadata so the JWT carries it before the access
  //    token hook is enabled (same belt-and-suspenders as the platform invite).
  await svc.auth.admin.updateUserById(authId, {
    app_metadata: { tenant_id: ctx.tenant.id, platform_admin: false },
  })

  // 4) public.users row (authed client; RLS allows the admin within their tenant).
  const { error: uErr } = await supabase
    .from('users')
    .insert({ id: authId, tenant_id: ctx.tenant.id, email, role_id: roleId, status: 'active' })
  if (uErr) {
    return { error: 'Medarbetaren kunde inte kopplas (kontot finns kanske redan).' }
  }

  // 5) Create or link the staff row → profile_id points at the new account.
  if (staffId) {
    const { error: linkErr } = await supabase
      .from('staff')
      .update({ profile_id: authId })
      .eq('id', staffId)
      .eq('tenant_id', ctx.tenant.id)
    if (linkErr) return { error: GENERIC }
  } else {
    const { error: insErr } = await supabase.from('staff').insert({
      tenant_id: ctx.tenant.id,
      location_id: ctx.tenant.locationId,
      profile_id: authId,
      title: title || email,
      active: true,
    })
    if (insErr) return { error: GENERIC }
  }

  revalidateStaff(ctx.tenant.slug)
  return { success: `Inbjudan skickad till ${email}. Medarbetaren skapar lösenord via länken.` }
}

// ── Working hours (schedules, per staff) ──────────────────────────────────────
const TIME_RE = /^\d{2}:\d{2}$/

/**
 * Resolve the location_id a schedule row should be pinned to. `requested` is the
 * client-supplied <select> value (UNTRUSTED): RLS fences working_hours.tenant_id
 * but NOT its location_id FK (the FK to locations(id) accepts any tenant's id), so
 * a crafted POST could otherwise pin our row to another tenant's location — same
 * gap setStaffServices guards. We confirm the requested id is in OUR location set
 * before trusting it; otherwise fall back to the staff member's location, then the
 * tenant primary. Returns null only when the tenant has no location at all.
 */
async function resolveScheduleLocation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  requested: string,
  staffLocationId: string | null,
  primaryLocationId: string | null,
): Promise<string | null> {
  if (requested) {
    const { data: own } = await supabase
      .from('locations')
      .select('id')
      .eq('id', requested)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .maybeSingle()
    if (own) return own.id
  }
  return staffLocationId ?? primaryLocationId
}

export async function addStaffWorkingHours(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const weekday = Number(fd.get('weekday'))
  const start = String(fd.get('start_time') ?? '')
  const end = String(fd.get('end_time') ?? '')
  const requestedLocation = String(fd.get('location_id') ?? '')

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

  // The chosen location keys availability (booking engine reads working_hours.location_id).
  const locationId = await resolveScheduleLocation(
    supabase,
    ctx.tenant.id,
    requestedLocation,
    member.location_id,
    ctx.tenant.locationId,
  )

  const { error } = await supabase.from('working_hours').insert({
    tenant_id: ctx.tenant.id,
    staff_id: member.id,
    location_id: locationId,
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

// ── Explicit bookable slots (working_hour_slots, per staff/weekday) — M6 §5 ─────
// Coexists with working_hours: when a (staff, weekday) has explicit slots the
// engine offers EXACTLY those starts; with none it falls back to the working_hours
// raster. Uneven start times are allowed by design — the owner picks them.
//
// ⚠️ Activation dependency (OUT OF M6 REVIR): the public booking engine still reads
// `working_hours` + a fixed step (app/boka/actions.ts) and does NOT yet read
// working_hour_slots. The DB (anon-read policy 0011:598, seed fn) is built for M3
// to consume in a later wave. Until M3 reads these, explicit slots are stored +
// editable here but do not yet change the public bookable times. Copy reflects that.

export async function addStaffSlots(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const weekday = Number(fd.get('weekday'))
  const requestedLocation = String(fd.get('location_id') ?? '')
  // One or more times: a single "start_time" and/or a comma/space/newline list in
  // "start_times" (paste a whole day's cadence at once, e.g. "09:00, 09:30, 11:45").
  const raw = [String(fd.get('start_time') ?? ''), String(fd.get('start_times') ?? '')]
    .join(' ')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  if (!staffId) return { error: 'Välj en medarbetare.' }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: 'Välj en veckodag.' }
  if (raw.length === 0) return { error: 'Ange minst en starttid (HH:MM).' }
  const times = [...new Set(raw)]
  if (!times.every((t) => TIME_RE.test(t)))
    return { error: 'Ange giltiga tider (HH:MM), t.ex. 09:00, 09:30, 11:45.' }

  const supabase = await createClient()
  // Confirm the staff row is ours (and grab its location) before writing.
  const { data: member } = await supabase
    .from('staff')
    .select('id, location_id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

  // The chosen location keys availability (booking engine reads slots' location_id).
  const locationId = await resolveScheduleLocation(
    supabase,
    ctx.tenant.id,
    requestedLocation,
    member.location_id,
    ctx.tenant.locationId,
  )

  const rows = times.map((t) => ({
    tenant_id: ctx.tenant.id,
    staff_id: member.id,
    location_id: locationId,
    weekday,
    start_time: t,
  }))
  // Idempotent: the (tenant, staff, weekday, start_time) unique index means a
  // re-added time is a no-op rather than a duplicate. ignoreDuplicates so adding a
  // partly-overlapping list doesn't error.
  const { error } = await supabase
    .from('working_hour_slots')
    .upsert(rows, { onConflict: 'tenant_id,staff_id,weekday,start_time', ignoreDuplicates: true })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/scheman')
  return { success: times.length === 1 ? 'Tid sparad.' : `${times.length} tider sparade.` }
}

export async function deleteStaffSlot(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('working_hour_slots')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/scheman')
  return { success: 'Tid borttagen.' }
}

/**
 * Boot-import: generate explicit slots for a staff member from their existing
 * working_hours raster, via the seed_explicit_slots_from_hours RPC (SEC DEFINER,
 * tenant-fenced inside). Idempotent (RPC uses ON CONFLICT DO NOTHING). The owner
 * then tweaks the generated list. p_step = the raster used during generation only.
 */
export async function seedStaffSlots(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const stepRaw = String(fd.get('step') ?? '15').trim()
  const step = Number(stepRaw)
  if (!staffId) return { error: 'Välj en medarbetare.' }
  if (!Number.isInteger(step) || step < 1 || step > 240)
    return { error: 'Ogiltigt steg (minuter, 1–240).' }

  // Defence-in-depth: confirm the staff row is ours before invoking the RPC.
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }

  const { data, error } = await supabase.rpc('seed_explicit_slots_from_hours', {
    p_staff: staffId,
    p_step: step,
  })
  if (error) {
    if (error.code === 'P0002') return { error: 'Okänd medarbetare.' }
    if (error.code === '22023') return { error: 'Ogiltigt steg.' }
    return { error: GENERIC }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/scheman')
  const n = typeof data === 'number' ? data : 0
  return {
    success:
      n > 0
        ? `${n} tider genererade och sparade. Justera fritt nedan.`
        : 'Inga nya tider att generera — lägg till arbetstider först, eller så finns tiderna redan.',
  }
}

// ── Branding (white-label) ────────────────────────────────────────────────────
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function hexOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  return HEX_RE.test(v) ? v : undefined // undefined = invalid (caller rejects)
}

type TeamMember = { name: string; role: string; img: string }
type StatTuple = [value: string, label: string]

type Branding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  color_accent?: string | null
  font_body?: string | null
  logo_url?: string | null
  // Owner-uploaded storefront media (saveStorefrontMedia). Kept here so a
  // colors-only save (saveBranding) preserves them via the `...prev` spread.
  hero_images?: string[] | null
  gallery_images?: string[] | null
  about_image?: string | null
  closing_image?: string | null
  team?: TeamMember[] | null
  stats?: StatTuple[] | null
}

export async function saveBranding(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  // goal-21 RBAC enforcement (ADDITIVE-RESTRICTIVE, on top of adminCtx's level gate):
  // resolve the caller's role against the stored/merged permission matrix and deny if
  // their Branding access is read-only/none. canWrite() can ONLY narrow — it returns
  // true for an unknown/null role or missing cell (deferring to the outer guard), so it
  // never grants. With defaults salon_admin/super_admin keep Branding write → zero
  // behavior change today; it bites only if an admin sets a role's Branding to none.
  const supabaseForPerms = await createClient()
  const roleMatrix = await resolveRoleMatrix(supabaseForPerms)
  if (!canWrite(roleMatrix, ctx.user.roleName, 'Branding'))
    return { error: 'Din roll har inte behörighet att ändra varumärke. Kontakta plattformsadmin.' }

  const colorPrimary = hexOrNull(fd.get('color_primary'))
  const colorBg = hexOrNull(fd.get('color_bg'))
  const colorFg = hexOrNull(fd.get('color_fg'))
  const colorAccent = hexOrNull(fd.get('color_accent'))
  if (
    colorPrimary === undefined ||
    colorBg === undefined ||
    colorFg === undefined ||
    colorAccent === undefined
  )
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

  // Preserve any owner-uploaded storefront media (hero/gallery/about/closing/
  // team/stats) written by saveStorefrontMedia — mergeBranding spreads prev and
  // applies only this action's slice, so a colours-only save never clobbers them.
  const branding: Branding = mergeBranding(prev, {
    color_primary: colorPrimary,
    color_bg: colorBg,
    color_fg: colorFg,
    color_accent: colorAccent,
    font_body: fontBody || null,
    logo_url: logoUrl,
  })

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  // FX-14: drop the previous logo object when it was replaced or removed.
  await pruneRemovedImages([prev.logo_url], [branding.logo_url])

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/varumarke')
  return warning ? { error: warning } : { success: 'Varumärke sparat. Publika webbplatsen uppdaterad.' }
}

// ── Storefront media (hero/gallery/about/closing + team + stats) ───────────────
// Owner-uploaded media that OVERRIDES the per-theme defaults on the storefront
// (read side: resolveThemeContent + parseSettings already consume these keys).
// Empty → the storefront keeps showing the strong per-theme default photo.
const HERO_MAX = 5
const GALLERY_MAX = 8
const TEAM_MAX = 12
const STATS_MAX = 6

/** Neutral upload-failure copy for storefront photos (uploadErrorMessage is logo-worded). */
function mediaUploadMessage(reason: Exclude<UploadResult, { ok: true }>['reason']): string {
  switch (reason) {
    case 'bad_type':
      return 'Bilderna måste vara PNG, JPG, WEBP, SVG eller GIF.'
    case 'too_large':
      return 'Någon bild är för stor (max 2 MB per bild).'
    case 'no_public_base':
    case 'no_binding':
      return 'Bilduppladdning är inte aktiverad i denna miljö (kräver R2 + R2_PUBLIC_BASE_URL). Övriga ändringar sparades.'
    default:
      return 'En eller flera bilder kunde inte laddas upp. Försök igen.'
  }
}

/**
 * Save owner-uploaded storefront media into tenant_settings.branding (jsonb),
 * MERGED onto the existing branding so colours/font/logo are never clobbered.
 *
 * FormData contract:
 *   hero_existing  (multiple) — already-saved hero URLs to KEEP (drop to remove)
 *   hero_files     (multiple) — newly chosen hero image files
 *   gallery_existing (multiple) — already-saved gallery URLs to KEEP
 *   gallery_files    (multiple) — newly chosen gallery image files
 *   about_existing / about_file     — single retained URL / single new file
 *   about_remove = 'true'           — drop the about image
 *   closing_existing / closing_file — single retained URL / single new file
 *   closing_remove = 'true'         — drop the closing image
 *   team_name_<i> / team_role_<i> / team_img_<i> (retained URL) / team_photo_<i> (file)
 *   stat_value_<i> / stat_label_<i>  (note: STORED as [value, label])
 */
export async function saveStorefrontMedia(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const keyPrefix = `tenants/${ctx.tenant.id}/storefront`
  let uploadWarning: string | null = null

  // Upload a single file; on failure record a (first) warning and return null so
  // the caller can degrade gracefully — exactly like saveBranding's logo path.
  async function tryUpload(file: File): Promise<string | null> {
    const res = await uploadImage(file, keyPrefix)
    if (res.ok) return res.url
    if (!uploadWarning) uploadWarning = mediaUploadMessage(res.reason)
    return null
  }

  // ── Hero & gallery: retained URLs (hidden) + newly uploaded files, capped. ──
  // Cap retained first, then upload only as many new files as still fit under the
  // cap (FX-14): uploading files we'd slice off afterwards would orphan them in R2 —
  // their URLs would be in neither prev nor the saved set, so prune never sees them.
  const heroRetained = fd.getAll('hero_existing').map(String).filter(Boolean).slice(0, HERO_MAX)
  const heroFiles = fd
    .getAll('hero_files')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, HERO_MAX - heroRetained.length)
  const heroUploaded: string[] = []
  for (const f of heroFiles) {
    const url = await tryUpload(f)
    if (url) heroUploaded.push(url)
  }
  const heroImages = [...heroRetained, ...heroUploaded]

  const galleryRetained = fd.getAll('gallery_existing').map(String).filter(Boolean).slice(0, GALLERY_MAX)
  const galleryFiles = fd
    .getAll('gallery_files')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, GALLERY_MAX - galleryRetained.length)
  const galleryUploaded: string[] = []
  for (const f of galleryFiles) {
    const url = await tryUpload(f)
    if (url) galleryUploaded.push(url)
  }
  const galleryImages = [...galleryRetained, ...galleryUploaded]

  // ── About / closing: single image each (retained URL unless removed/replaced). ──
  async function singleImage(prefix: string): Promise<string | null> {
    if (String(fd.get(`${prefix}_remove`) ?? '') === 'true') return null
    const file = fd.get(`${prefix}_file`)
    if (file instanceof File && file.size > 0) {
      const url = await tryUpload(file)
      if (url) return url
      // Upload failed — fall back to the retained URL so we don't silently drop it.
    }
    const existing = String(fd.get(`${prefix}_existing`) ?? '').trim()
    return existing || null
  }
  const aboutImage = await singleImage('about')
  const closingImage = await singleImage('closing')

  // ── Team: indexed rows (name + role + retained-img + optional photo file). ──
  // Indexed (not parallel getAll) so an optional missing photo can't misalign rows.
  const team: TeamMember[] = []
  for (let i = 0; i < TEAM_MAX; i++) {
    const name = String(fd.get(`team_name_${i}`) ?? '').trim()
    const role = String(fd.get(`team_role_${i}`) ?? '').trim()
    let img = String(fd.get(`team_img_${i}`) ?? '').trim()
    const photo = fd.get(`team_photo_${i}`)
    if (photo instanceof File && photo.size > 0) {
      const url = await tryUpload(photo)
      if (url) img = url
    }
    // Skip incomplete rows: storefront has no per-member fallback, so a member
    // without an image renders a broken <img>. Require a name and an image.
    if (name && img) team.push({ name, role, img })
  }

  // ── Stats: indexed value/label pairs. STORED as [value, label] (ThemeStat). ──
  // Require BOTH fields: layouts render the label as the React key, so empty
  // labels would collide (key=""); a half-filled stat is also not meaningful.
  const stats: StatTuple[] = []
  for (let i = 0; i < STATS_MAX; i++) {
    const value = String(fd.get(`stat_value_${i}`) ?? '').trim()
    const label = String(fd.get(`stat_label_${i}`) ?? '').trim()
    if (value && label) stats.push([value, label])
  }

  const supabase = await createClient()
  // Merge onto existing branding so colours/font/logo are never clobbered.
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('branding')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.branding ?? {}) as Branding

  // Owner media slice only — mergeBranding keeps colours/font/logo/accent intact.
  const branding: Branding = mergeBranding(prev, {
    hero_images: heroImages,
    gallery_images: galleryImages,
    about_image: aboutImage,
    closing_image: closingImage,
    team,
    stats,
  })

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, branding }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  // VÅG 5 durability: the DB save has COMMITTED. Everything below is best-effort
  // cleanup (R2 prune + cache revalidation) and must NEVER turn a successful save
  // into an error-boundary crash — that's the "data saved but UI says it failed =
  // appears to vanish" class WORKFLOW-03 hunts (Zivar repro: removing an image then
  // saving). pruneRemovedImages is already best-effort internally; this wraps the
  // whole tail (incl. revalidate*) so any throw here can't unwind a committed save.
  try {
    // FX-14: delete storefront objects this save dropped or replaced (hero, gallery,
    // about, closing, team photos). The logo is owned by saveBranding, so prev.logo_url
    // is deliberately NOT in this set — a media save must never delete the live logo.
    await pruneRemovedImages(
      [
        ...(prev.hero_images ?? []),
        ...(prev.gallery_images ?? []),
        prev.about_image,
        prev.closing_image,
        ...(prev.team ?? []).map((m) => m.img),
      ],
      [...heroImages, ...galleryImages, aboutImage, closingImage, ...team.map((m) => m.img)],
    )
    revalidateTenant(ctx.tenant.slug)
    revalidatePath('/admin/varumarke')
  } catch {
    // best-effort cleanup — a prune/revalidate miss never fails an already-saved write.
  }
  return uploadWarning
    ? { error: uploadWarning }
    : { success: 'Bilder & innehåll sparat. Publika webbplatsen uppdaterad.' }
}

// ── Storefront copy (owner editorial overrides) — M6 §3.6 / M2↔M6 contract ─────
// Owner copy lives in tenant_settings.settings.copy (CopyOverride). The storefront
// reads it through resolveTenantCopy/resolveThemeContent (the M2-built contract):
// a non-empty string per field overrides the theme default; empty/missing reverts
// to the theme copy. We MERGE onto the existing settings jsonb (...prev) so we never
// clobber layout/theme/contact/notifications — same seam saveSettings uses.
const COPY_FIELDS = ['heroEyebrow', 'heroTitle', 'heroLede', 'aboutCopy', 'tagline', 'italic'] as const

export async function saveStorefrontCopy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  // Build the copy patch from the form. An empty field is stored as '' — the
  // resolver treats empty as "unset" → reverts to the theme default. That's the
  // undo path: clear a field, save, and the theme copy comes back.
  const copy: CopyOverride = {}
  for (const f of COPY_FIELDS) {
    // Trim only trailing/leading; inner newlines are preserved by the resolver.
    copy[f] = String(fd.get(f) ?? '').slice(0, 600)
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const settings = { ...prev, copy }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, settings }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/varumarke')
  return { success: 'Texter sparade. Publika webbplatsen uppdaterad.' }
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

/**
 * Owner's Google-review link. Empty → null (review nudge no-ops gracefully).
 * Otherwise must parse as an https URL; mirrors hexOrNull's contract so the caller
 * rejects on `undefined`. Uses the WHATWG `URL` global (available on Workers).
 */
function httpsUrlOrNull(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  try {
    const url = new URL(v)
    return url.protocol === 'https:' ? v : undefined // undefined = invalid (caller rejects)
  } catch {
    return undefined
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

  // Notiser & integritet. Checkboxes only appear in FormData when checked, so an
  // absent key means "unchecked" → persist explicit `false` (the M9 reader treats
  // an absent jsonb key as ON, so we must write false to actually turn it off).
  const notifications = {
    confirmation: String(fd.get('notify_confirmation') ?? '') === 'true',
    reminder: String(fd.get('notify_reminder') ?? '') === 'true',
    review: String(fd.get('notify_review') ?? '') === 'true',
  }
  const cookieBannerEnabled = String(fd.get('cookie_banner_enabled') ?? '') === 'true'
  const googleReviewUrl = httpsUrlOrNull(fd.get('google_review_url'))

  if (!name) return { error: 'Ange ett salongsnamn.' }
  if (!PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number]))
    return { error: 'Ogiltigt betalningsläge.' }
  const cancelHours = cancelRaw === '' ? 24 : Number(cancelRaw)
  if (!Number.isFinite(cancelHours) || cancelHours < 0 || cancelHours > 8760)
    return { error: 'Avbokningsregel måste vara ett antal timmar (0–8760).' }
  if (timezone && !isValidTz(timezone)) return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }
  if (googleReviewUrl === undefined)
    return { error: 'Ogiltig recensionslänk. Använd en https-länk, t.ex. https://g.page/r/.../review.' }

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
    notifications, // M9: per-channel toggles (confirmation/reminder/review)
    google_review_url: googleReviewUrl, // M9: review-nudge link (null = off)
    // sms_enabled intentionally NOT written here (M6 §3.7 — dead toggle removed
    // from the UI). Any previously stored value is preserved by the `...prev` spread.
    cookie_banner_enabled: cookieBannerEnabled, // storefront cookie banner
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

// ── Customers (M6 §3.1 + §4) ──────────────────────────────────────────────────
/**
 * Owner edits a customer's display-name privacy (M6 §4 "kund styr visningsnamn").
 * Note: per spec the CUSTOMER owns this; the owner can set it on the customer's
 * behalf (front-desk request) but the stored data still drives every surface.
 *   show = 'full'    → show the full name (name_hidden=false, no display override)
 *   show = 'initial' → name_hidden=true (renders the masked initial)
 *   display_name     → optional explicit chosen name (e.g. first name / nickname)
 */
export async function setCustomerPrivacy(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  const mode = String(fd.get('mode') ?? 'full')
  const displayName = String(fd.get('display_name') ?? '').trim().slice(0, 80)
  if (!customerId) return { error: 'Saknar kund.' }
  if (!['full', 'chosen', 'initial'].includes(mode)) return { error: 'Ogiltigt val.' }

  // mode → stored shape (mirrors get_customer_contact's display_name rule):
  //   full    : name_hidden=false, display_name=null  → full name shows
  //   chosen  : name_hidden=false, display_name=<text> → chosen name shows
  //   initial : name_hidden=true,  display_name=null  → masked initial shows
  const patch =
    mode === 'initial'
      ? { name_hidden: true, display_name: null }
      : mode === 'chosen'
        ? { name_hidden: false, display_name: displayName || null }
        : { name_hidden: false, display_name: null }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath('/admin/kunder')
  revalidatePath(`/admin/kunder/${customerId}`)
  return { success: 'Visningsnamn uppdaterat.' }
}

// ── Bookings overview ─────────────────────────────────────────────────────────
// Status-transition matrix (ALLOWED_FROM) lives in ./format alongside
// BOOKING_STATUSES so its invariant is unit-testable without this 'use server'
// module (a 'use server' file may only export async functions).
export async function setBookingStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const bookingId = String(fd.get('bookingId') ?? '')
  const status = String(fd.get('status') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }
  if (!BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number]))
    return { error: 'Ogiltig status.' }

  const supabase = await createClient()

  // No-op: the admin <select> defaults to the booking's CURRENT status, so the
  // most trivial interaction (open a booking, click Spara without changing the
  // dropdown) submits the same status. Treat that as a success without writing —
  // and without re-firing the review-nudge/refund side-effects below.
  const { data: current } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Saknar bokning.' }
  if (current.status === status) return { success: 'Status uppdaterad.' }

  const allowedFrom = ALLOWED_FROM[status as BookingStatus]
  // Gate the write on the current status: .in('status', allowedFrom) means the
  // UPDATE only matches when the transition is permitted. Zero rows back ⇒ the
  // booking was in a status this target can't be reached from.
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenant.id)
    .in('status', allowedFrom)
    .select('id')
    .maybeSingle()
  if (error) {
    // Reactivating a booking can collide with the no_double_booking EXCLUDE.
    if (error.code === '23P01')
      return { error: 'Tiden krockar med en annan aktiv bokning för medarbetaren.' }
    return { error: GENERIC }
  }
  if (!updated) return { error: 'Otillåten statusövergång.' }

  // Visit done → Google-review nudge (M9). Best-effort: never throws, so it can't
  // fail the status the admin just set. Only fires on a real transition.
  if (status === 'completed') await sendReviewNudgeForBooking(supabase, bookingId)
  // Avbokning → återbetala ev. lyckad betalning. No-op om ingen 'succeeded'
  // betalning finns; refundBookingPayment sväljer egna fel (kastar aldrig).
  if (status === 'cancelled') await refundBookingPayment(bookingId, ctx.tenant.id)

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: 'Status uppdaterad.' }
}
