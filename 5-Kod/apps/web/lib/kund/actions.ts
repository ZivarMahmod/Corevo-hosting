'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { createAdminClient } from './admin'
import { currentKundTenant } from './tenant'
import { getMyBooking } from './bookings'
import { getCancellationCutoffHours, withinCancellationWindow } from './settings'
import { refundBookingPayment } from '@/lib/stripe/refund'
import { carryBookingPayment } from '@/lib/stripe/rebook-payment'
import { queueBookingEvent } from '@/lib/notifications/booking-events'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import {
  customerClaimTokenFromPath,
  hashCustomerClaimToken,
  isCustomerClaimPath,
} from './customer-claim'
import {
  consumeCustomerClaim,
  inspectCustomerClaim,
  reconcileCustomerClaim,
} from './customer-claim-server'

const ACTIVE_STATUSES = ['pending', 'confirmed']

function isActiveStatus(status: string): boolean {
  return status === 'pending' || status === 'confirmed'
}

export type SignUpState = { error?: string }
export type ProfileState = { error?: string; success?: string }
export type BookingActionState = { error?: string }

type KundClient = Awaited<ReturnType<typeof createClient>>
type KundAdmin = ReturnType<typeof createAdminClient>
type ClaimCompletion = { ok: true } | { ok: false; error: string }

/**
 * Hygiene only: `pending_claim` is already denied by every normal portal/RLS
 * fence. Delete auth only if the conditional delete proves the profile was
 * still provisional. The claim RPC locks the same row, so a concurrent winner
 * activates first and makes this delete a no-op instead of being erased.
 */
async function cleanupProvisionalClaimAccount(args: {
  admin: KundAdmin
  supabase: KundClient
  userId: string
  tenantId: string
}): Promise<void> {
  const { admin, supabase, userId, tenantId } = args
  await supabase.auth.signOut()
  const { data: removedProfile, error: profileDeleteError } = await admin
    .from('users')
    .delete()
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending_claim')
    .select('id')
    .maybeSingle()
  if (profileDeleteError) return
  if (!removedProfile?.id) return

  // If this best-effort delete fails, the remaining auth shell has no profile,
  // role or portal access. The authenticated recovery path can recreate the
  // provisional profile for the same tenant and valid claim.
  await admin.auth.admin.deleteUser(userId)
}

async function consumeOrReconcileCustomerClaim(args: {
  admin: KundAdmin
  supabase: KundClient
  tenantId: string
  tokenHash: string
  userId: string
  wasProvisional: boolean
}): Promise<ClaimCompletion> {
  const claim = await consumeCustomerClaim({
    client: args.supabase,
    tenantId: args.tenantId,
    tokenHash: args.tokenHash,
  })
  if (claim.ok) return { ok: true }

  // Reconcile against the exact consumed digest + used_by + bound customer.
  // This cannot mistake a pre-existing customer card for this claim's commit.
  const reconciled = await reconcileCustomerClaim({
    tenantId: args.tenantId,
    tokenHash: args.tokenHash,
    authUserId: args.userId,
  })
  if (reconciled.ok && reconciled.claimed) return { ok: true }
  if (!reconciled.ok) {
    // Unknown external state: never delete. The account is either still
    // provisional (no access) or atomically activated by the committed claim.
    return { error: 'Kunde inte verifiera kontolänken. Försök igen.', ok: false }
  }

  if (args.wasProvisional) {
    await cleanupProvisionalClaimAccount(args)
  }
  return {
    error: 'Kontolänken kunde inte användas. Be företaget om en ny länk.',
    ok: false,
  }
}

/** Authenticate and resume a shell left by an interrupted earlier signup. */
async function recoverExistingClaimAccount(args: {
  admin: KundAdmin
  supabase: KundClient
  tenantId: string
  roleId: string
  email: string
  phone: string
  password: string
  tokenHash: string
}): Promise<ClaimCompletion> {
  const { data: signedIn, error: signInError } = await args.supabase.auth.signInWithPassword({
    email: args.email,
    password: args.password,
  })
  if (signInError || !signedIn.user) {
    return { error: 'E-postadressen finns redan. Logga in med rätt lösenord.', ok: false }
  }

  const authTenantId = (signedIn.user.app_metadata as { tenant_id?: string }).tenant_id
  if (authTenantId !== args.tenantId) {
    await args.supabase.auth.signOut()
    return {
      error: 'Kontot hör till ett annat företag och kan inte kopplas här ännu.',
      ok: false,
    }
  }

  const { data: existingProfile, error: profileError } = await args.admin
    .from('users')
    .select('id, tenant_id, role_id, status')
    .eq('id', signedIn.user.id)
    .maybeSingle()
  if (profileError) {
    return { error: 'Kunde inte kontrollera kontot. Försök igen.', ok: false }
  }

  let profile = existingProfile
  if (!profile) {
    const { data: recoveredProfile, error: recoverError } = await args.admin
      .from('users')
      .insert({
        id: signedIn.user.id,
        tenant_id: args.tenantId,
        email: args.email,
        phone: args.phone,
        role_id: args.roleId,
        status: 'pending_claim',
      })
      .select('id, tenant_id, role_id, status')
      .single()
    if (recoverError) {
      return { error: 'Kunde inte återställa kontot. Försök igen.', ok: false }
    }
    profile = recoveredProfile
  }

  const exactCustomerProfile =
    profile.tenant_id === args.tenantId &&
    profile.role_id === args.roleId &&
    (profile.status === 'pending_claim' || profile.status === 'active')
  if (!exactCustomerProfile) {
    await args.supabase.auth.signOut()
    return { error: 'Kontot kan inte aktiveras från den här länken.', ok: false }
  }

  return consumeOrReconcileCustomerClaim({
    admin: args.admin,
    supabase: args.supabase,
    tenantId: args.tenantId,
    tokenHash: args.tokenHash,
    userId: signedIn.user.id,
    wasProvisional: profile.status === 'pending_claim',
  })
}

// ── Signup / customer-row bootstrap ──────────────────────────────────────────
// Claim-gated signup uses the service-role admin API instead of open
// @supabase/ssr signUp(). Why:
//   · it bakes app_metadata.tenant_id into the user (like the SQL seed), so RLS
//     works immediately even though the Custom Access Token Hook Dashboard toggle
//     is still pending on the cloud project;
//   · the high-entropy, expiring booking claim is the required proof; open
//     registration without that claim is disabled;
//   · email_confirm:true then lets the claim complete in one session.
// SUPABASE_SERVICE_ROLE_KEY stays server-only. Role is hard-pinned to `kund` and
// the claim RPC independently re-checks auth.uid + JWT tenant + database role.
export async function signUpCustomer(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const next = safeInternalRedirectPath(String(formData.get('next') ?? ''))

  if (!email || !password || !name || !phone) {
    return { error: 'Fyll i namn, e-post, telefon och lösenord.' }
  }
  if (password.length < 8) {
    return { error: 'Lösenordet måste vara minst 8 tecken.' }
  }

  const tenant = await currentKundTenant()
  if (!tenant) {
    return { error: 'Registrering sker via företagets egen sida. Öppna företagets adress och försök igen.' }
  }

  // Open signup is intentionally disabled for the pilot. Possession of a still
  // valid, tenant-bound claim is required before we create a global auth user.
  if (!isCustomerClaimPath(next)) {
    return { error: 'Skapa kontot från den säkra länken i din bokningsbekräftelse.' }
  }
  const claimToken = customerClaimTokenFromPath(next)
  if (!claimToken || !(await inspectCustomerClaim({ tenantId: tenant.id, token: claimToken }))) {
    return { error: 'Kontolänken är ogiltig, har gått ut eller har redan använts.' }
  }
  const tokenHash = await hashCustomerClaimToken(claimToken)

  const admin = createAdminClient()
  const supabase = await createClient()

  // Ensure a `kund` role (level 2) exists for this tenant (the seed ships none).
  const { data: role, error: roleErr } = await admin
    .from('roles')
    .upsert({ tenant_id: tenant.id, name: 'kund', level: 2 }, { onConflict: 'tenant_id,name' })
    .select('id')
    .single()
  if (roleErr || !role) {
    return { error: 'Kunde inte skapa konto just nu. Försök igen.' }
  }

  // Create the auth user with the tenant baked into app_metadata + auto-confirmed.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenant.id, platform_admin: false },
    user_metadata: { full_name: name },
  })
  if (createErr || !created.user) {
    const msg = createErr?.message ?? ''
    if (/registered|already|exists/i.test(msg)) {
      const recovered = await recoverExistingClaimAccount({
        admin,
        supabase,
        tenantId: tenant.id,
        roleId: role.id,
        email,
        phone,
        password,
        tokenHash,
      })
      if (recovered.ok) redirect('/konto?kopplad=1')
      return { error: recovered.error }
    }
    return { error: 'Kunde inte skapa konto just nu. Försök igen.' }
  }

  // Mirror into public.users (id = auth.users.id), linked to the kund role.
  const { error: userErr } = await admin.from('users').insert({
    id: created.user.id,
    tenant_id: tenant.id,
    email,
    phone,
    role_id: role.id,
    status: 'pending_claim',
  })
  if (userErr) {
    // Avoid a global orphan auth account if the tenant profile could not be
    // created. The claim remains unused and can safely be retried.
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: 'Kunde inte slutföra registreringen. Försök igen.' }
  }

  // Establish the session on the cookie client, then land in the portal.
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signErr) {
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const completion = await consumeOrReconcileCustomerClaim({
    admin,
    supabase,
    tenantId: tenant.id,
    tokenHash,
    userId: created.user.id,
    wasProvisional: true,
  })
  if (!completion.ok) return { error: completion.error }

  redirect('/konto?kopplad=1')
}

// ── Profile (name + phone; email is read-only) ───────────────────────────────
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requirePortal('kund')
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()

  if (!name) return { error: 'Namn får inte vara tomt.' }

  const supabase = await createClient()
  const { error: metaErr } = await supabase.auth.updateUser({ data: { full_name: name } })
  if (metaErr) return { error: 'Kunde inte spara profilen. Försök igen.' }

  const { error: phoneErr } = await supabase.from('users').update({ phone }).eq('id', user.id)
  if (phoneErr) return { error: 'Kunde inte spara telefonnummret. Försök igen.' }

  revalidatePath('/konto/profil')
  return { success: 'Profilen är sparad.' }
}

// ── Cancel ───────────────────────────────────────────────────────────────────
// Sets status='cancelled', which frees the slot (the no_double_booking EXCLUDE
// only blocks pending/confirmed/completed). The UPDATE itself re-asserts
// ownership (legacy profile OR claimed customer relation) + tenant + active
// status → no TOCTOU gap.
export async function cancelBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId
  if (!tenantId) return { error: 'Kontot saknar företagskoppling.' }
  const bookingId = String(formData.get('bookingId') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }

  const booking = await getMyBooking(user.id, tenantId, bookingId)
  if (!booking) return { error: 'Bokningen hittades inte.' }
  if (!isActiveStatus(booking.status)) {
    return { error: 'Bokningen kan inte avbokas.' }
  }

  const supabase = await createClient()
  const cutoff = await getCancellationCutoffHours(supabase, tenantId)
  if (!withinCancellationWindow(booking.startTs, cutoff)) {
    return { error: `Avbokning måste ske minst ${cutoff} timmar före tiden.` }
  }

  // Kundsessionen har ingen rå UPDATE-policy på bookings. Den privilegierade
  // skrivningen sker först efter ägarskap + cutoff ovan, på servern.
  const admin = createAdminClient()
  const cancelledAt = new Date().toISOString()
  const { error } = await admin
    .from('bookings')
    // cancelled_by: 'customer' — salongens ångralogg ska kunna svara "kunden avbokade
    // själv" utan att gissa. Skriver vi bara status här blir loggen en lista över
    // avbokningar utan avsändare, och då är den värdelös just när den behövs.
    .update({ status: 'cancelled', cancelled_at: cancelledAt, cancelled_by: 'customer' })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .or(
      booking.customerId
        ? `customer_profile_id.eq.${user.id},customer_id.eq.${booking.customerId}`
        : `customer_profile_id.eq.${user.id}`,
    )
    .in('status', ACTIVE_STATUSES)
  if (error) return { error: 'Kunde inte avboka. Försök igen.' }

  // Avbokning inom regeln (kontrollerad ovan) → refund om bokningen var betald.
  // No-op när ingen lyckad betalning finns / Stripe ej konfigurerat.
  await refundBookingPayment(bookingId, tenantId)

  const notification = await queueBookingEvent({
    tenantId,
    bookingId,
    type: 'booking_cancelled',
    occurredAt: cancelledAt,
    startISO: booking.startTs,
  })

  revalidatePath('/konto')
  revalidatePath(`/konto/bokningar/${bookingId}`)
  redirect(`/konto?notis=${notification.state}`)
}

// ── Rebook (same service, new time) ──────────────────────────────────────────
// Reuses the G04 create_public_booking RPC (conflict logic lives in the RPC +
// the DB EXCLUDE constraint — never duplicated here). Order matters: create the
// NEW booking first; only cancel the OLD one once the new slot is secured, so a
// lost race (23P01) leaves the original booking intact.
// Steg 2 (släpp gamla bokningen) är result-kontrollerad: om den misslyckas eller
// träffar 0 rader kompenserar vi genom att avboka den NYSS skapade bokningen, så
// kunden aldrig kan hålla två aktiva bokningar samtidigt.
export async function rebookBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requirePortal('kund')
  const tenantId = user.tenantId
  if (!tenantId) return { error: 'Kontot saknar företagskoppling.' }
  const bookingId = String(formData.get('bookingId') ?? '')
  const startISO = String(formData.get('startISO') ?? '')
  const staffId = String(formData.get('staffId') ?? '')
  if (!bookingId || !startISO || !staffId) return { error: 'Ofullständig ombokning. Välj en ny tid.' }

  const old = await getMyBooking(user.id, tenantId, bookingId)
  if (!old) return { error: 'Bokningen hittades inte.' }
  if (!isActiveStatus(old.status)) {
    return { error: 'Bokningen kan inte ombokas.' }
  }

  const supabase = await createClient()

  // Självbokningsspärr (B-25): salongen kan stänga av en kunds onlinebokning.
  // RLS släpper kundens EGEN rad (auth_user_id = uid), så läsningen fungerar här.
  // Saknas raden är kunden oflaggad → tillåten (default self_book = true).
  // ponytail: vakten täcker inloggade kundflöden. En gäst som bokar med ny e-post
  // går förbi — det gör hen oavsett spärr (ny identitet). DB-nivå vore create_public_
  // booking-RPC:n; byggs den dagen någon faktiskt kringgår detta.
  const { data: me } = await supabase
    .from('customers')
    .select('self_book')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (me?.self_book === false) {
    return { error: 'Onlinebokning är avstängd för ditt konto. Ring oss så bokar vi åt dig.' }
  }

  const cutoff = await getCancellationCutoffHours(supabase, tenantId)
  if (!withinCancellationWindow(old.startTs, cutoff)) {
    return { error: `Ombokning måste ske minst ${cutoff} timmar före tiden.` }
  }

  const tenant = await currentKundTenant()
  if (!tenant) return { error: 'Okänt företag.' }

  // 1) Secure the new slot (reused RPC; lets the EXCLUDE raise 23P01 on a race).
  const { data: newId, error: createErr } = await supabase.rpc('create_public_booking', {
    p_tenant_slug: tenant.slug,
    p_service: old.serviceId,
    p_staff: staffId,
    p_start: startISO,
    p_customer: user.id,
    p_note: old.note ?? undefined,
  })
  if (createErr || !newId) {
    if (createErr?.code === '23P01') return { error: 'Tiden togs precis. Välj en annan tid.' }
    return { error: 'Kunde inte omboka. Försök igen.' }
  }

  // 2) New slot secured → release the old one. Result-kontrollerad: .select('id')
  // ger tillbaka de uppdaterade raderna (RLS låter kunden läsa egna rader). Fel
  // eller 0 rader = den gamla bokningen släpptes ALDRIG → kompensera genom att
  // avboka den nyss skapade, annars hänger kunden på två aktiva bokningar.
  const admin = createAdminClient()
  const { data: released, error: releaseErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'customer',
    })
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .or(
      old.customerId
        ? `customer_profile_id.eq.${user.id},customer_id.eq.${old.customerId}`
        : `customer_profile_id.eq.${user.id}`,
    )
    .in('status', ACTIVE_STATUSES)
    .select('id')
  if (releaseErr || !released || released.length === 0) {
    // Rollback (best-effort): avboka den nya bokningen så slutläget är "ingen
    // ändring". Samma RLS-klient + ägar-/status-fence som ordinarie avbokning.
    await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'customer',
      })
      .eq('id', newId)
      .eq('tenant_id', tenantId)
      .eq('customer_profile_id', user.id)
      .in('status', ACTIVE_STATUSES)
    return { error: 'Kunde inte omboka. Försök igen.' }
  }

  // Flytt av betald bokning (M8 §2.3): den nya tiden är säkrad OCH den gamla är
  // result-bekräftat släppt → flytta en ev. lyckad betalning från gamla bokningen
  // till den nya (re-point + bekräfta), ingen refund-rundgång, ingen dubbel-charge.
  // MÅSTE ligga EFTER släppet (annars strandar betalningen på newId om släppet
  // failar och rollbacken avbokar newId). No-op för salonger utan betalning/Stripe.
  await carryBookingPayment(bookingId, newId, tenantId)

  const notification = await queueBookingEvent({
    tenantId,
    bookingId: newId,
    type: 'booking_rebooked',
    occurredAt: new Date().toISOString(),
    startISO,
    includeManageLink: true,
  })

  revalidatePath('/konto')
  redirect(`/konto/bokningar/${newId}?notis=${notification.state}`)
}
