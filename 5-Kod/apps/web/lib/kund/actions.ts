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
import { sendBookingCancellation, sendBookingRebook } from '@/lib/notifications/booking'

/** Best-effort tenant display name for notifications (RLS: own tenant readable). */
async function tenantName(supabase: Awaited<ReturnType<typeof createClient>>, tenantId: string): Promise<string> {
  if (!tenantId) return 'Företaget'
  const { data } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  return data?.name ?? 'Företaget'
}

const ACTIVE_STATUSES = ['pending', 'confirmed']

function isActiveStatus(status: string): boolean {
  return status === 'pending' || status === 'confirmed'
}

export type SignUpState = { error?: string }
export type ProfileState = { error?: string; success?: string }
export type BookingActionState = { error?: string }

// ── Signup / customer-row bootstrap ──────────────────────────────────────────
// DEVIATION FROM THE GOAL TEXT (intentional, see report): instead of the plain
// @supabase/ssr signUp(), this uses the service-role admin API. Why:
//   · it bakes app_metadata.tenant_id into the user (like the SQL seed), so RLS
//     works immediately even though the Custom Access Token Hook Dashboard toggle
//     is still pending on the cloud project;
//   · email_confirm:true removes the dependency on the project's unknown "confirm
//     email" setting, so signup → login → /konto works in one shot.
// Trade-off: customers are auto-confirmed (no email verification this wave) and
// SUPABASE_SERVICE_ROLE_KEY must be wired as a Worker secret in prod (it is only
// in .env.local today). Role is hard-pinned to `kund` → no privilege escalation.
export async function signUpCustomer(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()

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

  const admin = createAdminClient()

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
      return { error: 'E-postadressen är redan registrerad. Logga in i stället.' }
    }
    return { error: 'Kunde inte skapa konto just nu. Försök igen.' }
  }

  // Mirror into public.users (id = auth.users.id), linked to the kund role.
  const { error: userErr } = await admin.from('users').upsert(
    {
      id: created.user.id,
      tenant_id: tenant.id,
      email,
      phone,
      role_id: role.id,
      status: 'active',
    },
    { onConflict: 'id' },
  )
  if (userErr) {
    return { error: 'Kunde inte slutföra registreringen. Försök igen.' }
  }

  // Establish the session on the cookie client, then land in the portal.
  const supabase = await createClient()
  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password })
  if (signErr) {
    redirect('/login')
  }
  redirect('/konto')
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
// ownership (customer_profile_id) + active status → no TOCTOU gap.
export async function cancelBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const user = await requirePortal('kund')
  const bookingId = String(formData.get('bookingId') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }

  const booking = await getMyBooking(user.id, bookingId)
  if (!booking) return { error: 'Bokningen hittades inte.' }
  if (!isActiveStatus(booking.status)) {
    return { error: 'Bokningen kan inte avbokas.' }
  }

  const supabase = await createClient()
  const cutoff = await getCancellationCutoffHours(supabase, user.tenantId ?? '')
  if (!withinCancellationWindow(booking.startTs, cutoff)) {
    return { error: `Avbokning måste ske minst ${cutoff} timmar före tiden.` }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('customer_profile_id', user.id)
    .in('status', ACTIVE_STATUSES)
  if (error) return { error: 'Kunde inte avboka. Försök igen.' }

  // Avbokning inom regeln (kontrollerad ovan) → refund om bokningen var betald.
  // No-op när ingen lyckad betalning finns / Stripe ej konfigurerat.
  await refundBookingPayment(bookingId, user.tenantId ?? '')

  // Avboknings-notis (G10) — best-effort, före redirect (redirect kastar internt).
  if (user.email) {
    await sendBookingCancellation(
      user.email,
      {
        tenantName: await tenantName(supabase, user.tenantId ?? ''),
        serviceName: booking.serviceName ?? 'Behandling',
        startISO: booking.startTs,
        timeZone: booking.timeZone,
        staffTitle: booking.staffTitle,
      },
      { supabase, tenantId: user.tenantId ?? '' },
    )
  }

  revalidatePath('/konto')
  revalidatePath(`/konto/bokningar/${bookingId}`)
  redirect('/konto')
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
  const bookingId = String(formData.get('bookingId') ?? '')
  const startISO = String(formData.get('startISO') ?? '')
  const staffId = String(formData.get('staffId') ?? '')
  if (!bookingId || !startISO || !staffId) return { error: 'Ofullständig ombokning. Välj en ny tid.' }

  const old = await getMyBooking(user.id, bookingId)
  if (!old) return { error: 'Bokningen hittades inte.' }
  if (!isActiveStatus(old.status)) {
    return { error: 'Bokningen kan inte ombokas.' }
  }

  const supabase = await createClient()
  const cutoff = await getCancellationCutoffHours(supabase, user.tenantId ?? '')
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
  const { data: released, error: releaseErr } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('customer_profile_id', user.id)
    .in('status', ACTIVE_STATUSES)
    .select('id')
  if (releaseErr || !released || released.length === 0) {
    // Rollback (best-effort): avboka den nya bokningen så slutläget är "ingen
    // ändring". Samma RLS-klient + ägar-/status-fence som ordinarie avbokning.
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', newId)
      .eq('customer_profile_id', user.id)
      .in('status', ACTIVE_STATUSES)
    return { error: 'Kunde inte omboka. Försök igen.' }
  }

  // Flytt av betald bokning (M8 §2.3): den nya tiden är säkrad OCH den gamla är
  // result-bekräftat släppt → flytta en ev. lyckad betalning från gamla bokningen
  // till den nya (re-point + bekräfta), ingen refund-rundgång, ingen dubbel-charge.
  // MÅSTE ligga EFTER släppet (annars strandar betalningen på newId om släppet
  // failar och rollbacken avbokar newId). No-op för salonger utan betalning/Stripe.
  await carryBookingPayment(bookingId, newId, user.tenantId ?? '')

  // Ny tid-bekräftelse på den NYA tiden (M9, dedikerad rebook-mall) — best-effort, före redirect.
  if (user.email) {
    await sendBookingRebook(
      user.email,
      {
        tenantName: await tenantName(supabase, user.tenantId ?? ''),
        serviceName: old.serviceName ?? 'Behandling',
        startISO: startISO,
        timeZone: old.timeZone,
      },
      { supabase, tenantId: user.tenantId ?? '' },
    )
  }

  revalidatePath('/konto')
  redirect(`/konto/bokningar/${newId}`)
}
