'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { createServiceClient } from '../service'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC, EMAIL_RE } from './shared'
import { reportActionError } from './observe'
import { provisionStaffInvite } from '@/lib/auth/staff-invite-service'
import { revalidateTenantById } from '@/lib/admin/tenant'

export type PlatformCustomerContactResult =
  | {
      ok: true
      contact: { email: string | null; phone: string | null }
      expiresAt: string
    }
  | { ok: false; error: string }

/**
 * Lazy platform reveal for customer contact PII. The initial page models never
 * contain raw contact fields; an explicit click reaches this action instead.
 * platformCtx is the role gate, the tenant-scoped customer read rejects a
 * tampered customer/tenant pair, and get_customer_contact remains authoritative
 * for the operational booking window. Audit is fail-closed: no successful audit,
 * no contact leaves the server.
 */
export async function revealPlatformCustomerContact(input: {
  customerId: string
  tenantId: string
}): Promise<PlatformCustomerContactResult> {
  const { user, supabase } = await platformCtx()
  const customerId = String(input.customerId ?? '').trim()
  const tenantId = String(input.tenantId ?? '').trim()
  if (!customerId || !tenantId) {
    return { ok: false, error: 'Saknar kund eller företag.' }
  }

  const { data: customers, error: relationshipError } = await supabase
    .rpc('platform_customer_safe_rows', {
      p_tenant: tenantId,
      p_customer: customerId,
      p_limit: 1,
    })
  if (relationshipError) {
    await reportActionError('revealPlatformCustomerContact.relationship', relationshipError, {
      tenantId,
      customerId,
    })
    return { ok: false, error: 'Kontaktuppgifterna kunde inte hämtas. Försök igen.' }
  }
  if (!customers?.[0]) return { ok: false, error: 'Kunden finns inte hos det här företaget.' }

  const { data, error: rpcError } = await supabase.rpc('get_customer_contact', {
    p_customer: customerId,
  })
  if (rpcError || !data || data.length === 0) {
    await reportActionError('revealPlatformCustomerContact.rpc', rpcError, {
      tenantId,
      customerId,
    })
    return { ok: false, error: 'Kontaktuppgifterna kunde inte hämtas. Försök igen.' }
  }

  const row = data[0]
  if (!row?.pii_visible) {
    return {
      ok: false,
      error: 'Kontaktuppgifterna är inte tillgängliga utanför driftfönstret.',
    }
  }
  if (!row.email && !row.phone) {
    return { ok: false, error: 'Kunden saknar kontaktuppgifter.' }
  }

  const audit = await logPlatformAction(supabase, {
    action: 'tenant.customer_pii_reveal',
    tenantId,
    actorId: user.id,
    entityId: customerId,
  })
  if (!audit.ok) {
    await reportActionError('revealPlatformCustomerContact.audit', new Error('audit_write_failed'), {
      tenantId,
      customerId,
    })
    return {
      ok: false,
      error: 'Kontaktuppgifterna kunde inte loggas och visas därför inte.',
    }
  }

  return {
    ok: true,
    contact: { email: row.email, phone: row.phone },
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  }
}

/**
 * Trigger a password reset for the salon's admin. Generates a recovery link via
 * the service role and surfaces it for Zivar to hand over (no cross-revir email
 * wiring in v1). The nullable service client degrades with a clear ops message
 * when SUPABASE_SERVICE_ROLE_KEY is unset, never throws.
 */
export async function sendPasswordReset(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const email = String(fd.get('email') ?? '')
    .trim()
    .toLowerCase()
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ogiltig e-postadress.' }

  // Resolve the exact active account through the scoped cookie client before
  // service-role Auth can generate anything. A foreign partner tenant is hidden
  // by RLS and therefore fails here without an external side effect.
  const { data: account, error: accountError } = await supabase
    .from('users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle()
  if (accountError || !account) {
    return { error: 'Inget aktivt konto med den e-postadressen finns hos kunden.' }
  }

  const svc = createServiceClient()
  if (!svc) return { error: 'Lösenords-reset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).' }

  const { data, error } = await svc.auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.action_link) {
    await reportActionError('sendPasswordReset.generateLink', error, { tenantId })
    return { error: `Kunde inte skapa återställningslänk: ${error?.message ?? 'okänt fel'}.` }
  }

  // Auth is an external boundary. Reassert the exact scoped account before the
  // privileged recovery URL is returned; a concurrent root tenant move must make
  // the old partner fail closed.
  const { data: reassertedAccount, error: reassertError } = await supabase
    .from('users')
    .select('id')
    .eq('id', account.id)
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle()
  if (reassertError || !reassertedAccount) {
    return { error: 'Kundåtkomsten ändrades under återställningen. Länken lämnas inte ut.' }
  }

  const audit = await logPlatformAction(supabase, {
    action: 'tenant.password_reset',
    tenantId,
    actorId: user.id,
  })
  if (!audit.ok) {
    await reportActionError('sendPasswordReset.audit', new Error('audit_write_failed'), { tenantId })
  }
  return {
    success: `Återställningslänk skapad för ${email}. Kopiera och dela den säkert:\n${data.properties.action_link}`,
    ...(!audit.ok ? {
      warning: 'Länken skapades, men auditloggen kunde inte skrivas. Logga incidenten manuellt innan länken delas.',
    } : {}),
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
    active: false,
  })
  if (error) {
    await reportActionError('createTenantStaff.insert', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
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
 * The nullable service client degrades with a clear message when
 * SUPABASE_SERVICE_ROLE_KEY is unset. Role/users writes happen only through the
 * shared provisioning coordinator.
 */
export async function inviteTenantStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()
  const tenantId = String(fd.get('tenantId') ?? '')
  const email = String(fd.get('email') ?? '')
    .trim()
    .toLowerCase()
  const title = String(fd.get('title') ?? '').trim()
  const staffId = String(fd.get('staffId') ?? '').trim() // optional: link an existing staff row
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!email || !EMAIL_RE.test(email)) return { error: 'Ange en giltig e-postadress.' }

  const svc = createServiceClient()
  if (!svc) {
    return {
      error:
        'Inbjudan kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops). Lägg till utan konto under tiden.',
    }
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Kunden finns inte.' }

  const result = await provisionStaffInvite({
    service: svc,
    accountClient: supabase,
    tenantId,
    email,
    ...(staffId ? { targetStaffId: staffId } : {}),
    createStaff: async (authId) => {
      if (staffId) {
        const { data: linked, error } = await supabase
          .from('staff')
          .update({ profile_id: authId })
          .eq('id', staffId)
          .eq('tenant_id', tenantId)
          .is('profile_id', null)
          .select('id')
          .maybeSingle()
        return { error: error ?? (linked ? null : new Error('staff_link_not_committed')) }
      }

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
        profile_id: authId,
        title: title || email,
        active: false,
      })
      return { error }
    },
    reportIncident: async (event) => {
      await reportActionError(`inviteTenantStaff.${event.stage}`, new Error(event.stage), {
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

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.staff_invite',
    tenantId,
    actorId: user.id,
    entityId: staffId || undefined,
    meta: { inviteSent: result.inviteSent },
  })
  return {
    success: result.inviteSent
      ? `Inbjudan skickad till ${email}. Medarbetaren skapar lösenord via länken.`
      : `Kontot fanns redan och kopplades till ${email}. Använd Glömt lösenord om en ny länk behövs.`,
  }
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
  const title = String(fd.get('title') ?? '')
    .trim()
    .slice(0, 120)
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
  revalidatePath(`/kunder/${tenantId}`)
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
  const { supabase } = await platformCtx()
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

  const submitted = fd
    .getAll('serviceId')
    .map((v) => String(v))
    .filter(Boolean)
  const { data: validSvc } = await supabase.from('services').select('id').eq('tenant_id', tenantId)
  const allowed = new Set((validSvc ?? []).map((s) => s.id))
  const serviceIds = [...new Set(submitted)].filter((id) => allowed.has(id))

  const { error } = await supabase.rpc('platform_replace_staff_services', {
    p_tenant: tenantId,
    p_staff: staffId,
    p_service_ids: serviceIds,
  })
  if (error) {
    await reportActionError('setStaffServices.replace', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
  return {
    success:
      serviceIds.length > 0
        ? `${serviceIds.length} tjänst(er) kopplade — medarbetaren går nu att välja i bokningen.`
        : 'Inga tjänster kopplade — medarbetaren kan inte bokas för någon tjänst än.',
  }
}

/**
 * SOFT remove a staff member: set active=false, scoped to the tenant. NOT a hard
 * delete — staff.id is FK'd by bookings/working_hours/staff_services, so deactivating
 * preserves referential history and is reversible (re-activate via the
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
  revalidatePath(`/kunder/${tenantId}`)
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
 * SAFETY: all rows are validated before one atomic DB replace RPC. The RPC derives
 * location_id from the tenant-scoped staff row and applies DELETE+INSERT inside one
 * transaction, so readiness checks never observe a half-wiped schedule.
 */
export async function setStaffSchedule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const staffId = String(fd.get('staffId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!staffId) return { error: 'Saknar medarbetare.' }

  // Security check: a staffId from another tenant fails the
  // .eq('tenant_id') filter → maybeSingle returns null → we bail.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!staffRow) return { error: 'Medarbetaren finns inte hos den här kunden.' }

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
  // Front-load ALL validation before any DB write (no half-wiped schedule).
  const rows: {
    weekday: number
    start_time: string
    end_time: string
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
      weekday: d,
      start_time: start,
      end_time: end,
    })
  }

  const { error } = await supabase.rpc('platform_replace_staff_schedule', {
    p_tenant: tenantId,
    p_staff: staffId,
    p_rows: rows.map(({ weekday, start_time, end_time }) => ({
      weekday,
      start_time,
      end_time,
    })),
  })
  if (error) {
    await reportActionError('setStaffSchedule.replace', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: personal syns i bokningsflöde/team — busta `tenant:<slug>`.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/kunder/${tenantId}`)
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
  const { supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const fullName = String(fd.get('full_name') ?? '')
    .trim()
    .slice(0, 120)
  const email = String(fd.get('email') ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 254) // RFC max
  const phone = String(fd.get('phone') ?? '')
    .trim()
    .slice(0, 40)

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

  const { data: created, error } = await supabase.rpc('platform_create_customer', {
    p_tenant: tenantId,
    p_full_name: fullName,
    p_email: email || undefined,
    p_phone: phone || undefined,
  })
  if (error || !created) {
    await reportActionError('createPlatformCustomer.insert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath('/slutkunder')
  return { success: `Kund "${fullName}" tillagd.` }
}
