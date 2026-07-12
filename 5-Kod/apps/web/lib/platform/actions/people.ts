'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { createServiceClient, hasServiceRole } from '../service'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC, EMAIL_RE } from './shared'
import { reportActionError } from './observe'
import { inviteRedirectUrl } from '@/lib/auth/invite'
import { revalidateTenantById } from '@/lib/admin/tenant'

/**
 * Trigger a password reset for the salon's admin. Generates a recovery link via
 * the service role and surfaces it for Zivar to hand over (no cross-revir email
 * wiring in v1). Gated on hasServiceRole() — degrades with a clear ops message
 * when SUPABASE_SERVICE_ROLE_KEY is unset, never throws.
 */
export async function sendPasswordReset(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }

  if (!hasServiceRole())
    return { error: 'Lösenords-reset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }
  const svc = createServiceClient()
  if (!svc) return { error: 'Lösenords-reset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }

  const { data, error } = await svc.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.action_link) {
    await reportActionError('sendPasswordReset.generateLink', error, { tenantId })
    return { error: `Kunde inte skapa återställningslänk: ${error?.message ?? 'okänt fel'}.` }
  }

  await logPlatformAction(supabase, {
    action: 'tenant.password_reset',
    tenantId,
    actorId: user.id,
    meta: { email },
  })
  return {
    success: `Återställningslänk skapad för ${email}. Kopiera och dela den säkert:\n${data.properties.action_link}`,
  }
}

/**
 * Zivar-assisterad personal-onboarding (M7 §2.4): create a staff row on a CHOSEN
 * tenant via the platform RLS-bypass. Mirrors M6 createStaff (title-only row; no
 * forced fields beyond what the table needs) and attaches the tenant's primary
 * location when one exists. Audit-logged against the tenant.
 */
export async function createTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const title = String(fd.get('title') ?? '').trim()
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!title) return { error: 'Ange ett namn/en titel.' }

  // Primary location (load-bearing for staff↔location, but optional in the schema).
  const { data: loc } = await supabase
    .from('locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('staff').insert({
    tenant_id: tenantId,
    location_id: loc?.id ?? null,
    title,
    active: true,
  })
  if (error) {
    await reportActionError('createTenantStaff.insert', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_create',
    tenantId,
    actorId: user.id,
    meta: { title },
  })
  return { success: `Medarbetare "${title}" tillagd hos kunden.` }
}

/**
 * Invite a staff member WITH a login (magic-link) on a CHOSEN salon — the platform
 * twin of admin inviteStaff, but via platformCtx (RLS bypass) so Zivar can onboard a
 * salon's behandlare with their own account without logging into the salon's admin.
 * Provisions: staff role (level 3) → auth user (inviteUserByEmail) → app_metadata
 * tenant_id → public.users row → new or linked staff row (profile_id). Optional
 * `staffId` links the login to an EXISTING staff row instead of creating one.
 * Gated on hasServiceRole() (SUPABASE_SERVICE_ROLE_KEY, set in prod); degrades with a
 * clear message, never throws. Role/users writes go BEFORE nothing can orphan them.
 */
export async function inviteTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const title = String(fd.get('title') ?? '').trim()
  const staffId = String(fd.get('staffId') ?? '').trim() // optional: link an existing staff row
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ange en giltig e-postadress.' }

  if (!hasServiceRole())
    return { error: 'Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops). Lägg till utan konto under tiden.' }
  const svc = createServiceClient()
  if (!svc) return { error: 'Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }

  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Kunden finns inte.' }

  // 1) Tenant-scoped `staff` role (level 3), idempotent. Platform bypass admits it.
  await supabase
    .from('roles')
    .upsert({ tenant_id: tenantId, name: 'staff', level: 3 }, { onConflict: 'tenant_id,name', ignoreDuplicates: true })
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'staff')
    .maybeSingle()
  if (!role) return { error: GENERIC }

  // 2) Invite the auth user (one-time magic link). redirectTo → /valkommen på
  //    personal-dörren (annars Site URL = fel host).
  const { data: invited, error: iErr } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectUrl('staff'),
  })
  if (iErr || !invited?.user) {
    return { error: `Inbjudan misslyckades: ${iErr?.message ?? 'kontot finns kanske redan'}.` }
  }
  const authId = invited.user.id

  // 3) Bake tenant_id into app_metadata (JWT belt-and-suspenders).
  await svc.auth.admin.updateUserById(authId, { app_metadata: { tenant_id: tenantId, platform_admin: false } })

  // 4) public.users row.
  const { error: uErr } = await supabase
    .from('users')
    .insert({ id: authId, tenant_id: tenantId, email, role_id: role.id, status: 'active' })
  if (uErr) return { error: 'Medarbetaren kunde inte kopplas (kontot finns kanske redan).' }

  // 5) Create or link the staff row → profile_id points at the new account.
  if (staffId) {
    const { error: linkErr } = await supabase
      .from('staff')
      .update({ profile_id: authId })
      .eq('id', staffId)
      .eq('tenant_id', tenantId)
    if (linkErr) return { error: GENERIC }
  } else {
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { error: insErr } = await supabase
      .from('staff')
      .insert({ tenant_id: tenantId, location_id: loc?.id ?? null, profile_id: authId, title: title || email, active: true })
    if (insErr) return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_invite',
    tenantId,
    actorId: user.id,
    entityId: staffId || undefined,
    meta: { email },
  })
  return { success: `Inbjudan skickad till ${email}. Medarbetaren skapar lösenord via länken.` }
}

/**
 * Edit a staff member's {title, active} by id, scoped to the tenant so a tampered
 * form can't touch another salon's staff. Mirrors updateTenantService: the
 * `.eq('id', staffId).eq('tenant_id', tenantId)` pair IS the security boundary.
 */
export async function updateTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const staffId = String(fd.get('staffId') ?? '')
  const title = String(fd.get('title') ?? '').trim().slice(0, 120)
  const active = fd.get('active') === 'on'

  if (!tenantId) return { error: 'Saknar kund.' }
  if (!staffId) return { error: 'Saknar medarbetare.' }
  if (!title) return { error: 'Ange ett namn/en titel.' }

  const { error } = await supabase
    .from('staff')
    .update({ title, active })
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('updateTenantStaff.update', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_update',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { title, active },
  })
  return { success: `Medarbetare "${title}" sparad.` }
}

/**
 * Set which services a staff member can perform (staff_services, inverse of
 * setServiceStaff). REPLACE semantics: the submitted `serviceId` set becomes the whole
 * set for this staff. THIS is what makes a behandlare selectable in the public booking's
 * "Hos vem?" step (boka/page.tsx builds the per-service staff list purely from
 * staff_services). Scoped to the tenant; each service_id verified to belong to the tenant.
 */
export async function setStaffServices(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const staffId = String(fd.get('staffId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!staffId) return { error: 'Saknar medarbetare.' }

  const { data: st } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!st) return { error: 'Medarbetaren finns inte.' }

  const submitted = fd.getAll('serviceId').map((v) => String(v)).filter(Boolean)
  const { data: validSvc } = await supabase.from('services').select('id').eq('tenant_id', tenantId)
  const allowed = new Set((validSvc ?? []).map((s) => s.id))
  const serviceIds = [...new Set(submitted)].filter((id) => allowed.has(id))

  const { error: delErr } = await supabase
    .from('staff_services')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
  if (delErr) {
    await reportActionError('setStaffServices.delete', delErr, { tenantId })
    return { error: GENERIC }
  }
  if (serviceIds.length > 0) {
    const rows = serviceIds.map((service_id) => ({ tenant_id: tenantId, service_id, staff_id: staffId }))
    const { error: insErr } = await supabase.from('staff_services').insert(rows)
    if (insErr) {
      await reportActionError('setStaffServices.insert', insErr, { tenantId })
      return { error: GENERIC }
    }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_staff_set',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { services: serviceIds.length },
  })
  return {
    success:
      serviceIds.length > 0
        ? `${serviceIds.length} tjänst(er) kopplade — medarbetaren går nu att välja i bokningen.`
        : 'Inga tjänster kopplade — medarbetaren kan inte bokas för någon tjänst än.',
  }
}

/**
 * SOFT remove a staff member: set active=false, scoped to the tenant. NOT a hard
 * delete — staff.id is FK'd by bookings/working_hours/staff_services (build-once-
 * never-delete), so deactivating is the safe, reversible act (re-activate via the
 * edit toggle). A deactivated staff drops out of the booking engine but their
 * history stays intact.
 */
export async function removeTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const staffId = String(fd.get('staffId') ?? '')

  if (!tenantId) return { error: 'Saknar kund.' }
  if (!staffId) return { error: 'Saknar medarbetare.' }

  const { error } = await supabase
    .from('staff')
    .update({ active: false })
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('removeTenantStaff.update', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_remove',
    tenantId,
    actorId: user.id,
    entityId: staffId,
  })
  return { success: 'Medarbetare inaktiverad (historik sparad).' }
}

/**
 * Set a staff member's WEEKLY schedule (working_hours). "Replace the staff's
 * schedule" model: DELETE the staff's existing rows (scoped tenant), then INSERT
 * one row per enabled weekday — idempotent, so re-submitting is safe.
 *
 * Field encoding (per weekday d in 0..6, DB semantics 0=Sunday..6=Saturday):
 *   open_${d}  checkbox · start_${d} / end_${d}  <input type="time"> ("HH:MM").
 *
 * SAFETY (the DELETE+INSERT is two round-trips, NOT one transaction): we parse and
 * validate ALL 7 rows FIRST and bail on the first invalid open row BEFORE touching
 * the DB — so a bad input never leaves the schedule half-wiped. location_id is
 * lifted from the staff row: migration 0022's staff↔location fence means a staff
 * member is only bookable where they have a working_hours row, so every inserted
 * row must carry the staff's location_id or bookability silently breaks. The
 * tenant-scoped staff read is ALSO the security check (rejects a tampered staffId
 * from another salon).
 */
export async function setStaffSchedule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const staffId = String(fd.get('staffId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!staffId) return { error: 'Saknar medarbetare.' }

  // Security + location source in one read: a staffId from another tenant fails the
  // .eq('tenant_id') filter → maybeSingle returns null → we bail.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('id, location_id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!staffRow) return { error: 'Medarbetaren finns inte hos den här kunden.' }

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
  // Front-load ALL validation before any DB write (no half-wiped schedule).
  const rows: {
    tenant_id: string
    staff_id: string
    weekday: number
    start_time: string
    end_time: string
    location_id: string | null
  }[] = []
  const SV = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
  for (let d = 0; d <= 6; d++) {
    if (fd.get(`open_${d}`) !== 'on') continue
    const start = String(fd.get(`start_${d}`) ?? '').trim()
    const end = String(fd.get(`end_${d}`) ?? '').trim()
    if (!HHMM.test(start) || !HHMM.test(end))
      return { error: `${SV[d]}: ange giltig start- och sluttid (HH:MM).` }
    // Zero-padded 24h → lexical compare matches chronological order (schema CHECK end>start).
    if (end <= start) return { error: `${SV[d]}: sluttid måste vara efter starttid.` }
    rows.push({
      tenant_id: tenantId,
      staff_id: staffId,
      weekday: d,
      start_time: start,
      end_time: end,
      location_id: staffRow.location_id ?? null,
    })
  }

  // Replace: clear the staff's existing week (scoped tenant), then insert the enabled
  // rows. Skip the insert entirely when the staff is closed all week (a legit state).
  const { error: delErr } = await supabase
    .from('working_hours')
    .delete()
    .eq('staff_id', staffId)
    .eq('tenant_id', tenantId)
  if (delErr) {
    await reportActionError('setStaffSchedule.delete', delErr, { tenantId })
    return { error: GENERIC }
  }
  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('working_hours').insert(rows)
    if (insErr) {
      await reportActionError('setStaffSchedule.insert', insErr, { tenantId })
      return { error: GENERIC }
    }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_schedule',
    tenantId,
    actorId: user.id,
    entityId: staffId,
    meta: { days: rows.length },
  })
  return {
    success:
      rows.length > 0
        ? `Schema sparat (${rows.length} dag${rows.length === 1 ? '' : 'ar'}).`
        : 'Schema sparat — stängt alla dagar.',
  }
}

/**
 * Manuellt skapa en kund-rad på en VALD salong (goal-22, audit nod #6). The
 * cross-tenant Kunder view is platform-only, so this is platform_admin-gated
 * (platformCtx) and validates the chosen tenant server-side — the client must NOT be
 * trusted to write an arbitrary tenant_id. The customers RLS WITH CHECK admits the
 * cross-tenant insert via is_platform_admin (0011 §6.1). A manual row deliberately
 * sets NO auth_user_id/contact_hash: it never fakes an auth identity, and a null
 * contact_hash dodges the partial unique index (0011: ...where contact_hash is not
 * null) so two manual rows never collide. The stable booking-mint path
 * (private.resolve_customer_id) still owns the hashed/identity columns.
 */
export async function createPlatformCustomer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const fullName = String(fd.get('full_name') ?? '').trim().slice(0, 120)
  const email = String(fd.get('email') ?? '').trim().toLowerCase().slice(0, 254) // RFC max
  const phone = String(fd.get('phone') ?? '').trim().slice(0, 40)

  if (!tenantId) return { error: 'Välj ett företag.' }
  if (!fullName) return { error: 'Ange kundens namn.' }
  if (email && !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }

  // Validate the chosen tenant server-side: must exist + be active. Never attach a
  // customer to a non-existent / deleted / suspended salon, and never trust the
  // client's tenant_id without this check.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Företaget finns inte.' }
  if (tenant.status !== 'active')
    return { error: 'Företaget är inte aktivt — kan inte lägga till kund.' }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      full_name: fullName,
      display_name: fullName,
      email: email || null,
      phone: phone || null,
      status: 'active',
    })
    .select('id')
    .single()
  if (error || !created) {
    await reportActionError('createPlatformCustomer.insert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath('/kunder')
  await logPlatformAction(supabase, {
    action: 'tenant.customer_create',
    tenantId,
    actorId: user.id,
    entityId: created.id,
    meta: { full_name: fullName, email: email || null },
  })
  return { success: `Kund "${fullName}" tillagd.` }
}
