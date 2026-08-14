'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { createClient } from '@/lib/supabase/server'
import { requireAdminArea, type CurrentUser } from '@/lib/auth/session'
import type { AdminArea } from '@/lib/auth/admin-areas'
import {
  getAdminTenant,
  requireActiveTenantMutation,
  revalidateTenant,
  type AdminTenant,
} from './tenant'
import { listServices, type ServiceRow } from './data'
import { parseServiceFormData, servicePriceCents } from './service-schema'
import {
  managedUploadErrorMessage,
  retireManagedImages,
  uploadManagedImage,
} from '@/lib/media/lifecycle'
import { BOOKING_STATUSES, restoreBlockedByRefund } from './format'
import { createServiceClient } from '@/lib/platform/service'
import { eraseTenantCustomerData } from '@/lib/gdpr/erase'
import { provisionStaffInvite } from '@/lib/auth/staff-invite-service'
import { captureException } from '@/lib/observability'
import { getAdminLocationPreferences } from './location-context'
import { notificationQueueMessage, queueBookingEvent } from '@/lib/notifications/booking-events'
import {
  mergeScopedSettings,
  parseCancellationCutoffHours,
  parseSettingsScope,
  type SettingsScope,
} from './scoped-settings'
import { parseTenantLegalInput } from '@/lib/tenant-region'
import {
  readCustomerPortalMode,
  resolveLegacyPortalModeChange,
} from '@/lib/customer-portal/mode'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ActionState = { error?: string; success?: string }
export type ServiceActionState = ActionState & { record?: ServiceRow }
export type ServiceListState = { error?: string; records?: ServiceRow[] }

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

function staffActivationErrorMessage(message: string): string {
  if (message.includes('staff_activation_requires_confirmed_opening_hours')) {
    return 'Bekräfta platsens öppettider under Öppettider och schema innan du aktiverar medarbetaren.'
  }
  if (message.includes('staff_activation_requires_working_hours')) {
    return 'Lägg till arbetstider under Öppettider och schema innan du aktiverar medarbetaren.'
  }
  if (message.includes('staff_activation_requires_matching_service')) {
    return 'Koppla minst en aktiv tjänst för medarbetarens plats innan du aktiverar medarbetaren.'
  }
  return GENERIC
}

/**
 * Authorization fence for EVERY admin mutation. RLS only isolates tenants, it is
 * NOT role-aware (a level-2 kund shares the tenant claim), so the role gate lives
 * here in the server action. Also resolves the tenant (id + slug) needed to scope
 * writes and invalidate the public cache.
 *
 * ROLL-SEPARATION: varje mutation deklarerar VILKEN yta den tillhör (lib/auth/admin-areas.ts).
 * Personal (nivå 3) släpps igenom på kalender-/kundytorna men NEKAS på systemytorna
 * (tjänster, personal, platser, sida, inställningar …) — samma tabell som sidorna läser.
 */
async function adminCtx(
  area: AdminArea,
): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requireAdminArea(area)
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  await requireActiveTenantMutation(user, tenant.id)
  return { user, tenant }
}

// ── Services ────────────────────────────────────────────────────────────────
export async function listServicesResource(): Promise<ServiceListState> {
  const user = await requireAdminArea('tjanster')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: NO_TENANT }
  try {
    return { records: await listServices(tenant.id) }
  } catch {
    return { error: GENERIC }
  }
}

export async function createService(_p: ActionState, fd: FormData): Promise<ServiceActionState> {
  const ctx = await adminCtx('tjanster')
  if (!ctx) return { error: NO_TENANT }

  const parsed = parseServiceFormData(fd)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC }
  const { name, category, duration_min: duration, price } = parsed.data
  const priceCents = servicePriceCents(price)!

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .insert({
      tenant_id: ctx.tenant.id,
      location_id: ctx.tenant.locationId,
      name,
      category: category || null,
      duration_min: duration,
      price_cents: priceCents,
      active: true,
    })
    .select('*')
    .single()
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst skapad.', record: data }
}

export async function updateService(_p: ActionState, fd: FormData): Promise<ServiceActionState> {
  const ctx = await adminCtx('tjanster')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar tjänst.' }
  const parsed = parseServiceFormData(fd)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC }
  const { name, category, duration_min: duration, price } = parsed.data
  const priceCents = servicePriceCents(price)!

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .update({ name, category: category || null, duration_min: duration, price_cents: priceCents })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('*')
    .single()
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst uppdaterad.', record: data }
}

export async function toggleServiceActive(
  _p: ActionState,
  fd: FormData,
): Promise<ServiceActionState> {
  const ctx = await adminCtx('tjanster')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('*')
    .single()
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return {
    success: active ? 'Tjänst aktiverad.' : 'Tjänst inaktiverad.',
    record: data,
  }
}

export async function deleteService(_p: ActionState, fd: FormData): Promise<ServiceActionState> {
  const ctx = await adminCtx('tjanster')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('*')
    .single()
  if (error) {
    // FK from bookings(service_id) → can't delete a service with history.
    if (error.code === '23503')
      return { error: 'Tjänsten har bokningar och kan inte tas bort. Inaktivera den i stället.' }
    return { error: GENERIC }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst borttagen.', record: data }
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
  const ctx = await adminCtx('platser')
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  if (!name) return { error: 'Ange ett namn.' }
  if (timezone && !isValidTz(timezone))
    return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }

  const supabase = await createClient()
  const { data: created, error } = await supabase
    .from('locations')
    .insert({
      tenant_id: ctx.tenant.id,
      name,
      address: address || null,
      timezone: timezone || DEFAULT_TZ,
      is_primary: false, // a new location never steals primary — use "Gör till primär"
      active: true,
    })
    .select('id')
    .single()
  if (error || !created) return { error: GENERIC }

  // Ny plats kan starta som EXAKT KOPIA av primära platsens schema (Zivar
  // 2026-07-10: "kopia av den primära och sen tweaka — eller allt från nytt").
  // Kopian = personalens grundtider (working_hours) + explicita bokningsbara
  // starttider (working_hour_slots) ompekade till nya platsen. Tjänster är
  // tenant-globala och öppettider härleds ur grundtiderna — inget mer att klona.
  // Dubbelbokning över platser är alltid spärrad av no_double_booking-constrainten.
  if (String(fd.get('schema_mode') ?? '') === 'copy') {
    const { data: primary } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', ctx.tenant.id)
      .eq('is_primary', true)
      .maybeSingle()
    if (primary) {
      const [{ data: hours }, { data: slots }] = await Promise.all([
        supabase
          .from('working_hours')
          .select('staff_id, weekday, start_time, end_time')
          .eq('tenant_id', ctx.tenant.id)
          .eq('location_id', primary.id),
        supabase
          .from('working_hour_slots')
          .select('staff_id, weekday, start_time, active')
          .eq('tenant_id', ctx.tenant.id)
          .eq('location_id', primary.id),
      ])
      const remap = <T extends object>(rows: T[] | null) =>
        (rows ?? []).map((r) => ({ ...r, tenant_id: ctx.tenant.id, location_id: created.id }))
      const [hRes, sRes] = await Promise.all([
        remap(hours).length ? supabase.from('working_hours').insert(remap(hours)) : { error: null },
        remap(slots).length
          ? supabase.from('working_hour_slots').insert(remap(slots))
          : { error: null },
      ])
      if (hRes.error || sRes.error) {
        revalidateLocations(ctx.tenant.slug)
        return {
          success:
            'Plats skapad, men schemakopian gick inte igenom helt — kontrollera tiderna under Scheman.',
        }
      }
      revalidateLocations(ctx.tenant.slug)
      return { success: 'Plats skapad med en kopia av primära platsens schema.' }
    }
  }

  revalidateLocations(ctx.tenant.slug)
  // goal-61 preview-parity: location/personal syns på publika sajten (kontakt/bokning) — busta tenant-cachen.
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Plats skapad.' }
}

export async function updateLocation(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('platser')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const name = String(fd.get('name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  if (!id) return { error: 'Saknar plats.' }
  if (!name) return { error: 'Ange ett namn.' }
  if (timezone && !isValidTz(timezone))
    return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }

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
  // goal-61 preview-parity: location/personal syns på publika sajten (kontakt/bokning) — busta tenant-cachen.
  revalidateTenant(ctx.tenant.slug)
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
  const ctx = await adminCtx('platser')
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
  const ctx = await adminCtx('platser')
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

async function resolveActiveStaffLocation(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  requestedLocation: string,
): Promise<string | null> {
  if (!requestedLocation) return null
  const { data } = await supabase
    .from('locations')
    .select('id')
    .eq('id', requestedLocation)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle()
  return data?.id ?? null
}

export async function createStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange ett namn/en titel.' }

  const supabase = await createClient()
  const requestedLocation = String(fd.get('location_id') ?? '').trim()
  const locationId = await resolveActiveStaffLocation(supabase, ctx.tenant.id, requestedLocation)
  if (!locationId) return { error: 'Välj en aktiv plats.' }
  const { error } = await supabase.rpc('create_staff_with_defaults', {
    p_title: title,
    p_location: locationId,
  })
  if (error) return { error: GENERIC }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Medarbetare tillagd. Bokningsstatusen visar om något behöver slutföras.' }
}

export async function updateStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar medarbetare.' }

  // Partiell patch: Drawerns namn-formulär postar `title`, plats-formuläret postar
  // `location_id`, foto-formuläret `avatar`/`remove_avatar` och synlighets-formuläret
  // `show_on_site` — varje formulär uppdaterar bara sitt eget fält, så en frånvarande
  // nyckel lämnas orörd (det ena formuläret kan aldrig blanka det andras fält).
  const patch: {
    title?: string
    location_id?: string | null
    show_on_site?: boolean
    avatar_url?: string | null
    color?: string | null
  } = {}
  if (fd.has('title')) {
    const title = String(fd.get('title') ?? '').trim()
    if (!title) return { error: 'Ange ett namn/en titel.' }
    patch.title = title
  }
  // goal-67: kalenderfärgen. Värdet hamnar i en inline-style i kalendern — bara ren
  // hex släpps in (DB:n har samma check, vakten står på båda sidor). Tomt = "ingen
  // vald färg" → appen härleder färgen ur id:t igen.
  if (fd.has('color')) {
    const color = String(fd.get('color') ?? '').trim()
    if (!color) patch.color = null
    else if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: 'Ogiltig färg.' }
    else patch.color = color
  }

  const supabase = await createClient()
  if (fd.has('location_id')) {
    const locId = String(fd.get('location_id') ?? '').trim()
    if (locId) {
      // location_id är klient-input och FK:n accepterar vilken tenants plats som
      // helst — bekräfta att platsen är VÅR (och aktiv) innan personalen pinnas
      // dit. Samma lucka som resolveScheduleLocation/setStaffServices vaktar.
      const { data: loc } = await supabase
        .from('locations')
        .select('id')
        .eq('id', locId)
        .eq('tenant_id', ctx.tenant.id)
        .eq('active', true)
        .maybeSingle()
      if (!loc) return { error: 'Okänd plats.' }
      patch.location_id = locId
    } else {
      patch.location_id = null
    }
  }

  // Synlighet i publika team-sektionen (staff.show_on_site, 0049) — styr ENDAST
  // "Våra barberare" på sidan; bokningsbarheten är staff.active som förut.
  if (fd.has('show_on_site')) {
    patch.show_on_site = String(fd.get('show_on_site') ?? '') === 'true'
  }

  // Foto (staff.avatar_url, 0049): remove_avatar=true → null (standard-silhuett
  // visas); annars laddas bifogad fil upp till R2 via den gemensamma hanterade
  // mediapipelinen. Gamla objektet städas best-effort EFTER commit och BARA
  // när det är medarbetarens EGNA lagrade avatar_url (DB-läst — aldrig en klient-
  // skickad URL).
  let removedAvatar: string | null = null
  let uploadedAvatarNew = false
  const removeAvatar = String(fd.get('remove_avatar') ?? '') === 'true'
  const avatar = fd.get('avatar')
  const hasAvatarFile = avatar instanceof File && avatar.size > 0
  if (removeAvatar || hasAvatarFile) {
    const { data: row } = await supabase
      .from('staff')
      .select('avatar_url')
      .eq('id', id)
      .eq('tenant_id', ctx.tenant.id)
      .maybeSingle()
    if (!row) return { error: 'Okänd medarbetare.' }
    if (removeAvatar) {
      patch.avatar_url = null
    } else {
      const res = await uploadManagedImage(
        supabase,
        ctx.tenant.id,
        avatar as File,
        'sajtbyggare',
      )
      if (!res.ok) return { error: managedUploadErrorMessage(res.reason) }
      patch.avatar_url = res.url
      uploadedAvatarNew = !res.duplicate
    }
    removedAvatar = row.avatar_url
  }

  if (Object.keys(patch).length === 0) return {}

  const { error } = await supabase
    .from('staff')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) {
    if (uploadedAvatarNew && typeof patch.avatar_url === 'string') {
      await retireManagedImages(supabase, ctx.tenant.id, [patch.avatar_url])
    }
    return { error: GENERIC }
  }

  await retireManagedImages(
    supabase,
    ctx.tenant.id,
    [removedAvatar],
    [patch.avatar_url],
  )

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Sparad.' }
}

export async function toggleStaffActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar medarbetare.' }

  const supabase = await createClient()
  const { data: accountLinked, error } = await supabase.rpc('set_staff_active', {
    p_staff: id,
    p_active: active,
  })
  if (error) return { error: staffActivationErrorMessage(error.message) }

  revalidateStaff(ctx.tenant.slug)
  return {
    success: active
      ? accountLinked
        ? 'Medarbetare och konto aktiverade.'
        : 'Medarbetare aktiverad.'
      : accountLinked
        ? 'Medarbetare inaktiverad och kontoåtkomst stängd.'
        : 'Medarbetare inaktiverad.',
  }
}

export async function deleteStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar medarbetare.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
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
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  if (!staffId) return { error: 'Saknar medarbetare.' }
  const requested = fd.getAll('service_id').map(String).filter(Boolean)

  const supabase = await createClient()

  // Confirm the staff row is ours before writing — staff_id is client-supplied,
  // and RLS does not isolate roles within a tenant. Same fence as addStaffWorkingHours.
  const { data: member } = await supabase
    .from('staff')
    .select('id, location_id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!member) return { error: 'Okänd medarbetare.' }
  if (!member.location_id) return { error: 'Välj en plats för medarbetaren först.' }

  // Keep only service ids that actually belong to this tenant (defence-in-depth:
  // staff_services.service_id has no same-tenant FK constraint).
  const { data: own } = await supabase
    .from('services')
    .select('id')
    .eq('tenant_id', ctx.tenant.id)
    .eq('active', true)
    .or(`location_id.is.null,location_id.eq.${member.location_id}`)
    .in('id', requested.length ? requested : ['00000000-0000-0000-0000-000000000000'])
  const valid = new Set((own ?? []).map((r) => r.id))
  const toInsert = requested.filter((id) => valid.has(id))

  // RPC:n gör delete+insert i EN transaktion. Ett insertfel kan aldrig lämna
  // medarbetaren utan de kopplingar som fanns före försöket.
  const { error } = await supabase.rpc('replace_staff_services', {
    p_staff: staffId,
    p_services: toInsert,
  })
  if (error) return { error: GENERIC }

  revalidateStaff(ctx.tenant.slug)
  return { success: 'Tjänster kopplade.' }
}

/** Koppla den inloggade organisationsägarens befintliga konto till en staff-rad.
 *  Detta är INTE inviteStaff: ägarens roll och auth-metadata ska lämnas helt
 *  orörda. staff.profile_id är redan den kanoniska och unika auth→personal-länken. */
export async function linkCurrentUserToStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  // Plattformspersonal kan förhandsgranska tenant-admin, men får aldrig binda
  // sitt plattformskonto till en kunds personalrad. Bara en tenant-bunden
  // organisationsägare får skapa den personliga auth→staff-länken.
  if (ctx.user.platformAdmin) return { error: 'Bara organisationsägaren kan koppla sitt konto.' }
  if (ctx.user.roleLevel < 6 || ctx.user.tenantId !== ctx.tenant.id) {
    return { error: 'Bara organisationsägaren kan koppla sitt konto.' }
  }
  const preferences = await getAdminLocationPreferences(ctx.user.id)
  if (preferences.accessScope !== 'organization') {
    return { error: 'Bara organisationsägaren kan koppla sitt konto.' }
  }

  const staffId = String(fd.get('staff_id') ?? '').trim()
  if (!staffId) return { error: 'Saknar medarbetare.' }

  const supabase = await createClient()
  const { data: existingLink, error: existingError } = await supabase
    .from('staff')
    .select('id')
    .eq('tenant_id', ctx.tenant.id)
    .eq('profile_id', ctx.user.id)
    .limit(1)
    .maybeSingle()
  if (existingError) return { error: GENERIC }
  if (existingLink) {
    return existingLink.id === staffId
      ? { success: 'Ägarkontot är redan kopplat till den här profilen.' }
      : { error: 'Ditt ägarkonto är redan kopplat till en annan personalprofil.' }
  }

  const { data: target, error: targetError } = await supabase
    .from('staff')
    .select('id, profile_id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (targetError) return { error: GENERIC }
  if (!target) return { error: 'Medarbetaren saknas.' }
  if (target.profile_id) return { error: 'Personalprofilen har redan ett annat konto.' }

  const { data: linked, error } = await supabase
    .from('staff')
    .update({ profile_id: ctx.user.id })
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .is('profile_id', null)
    .select('id')
    .maybeSingle()
  if (error?.code === '23505') {
    return { error: 'Ditt ägarkonto är redan kopplat till en annan personalprofil.' }
  }
  if (error || !linked) return { error: 'Profilen hann kopplas av någon annan. Ladda om sidan.' }

  revalidateStaff(ctx.tenant.slug)
  revalidatePath(`/admin/personal/${staffId}`)
  return { success: 'Ägarkontot är nu kopplat till personalprofilen.' }
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
  const ctx = await adminCtx('personal')
  if (!ctx) return { error: NO_TENANT }

  const email = String(fd.get('email') ?? '')
    .trim()
    .toLowerCase()
  const title = String(fd.get('title') ?? '').trim()
  // Optional: invite into an EXISTING staff row (link it) instead of a new one.
  const staffId = String(fd.get('staff_id') ?? '').trim()
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ange en giltig e-postadress.' }

  const supabase = await createClient()
  const requestedLocation = String(fd.get('location_id') ?? '').trim()
  const locationId = staffId
    ? null
    : await resolveActiveStaffLocation(supabase, ctx.tenant.id, requestedLocation)
  if (!staffId && !locationId) return { error: 'Välj en aktiv plats.' }
  const svc = createServiceClient()
  if (!svc) {
    return {
      error:
        'Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av drift). Medarbetaren kan läggas till utan konto under tiden.',
    }
  }

  const result = await provisionStaffInvite({
    service: svc,
    accountClient: svc,
    tenantId: ctx.tenant.id,
    email,
    ...(staffId ? { targetStaffId: staffId } : {}),
    createStaff: async (authId) => {
      if (staffId) {
        const { data: linked, error } = await supabase
          .from('staff')
          .update({ profile_id: authId })
          .eq('id', staffId)
          .eq('tenant_id', ctx.tenant.id)
          .is('profile_id', null)
          .select('id')
          .maybeSingle()
        return { error: error ?? (linked ? null : new Error('staff_link_not_committed')) }
      }

      const { error } = await supabase.rpc('create_staff_with_defaults', {
        p_title: title || email,
        p_location: locationId!,
        p_profile: authId,
      })
      return { error }
    },
    reportIncident: async (event) => {
      await captureException(new Error(event.stage), {
        action: 'inviteStaff',
        stage: event.stage,
        tenantId: event.tenantId,
        ...(typeof event.containmentOk === 'boolean'
          ? { containmentOk: event.containmentOk }
          : {}),
      })
    },
  })
  if (!result.ok) return { error: result.error }
  if (result.alreadyLinked) {
    return { success: `Kontot fanns redan och är kopplat till ${email}.` }
  }

  revalidateStaff(ctx.tenant.slug)
  return {
    success: !result.inviteSent
      ? `Kontot fanns redan och kopplades till ${email}. Använd Glömt lösenord om en ny länk behövs.`
      : staffId
        ? `Inbjudan skickad till ${email}. Kontot är kopplat till den befintliga medarbetaren.`
        : `Inbjudan skickad till ${email}. Ny personal är skapad. Kontrollera tjänster, arbetstider och bokningsstatus under Personal.`,
  }
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
  const ctx = await adminCtx('scheman')
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const weekday = Number(fd.get('weekday'))
  const start = String(fd.get('start_time') ?? '')
  const end = String(fd.get('end_time') ?? '')
  const requestedLocation = String(fd.get('location_id') ?? '')

  if (!staffId) return { error: 'Välj en medarbetare.' }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    return { error: 'Välj en veckodag.' }
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
  const ctx = await adminCtx('scheman')
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
// The public availability owner reads active working_hour_slots and otherwise falls
// back to working_hours. Admin keeps the same data editable here.

export async function addStaffSlots(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('scheman')
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
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    return { error: 'Välj en veckodag.' }
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
  const ctx = await adminCtx('scheman')
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
  const ctx = await adminCtx('scheman')
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

// ── Legal settings ────────────────────────────────────────────────────────────
export async function saveLegalSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('installningar')
  if (!ctx) return { error: NO_TENANT }

  const legal = parseTenantLegalInput(fd.get('org_nr'), fd.get('vat_rate'))
  if (!legal) return { error: 'Momssatsen ska vara ett tal mellan 0 och 100 (t.ex. 25).' }
  const { orgNr, vatRate } = legal

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const prevLegal = (prev.legal ?? {}) as Record<string, unknown>
  const settings = { ...prev, legal: { ...prevLegal, org_nr: orgNr, vat_rate: vatRate } }

  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, settings }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/installningar/betalning')
  return { success: 'Juridikuppgifter sparade. Villkor och kvitton uppdaterade.' }
}

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
 * Otherwise must parse as an https URL; invalid input returns `undefined` so the
 * caller can reject it. Uses the WHATWG `URL` global (available on Workers).
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
  const ctx = await adminCtx('installningar')
  if (!ctx) return { error: NO_TENANT }
  const preferences = await getAdminLocationPreferences(ctx.user.id)
  if (preferences.accessScope !== 'organization') {
    return { error: 'Endast organisationsägaren får ändra dessa inställningar.' }
  }

  const scope = parseSettingsScope(fd.get('settings_scope') ?? 'all')
  if (!scope) return { error: 'Ogiltig inställningssektion. Ladda om sidan och försök igen.' }
  const includesScope = (candidate: SettingsScope) => scope === 'all' || scope === candidate
  const name = String(fd.get('name') ?? '').trim()
  const paymentMode = String(fd.get('payment_mode') ?? 'on_site')
  const cancelRaw = String(fd.get('cancellation_cutoff_hours') ?? '').trim()
  const timezone = String(fd.get('timezone') ?? '').trim()
  const locationName = String(fd.get('location_name') ?? '').trim()
  const address = String(fd.get('address') ?? '').trim()
  const contactEmail = String(fd.get('contact_email') ?? '').trim()
  const contactPhone = String(fd.get('contact_phone') ?? '').trim()

  // Checkboxes only appear in FormData when checked. Scope makes absence mean
  // "off" only for the visible card, never for unrelated settings.
  const notifications = includesScope('notifications')
    ? {
        confirmation: String(fd.get('notify_confirmation') ?? '') === 'true',
        reminder: String(fd.get('notify_reminder') ?? '') === 'true',
        review: String(fd.get('notify_review') ?? '') === 'true',
      }
    : undefined
  const cookieBannerEnabled = includesScope('privacy')
    ? String(fd.get('cookie_banner_enabled') ?? '') === 'true'
    : undefined
  const googleReviewUrl = includesScope('integrations')
    ? httpsUrlOrNull(fd.get('google_review_url'))
    : undefined

  if (scope === 'all' && !name) return { error: 'Ange ett företagsnamn.' }
  if (scope === 'all' && !PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number]))
    return { error: 'Ogiltigt betalningsläge.' }
  const cancelHours = parseCancellationCutoffHours(cancelRaw)
  if (includesScope('booking') && cancelHours === null)
    return { error: 'Avbokningsregel måste vara ett antal timmar (0–8760).' }
  if (scope === 'all' && timezone && !isValidTz(timezone))
    return { error: 'Ogiltig tidszon (IANA, t.ex. Europe/Stockholm).' }
  if (includesScope('integrations') && googleReviewUrl === undefined)
    return {
      error: 'Ogiltig recensionslänk. Använd en https-länk, t.ex. https://g.page/r/.../review.',
    }

  const supabase = await createClient()

  const { data: existing, error: settingsReadError } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (settingsReadError) return { error: GENERIC }
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const currentPortalMode = readCustomerPortalMode(prev)
  const portalModeDecision = includesScope('booking')
    ? resolveLegacyPortalModeChange(
        currentPortalMode,
        String(fd.get('legacy_customer_account_requested') ?? '') === 'true',
      )
    : { ok: true as const, nextMode: null }
  if (fd.has('customer_portal_mode') || !portalModeDecision.ok) {
    return { error: 'Kundportalläget hanteras av plattformsadministratören.' }
  }

  // 1) tenant name (feeds the cached public bundle).
  if (scope === 'all') {
    const t = await supabase.from('tenants').update({ name }).eq('id', ctx.tenant.id)
    if (t.error) return { error: GENERIC }
  }

  // 2) tenant_settings: merge into the existing settings jsonb so scoped saves do
  //    not clobber settings owned by another admin section.
  const settings = mergeScopedSettings(prev, scope, {
    cancellationHours: includesScope('booking') ? (cancelHours ?? undefined) : undefined,
    contact:
      scope === 'all' ? { email: contactEmail || null, phone: contactPhone || null } : undefined,
    notifications,
    googleReviewUrl,
    cookieBannerEnabled,
  })
  type TenantSettingsInsert = Database['public']['Tables']['tenant_settings']['Insert']
  const storedSettings = settings as TenantSettingsInsert['settings']
  const settingsWrite: TenantSettingsInsert =
    scope === 'all'
      ? { tenant_id: ctx.tenant.id, payment_mode: paymentMode, settings: storedSettings }
      : { tenant_id: ctx.tenant.id, settings: storedSettings }
  const s = await supabase
    .from('tenant_settings')
    .upsert(settingsWrite, { onConflict: 'tenant_id' })
  if (s.error) return { error: GENERIC }

  if (portalModeDecision.nextMode && portalModeDecision.nextMode !== currentPortalMode) {
    const service = createServiceClient()
    if (!service) return { error: GENERIC }
    const portal = await service.rpc('set_customer_portal_mode', {
      p_tenant: ctx.tenant.id,
      p_mode: portalModeDecision.nextMode,
    })
    if (portal.error) return { error: GENERIC }
  }

  // 3) primary location (timezone + name + address), if the tenant has one.
  if (scope === 'all' && ctx.tenant.locationId) {
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
  revalidatePath('/admin/installningar/bokning')
  revalidatePath('/admin/installningar/paminnelser')
  revalidatePath('/admin/installningar/integrationer')
  revalidatePath('/admin/installningar/sekretess')
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
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  const mode = String(fd.get('mode') ?? 'full')
  const displayName = String(fd.get('display_name') ?? '')
    .trim()
    .slice(0, 80)
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

/** Dölj/visa kund (B-25 soft delete). Kunden försvinner ur listor och sök men raden
 *  och HELA bokningshistoriken finns kvar — och kan visas igen med ett klick. Det är
 *  INTE GDPR-radering (den vägen är status='anonymized' och är enkelriktad). */
export async function setCustomerHidden(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  const hide = String(fd.get('hide') ?? '') === '1'
  if (!customerId) return { error: 'Saknar kund.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update({ hidden_at: hide ? new Date().toISOString() : null })
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath('/admin/kunder')
  revalidatePath(`/admin/kunder/${customerId}`)
  return {
    success: hide
      ? 'Kunden är dold — historiken finns kvar, och kunden kan visas igen härifrån.'
      : 'Kunden syns igen i listor och sök.',
  }
}

/** Skapa kund direkt i admin (plan 007 — CRUD-symmetri: front-desk ska inte behöva
 *  skapa en bokning för att få in en stamkund). Tenant TVINGAS ur JWT-kontexten
 *  (aldrig formData — mass-assignment-vakten), RLS (customers_staff_write, 0071) är
 *  andra stängslet. contact_hash lämnas null: dedup-nyckeln ägs av gästboknings-
 *  vägen (resolve_customer_id); ihopslagning av ev. dubblett är plan 013:s merge. */
export async function createCustomer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const fullName = String(fd.get('full_name') ?? '')
    .trim()
    .slice(0, 120)
  const email = String(fd.get('email') ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 160)
  const phone = String(fd.get('phone') ?? '')
    .trim()
    .slice(0, 40)
  if (!fullName) return { error: 'Ange kundens namn.' }
  if (email && !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: ctx.tenant.id,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      status: 'active',
      first_seen_at: now,
      last_seen_at: now,
    })
    .select('id')
    .maybeSingle()
  if (error || !data) return { error: GENERIC }

  revalidatePath('/admin/kunder')
  return { success: 'Kund skapad.' }
}

/** GDPR-radering från ägaradmin (plan 007 — art. 17-begäran via salongen). Stänger
 *  SettingsV2:s "Radera kunddata"-återvändsgränd. ÄGAR-GUARD utöver områdesgrinden:
 *  personal (nivå 3, även PLATSCHEF) kan aldrig radera kunddata. Irreversibel —
 *  UI:t kräver tvåstegs-arm; servern kräver dessutom explicit confirm-fält. */
export async function eraseCustomer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }
  if (ctx.user.roleLevel < 6 && !ctx.user.platformAdmin) {
    return { error: 'Endast ägaren/administratören kan radera kunddata.' }
  }

  const customerId = String(fd.get('customer_id') ?? '').trim()
  const confirmed = String(fd.get('confirm') ?? '') === 'radera'
  if (!customerId) return { error: 'Saknar kund.' }
  if (!confirmed) return { error: 'Bekräftelsen saknas.' }

  const result = await eraseTenantCustomerData({
    customerId,
    tenantId: ctx.tenant.id,
    actorId: ctx.user.id,
  })
  if (!result.ok) {
    return {
      error:
        result.reason === 'unavailable'
          ? 'Radering är inte tillgänglig i den här miljön.'
          : GENERIC,
    }
  }

  revalidatePath('/admin/kunder')
  revalidatePath(`/admin/kunder/${customerId}`)
  return {
    success: `Kunddatan är anonymiserad (${result.erasedBookings} bokningsnoteringar rensade). Bokningshistoriken finns kvar utan personuppgifter.`,
  }
}

/** Toggle: får kunden boka SJÄLV via sajten/kundkontot? Av = salongen bokar åt hen
 *  (telefonen fungerar alltid, och ägarens egen kalenderbokning påverkas aldrig).
 *  Används för kunder som upprepat uteblir — utan att behöva dölja eller radera dem. */
export async function setCustomerSelfBook(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  const allow = String(fd.get('allow') ?? '') === '1'
  if (!customerId) return { error: 'Saknar kund.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update({ self_book: allow })
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath(`/admin/kunder/${customerId}`)
  return {
    success: allow
      ? 'Kunden kan boka själv igen.'
      : 'Onlinebokning avstängd för kunden — ni bokar åt hen i kalendern.',
  }
}

/** Kunder v2 KLIENTKORT: spara den fria interna anteckningen (customer_notes.internal_note).
 *  Admin-gatad (kunder-ytan); RLS på customer_notes är personal-only, admin (nivå ≥3)
 *  ryms. Upsert på (tenant, customer) rör BARA internal_note — de strukturerade fälten
 *  (preferenser/allergier m.m. från personalens klientkort) lämnas orörda vid update. */
export async function saveCustomerNote(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  if (!customerId) return { error: 'Saknar kund.' }
  const raw = String(fd.get('note') ?? '').trim()
  const note = raw ? raw.slice(0, 2000) : null

  const supabase = await createClient()
  const { error } = await supabase.from('customer_notes').upsert(
    {
      tenant_id: ctx.tenant.id,
      customer_id: customerId,
      internal_note: note,
      created_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,customer_id' },
  )
  if (error) return { error: GENERIC }

  revalidatePath(`/admin/kunder/${customerId}`)
  return { success: 'Anteckningen sparad.' }
}

/**
 * Rättar en kunds kontakt-PII (telefon + e-post) från kundkortet — front-desk
 * måste kunna fixa en feltypad siffra utan att be kunden boka om.
 *
 * TVÅ FÄLLOR som gör den här mer än en rak update:
 *
 *  1) GDPR: en skrubbad kund (status='anonymized', 0011 §4.3) får ALDRIG
 *     återfyllas med ny PII — då vore raderingen ogjord. Vi läser status FÖRST
 *     och vägrar skriva. (Klienten döljer också formuläret; det här är grinden.)
 *
 *  2) contact_hash är GÄST-identiteten (0011 §3.1 + 0015): nästa bokning
 *     resolvas via hash(tenant|e-post|telefon) → unique (tenant_id, contact_hash).
 *     Ändrar vi e-post/telefon utan att räkna om hashen pekar den på de GAMLA
 *     uppgifterna → nästa bokning matchar inte kunden och det uppstår en tyst
 *     dubblett. Vi räknar därför om den med SAMMA DB-funktion som resolvern
 *     använder (aldrig en TS-kopia av hash-regeln — den skulle kunna glida isär).
 *     Inloggade kunder nycklas på auth_user_id och har contact_hash = null
 *     (0015: "AUTHED branch ... leaves contact_hash NULL") — rör den inte då.
 */
export async function saveCustomerContact(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('kunder')
  if (!ctx) return { error: NO_TENANT }

  const customerId = String(fd.get('customer_id') ?? '')
  const email = String(fd.get('email') ?? '')
    .trim()
    .slice(0, 160)
  const phone = String(fd.get('phone') ?? '')
    .trim()
    .slice(0, 40)
  if (!customerId) return { error: 'Saknar kund.' }
  if (email && !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }
  if (phone && phone.replace(/\D/g, '').length < 6) return { error: 'Ogiltigt telefonnummer.' }

  const supabase = await createClient()

  // Tenant-scopad läsning (RLS + explicit .eq) → status-grinden ovan.
  const { data: row, error: readErr } = await supabase
    .from('customers')
    .select('id, status, auth_user_id')
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (readErr) return { error: GENERIC }
  if (!row) return { error: 'Saknar kund.' }
  if (row.status !== 'active')
    return { error: 'Kunden är raderad (GDPR) — uppgifterna kan inte ändras.' }

  const patch: { email: string | null; phone: string | null; contact_hash?: string | null } = {
    email: email || null,
    phone: phone || null,
  }

  if (!row.auth_user_id) {
    // '' ≡ null för funktionen: den nullif:ar tomma strängar internt (0011 §3.1),
    // och de genererade typerna kräver string. Samma hash, ingen semantikglidning.
    const { data: hash, error: hashErr } = await supabase.rpc('customer_contact_hash', {
      p_tenant: ctx.tenant.id,
      p_email: patch.email ?? '',
      p_phone: patch.phone ?? '',
    })
    // Fail closed: hellre ingen ändring än en hash som pekar på gamla uppgifter.
    if (hashErr) return { error: GENERIC }
    patch.contact_hash = (hash as string | null) ?? null
  }

  const { error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', customerId)
    .eq('tenant_id', ctx.tenant.id)
  if (error) {
    // 23505 = unique (tenant_id, contact_hash): uppgifterna tillhör redan en
    // annan kund i tenanten. Ärligt fel — vi slår INTE ihop två identiteter här.
    if (error.code === '23505') return { error: 'En annan kund har redan den e-posten/telefonen.' }
    return { error: GENERIC }
  }

  revalidatePath('/admin/kunder')
  revalidatePath(`/admin/kunder/${customerId}`)
  return { success: 'Kontaktuppgifter sparade.' }
}

// ── Bookings overview ─────────────────────────────────────────────────────────
// Status-transition matrix (ALLOWED_FROM) lives in ./format alongside
// BOOKING_STATUSES so its invariant is unit-testable without this 'use server'
// module (a 'use server' file may only export async functions).
export async function setBookingStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx('bokningar')
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
  // and without re-firing transition-owned side effects. Completion-eventet och
  // eventuell refundkö skapas atomiskt av DB-triggerar vid den första övergången.
  const { data: current } = await supabase
    .from('bookings')
    .select('status, start_ts, end_ts, customer_id, staff_id')
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Saknar bokning.' }
  if (current.status === status) {
    return { success: 'Status uppdaterad.' }
  }

  // Uteblivet/genomfört är ett PÅSTÅENDE OM ETT AVSLUTAT BESÖK: hela den bokade tiden
  // måste ha passerat. Vakten sitter på servern, inte bara i knapp-logiken — UI:t kan inte vara
  // enda sanningen om vad en status betyder. Ett felaktigt terminalt utfall rättas
  // direkt completed ↔ no_show; DB:n bokför lojalitetskorrigeringen atomiskt.)
  if (
    (status === 'no_show' || status === 'completed') &&
    new Date(current.end_ts).getTime() > Date.now()
  ) {
    return {
      error:
        status === 'no_show'
          ? 'Besöket har inte nått sin sluttid än — det kan inte markeras uteblivet.'
          : 'Besöket har inte nått sin sluttid än — det kan inte markeras genomfört.',
    }
  }

  if (
    (current.status === 'pending' || current.status === 'confirmed') &&
    new Date(current.end_ts).getTime() <= Date.now() &&
    status !== 'completed' &&
    status !== 'no_show'
  ) {
    return { error: 'Bokningen behöver avslutas som Genomförd eller Uteblev.' }
  }

  // Ångra en avbokning (B-24). PENGARNA styr, inte klicket: har betalningen
  // återbetalats är den bokningen slut — att väcka den skulle säga "betald" om en
  // tid kunden fått pengarna tillbaka för. ALLOWED_FROM kan inte se pengar, så
  // vakten sitter här (regeln själv: restoreBlockedByRefund, unit-låst i format.test).
  if (current.status === 'cancelled') {
    if (new Date(current.start_ts).getTime() <= Date.now()) {
      return { error: 'Starttiden har passerat. Skapa en ny bokning i stället.' }
    }
    const { data: pay } = await supabase
      .from('payments')
      .select('status')
      .eq('booking_id', bookingId)
      .eq('tenant_id', ctx.tenant.id)
      .maybeSingle()
    if (restoreBlockedByRefund(current.status, pay?.status))
      return { error: 'Bokningen är återbetald och kan inte återställas. Boka en ny tid.' }
  }

  const statusRpc = supabase as unknown as {
    rpc(
      name: 'set_admin_booking_status',
      args: { p_booking: string; p_status: string },
    ): PromiseLike<{
      data: unknown
      error: { code?: string; message: string } | null
    }>
  }
  const { data: statusResult, error } = await statusRpc.rpc('set_admin_booking_status', {
    p_booking: bookingId,
    p_status: status,
  })
  if (error) {
    // Reactivating a booking can collide with the no_double_booking EXCLUDE.
    if (error.code === '23P01')
      return { error: 'Tiden krockar med en annan aktiv bokning för medarbetaren.' }
    if (
      error.message.includes('booking_not_ended_for_no_show') ||
      error.message.includes('future_booking_cannot_be_no_show')
    )
      return { error: 'Besöket har inte nått sin sluttid än — det kan inte markeras uteblivet.' }
    if (
      error.message.includes('booking_not_ended_for_completed') ||
      error.message.includes('future_booking_cannot_be_completed')
    )
      return { error: 'Besöket har inte nått sin sluttid än — det kan inte markeras genomfört.' }
    if (error.message.includes('refunded_booking_cannot_be_restored'))
      return { error: 'Bokningen är återbetald och kan inte återställas. Boka en ny tid.' }
    if (
      error.message.includes('past_booking_requires_outcome') ||
      error.message.includes('past_booking_schedule_read_only')
    )
      return { error: 'Bokningen behöver avslutas som Genomförd eller Uteblev.' }
    if (error.message.includes('cancelled_booking_already_started'))
      return { error: 'Starttiden har passerat. Skapa en ny bokning i stället.' }
    if (
      error.message.includes('invalid_booking_status_transition') ||
      error.message.includes('booking_changed_concurrently')
    )
      return { error: 'Bokningen ändrades av någon annan. Ladda om och försök igen.' }
    return { error: GENERIC }
  }

  const changed =
    typeof statusResult === 'object' &&
    statusResult !== null &&
    (statusResult as { changed?: unknown }).changed === true
  let notificationMessage = ''
  if (changed && status === 'cancelled') {
    const notification = await queueBookingEvent({
      tenantId: ctx.tenant.id,
      bookingId,
      type: 'booking_cancelled',
      occurredAt: new Date().toISOString(),
      startISO: current.start_ts,
    })
    notificationMessage = ` ${notificationQueueMessage(notification)}`
  } else if (changed && status === 'completed') {
    const notification = await queueBookingEvent({
      tenantId: ctx.tenant.id,
      bookingId,
      type: 'booking_completed',
      occurredAt: new Date().toISOString(),
      staffId: current.staff_id,
    })
    notificationMessage = ` ${notificationQueueMessage(notification)}`
  } else if (changed && status === 'confirmed') {
    const notification = await queueBookingEvent({
      tenantId: ctx.tenant.id,
      bookingId,
      type: 'booking_confirmation',
      occurredAt: new Date().toISOString(),
      startISO: current.start_ts,
      staffId: current.staff_id,
      includeManageLink: true,
      includeAccountClaim: true,
    })
    notificationMessage = ` ${notificationQueueMessage(notification)}`
  }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: `Status uppdaterad.${notificationMessage}` }
}
