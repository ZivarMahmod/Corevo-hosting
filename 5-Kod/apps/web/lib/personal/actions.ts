'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { sendReviewNudgeForBooking } from '@/lib/notifications/google-review'
import { refundBookingPayment } from '@/lib/stripe/refund'
import { getMyStaff } from './staff'
import {
  getCustomerCard,
  getCustomerNotes,
  type CustomerCard,
  type CustomerNotes,
} from './customer'
import { createAdminServiceClient } from '@/lib/admin/service'

export type ActionState = { error?: string; success?: string }

const NO_PROFILE = 'Ingen personalprofil är kopplad till ditt konto. Kontakta din administratör.'
const ACTIVE_STATUSES = ['pending', 'confirmed'] as const

// Allowed enum values for the structured client-card fields. Kept in lock-step with
// the CHECK constraints in migration 0011 — an upsert with a value outside these
// sets is rejected by the DB, so we validate here for a clean inline error.
const HAIR_TYPES = new Set(['rakt', 'vågigt', 'lockigt', 'afro'])
const HAIR_LENGTHS = new Set(['kort', 'medel', 'långt'])
const SENSITIVITIES = new Set(['normal', 'känslig hårbotten', 'känslig hud'])

// ── Booking status: completed / no_show ──────────────────────────────────────
// staff_id is constrained to the caller's OWN staff ids (server-resolved) +
// status to active, so a staff can never mutate a colleague's or another
// tenant's booking. completed keeps the slot blocked; no_show frees it (the
// no_double_booking EXCLUDE excludes no_show).
export async function setBookingStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePortal('personal')
  const bookingId = String(formData.get('bookingId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }
  if (status !== 'completed' && status !== 'no_show') return { error: 'Ogiltig status.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }
  const myStaffIds = staff.map((s) => s.id)

  const supabase = await createClient()
  const nowIso = new Date().toISOString()
  const { data: current } = await supabase
    .from('bookings')
    .select('id, start_ts')
    .eq('id', bookingId)
    .eq('tenant_id', user.tenantId ?? '')
    .in('staff_id', myStaffIds)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle()
  if (!current) return { error: 'Bokningen kan inte ändras längre.' }
  if (
    (status === 'completed' || status === 'no_show') &&
    new Date(current.start_ts).getTime() > Date.now()
  ) {
    return { error: 'Tiden har inte börjat än.' }
  }

  const writer = createAdminServiceClient()
  if (!writer) return { error: 'Bokningsändringar är inte tillgängliga just nu.' }
  const { data: updated, error } = await writer
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .eq('tenant_id', user.tenantId ?? '')
    .in('staff_id', myStaffIds)
    .in('status', ['pending', 'confirmed'])
    .lte('start_ts', nowIso)
    .select('id')
  if (error) return { error: 'Kunde inte spara statusen. Försök igen.' }
  if (!updated || updated.length === 0) return { error: 'Bokningen kan inte ändras längre.' }

  // Visit done → nudge the customer for a Google review (M9). Best-effort: the
  // helper never throws, so a mail hiccup can't fail the status the staff just set.
  if (status === 'completed') await sendReviewNudgeForBooking(supabase, bookingId)

  revalidatePath('/personal')
  return { success: 'Status sparad.' }
}

// NOTE: the frisör's self-edit of the working-hours BASELINE (addWorkingHours /
// deleteWorkingHours) was retired here (M5 §2.1). The bookable baseline is now
// owner-authority (M6, working_hour_slots); /personal/arbetstider is read-only.
// The frisör keeps the OPERATIVE actions below: completed/no-show, walk-in,
// rebook, cancel, own time-off.

// ── Walk-in / drop-in (own staff_id) ─────────────────────────────────────────
// The frisör logs a customer who walked in. Direct authenticated insert (staff is
// role_level >= 3 → bookings_staff_insert lets them write in their own tenant). The
// no_double_booking EXCLUDE is the only conflict guard — a 23P01 means the slot is
// already taken. staff_id is pinned to the caller's OWN id (never a colleague's).
// No customer row is created (customer_id stays null); an optional name rides the
// note as the "Gäst: …" seam so the existing label path renders it.
export async function createWalkIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const serviceId = String(formData.get('serviceId') ?? '')
  const startLocal = String(formData.get('start') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!serviceId) return { error: 'Välj en tjänst.' }
  if (!startLocal) return { error: 'Ange en starttid.' }

  const me = (await getMyStaff(user.id))[0]
  if (!me) return { error: NO_PROFILE }
  // bookings.location_id is NOT NULL — a walk-in is anchored to the staff's own
  // location (the public booking RPC sets this for normal bookings). No location
  // link → can't place the row, so surface it rather than insert a bad row.
  if (!me.locationId)
    return { error: 'Din profil saknar en kopplad plats. Kontakta din administratör.' }

  const supabase = await createClient()

  // Service must belong to this tenant; its duration sets the booking length.
  const { data: service } = await supabase
    .from('services')
    .select('duration_min, price_cents')
    .eq('id', serviceId)
    .eq('tenant_id', user.tenantId ?? '')
    .eq('active', true)
    .maybeSingle()
  if (!service) return { error: 'Tjänsten hittades inte.' }

  const startUtc = localToUtc(startLocal, me.timeZone)
  if (!startUtc) return { error: 'Ogiltig starttid.' }
  const endUtc = new Date(startUtc.getTime() + service.duration_min * 60_000)

  const note = name ? `Gäst: ${name} <> ` : null

  const { error } = await supabase.from('bookings').insert({
    tenant_id: user.tenantId ?? '',
    location_id: me.locationId,
    staff_id: me.id,
    service_id: serviceId,
    start_ts: startUtc.toISOString(),
    end_ts: endUtc.toISOString(),
    status: 'confirmed',
    price_cents: service.price_cents,
    note,
  })
  if (error) {
    if (error.code === '23P01')
      return { error: 'Tiden krockar med en annan bokning. Välj en annan tid.' }
    return { error: 'Kunde inte lägga in besöket. Försök igen.' }
  }

  revalidatePath('/personal')
  return { success: 'Walk-in inlagd.' }
}

// ── Rebook (own booking, same staff + service, new time) ─────────────────────
// Server-privileged UPDATE of start/end after the staff's OWN active booking has
// been verified — atomic and
// simpler than create-new-then-cancel-old (a row can't conflict with itself, and
// the EXCLUDE still guards against colliding with a DIFFERENT booking). Preserve
// the duration snapshot stored on the booking even if the service changes later.
export async function rebookOwnBooking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePortal('personal')
  const bookingId = String(formData.get('bookingId') ?? '')
  const startLocal = String(formData.get('start') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }
  if (!startLocal) return { error: 'Ange en ny tid.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }
  const myStaffIds = staff.map((s) => s.id)
  const tz = staff[0]?.timeZone ?? 'Europe/Stockholm'

  const supabase = await createClient()

  // Load the OWN active booking and preserve its original duration snapshot.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, start_ts, end_ts')
    .eq('id', bookingId)
    .eq('tenant_id', user.tenantId ?? '')
    .in('staff_id', myStaffIds)
    .in('status', [...ACTIVE_STATUSES])
    .maybeSingle()
  if (!booking) return { error: 'Bokningen kan inte ombokas.' }
  const durationMs = new Date(booking.end_ts).getTime() - new Date(booking.start_ts).getTime()
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { error: 'Bokningens längd är ogiltig — kan inte omboka.' }
  }

  const startUtc = localToUtc(startLocal, tz)
  if (!startUtc) return { error: 'Ogiltig tid.' }
  const endUtc = new Date(startUtc.getTime() + durationMs)

  const writer = createAdminServiceClient()
  if (!writer) return { error: 'Bokningsändringar är inte tillgängliga just nu.' }
  const { data: updated, error } = await writer
    .from('bookings')
    .update({ start_ts: startUtc.toISOString(), end_ts: endUtc.toISOString() })
    .eq('id', bookingId)
    .eq('tenant_id', user.tenantId ?? '')
    .in('staff_id', myStaffIds)
    .in('status', [...ACTIVE_STATUSES])
    .select('id')
  if (error) {
    if (error.code === '23P01')
      return { error: 'Tiden krockar med en annan bokning. Välj en annan tid.' }
    return { error: 'Kunde inte omboka. Försök igen.' }
  }
  if (!updated || updated.length === 0) return { error: 'Bokningen kan inte ombokas.' }

  revalidatePath('/personal')
  return { success: 'Bokningen ombokad.' }
}

// ── Cancel (own booking) ──────────────────────────────────────────────────────
// status='cancelled' frees the slot (EXCLUDE only blocks pending/confirmed/
// completed). Own-scope via staff_id + active-status re-asserted in the UPDATE.
// Refund + cancellation mail are best-effort so a paid booking the staff cancels
// can never strand the customer's money — but never block the status flip.
export async function cancelOwnBooking(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePortal('personal')
  const bookingId = String(formData.get('bookingId') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }
  const myStaffIds = staff.map((s) => s.id)

  const supabase = await createClient()
  const writer = createAdminServiceClient()
  if (!writer) return { error: 'Bokningsändringar är inte tillgängliga just nu.' }
  const { data: released, error } = await writer
    .from('bookings')
    // cancelled_by: 'business' — personalen ÄR salongen sett från kunden. Loggen
    // skiljer på "kunden avbokade" och "vi avbokade", inte på vilken anställd.
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: 'business',
    })
    .eq('id', bookingId)
    .eq('tenant_id', user.tenantId ?? '')
    .in('staff_id', myStaffIds)
    .in('status', [...ACTIVE_STATUSES])
    .select('id')
  if (error) return { error: 'Kunde inte avboka. Försök igen.' }
  if (!released || released.length === 0) return { error: 'Bokningen kan inte avbokas.' }

  // Frigör pengarna om bokningen var betald (no-op utan lyckad betalning/Stripe).
  // Kund-notis om avbokningen är M9/notifications-revir, inte M5:s — och kontakt-
  // PII ska bara flöda via get_customer_contact (0011), aldrig läsas rått här.
  await refundBookingPayment(bookingId, user.tenantId ?? '')

  revalidatePath('/personal')
  return { success: 'Bokningen avbokad.' }
}

// ── Customer notes (internal client card, M5 §2.3) ───────────────────────────
// ONE row per (tenant, customer) — upsert on the unique key. Staff-only via RLS
// (customer_notes has no kund-self-scope branch). Structured arrays + guarded
// enums + a vaktad internal note. NEVER customer-facing.
export async function upsertCustomerNotes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePortal('personal')
  const customerId = String(formData.get('customerId') ?? '')
  if (!customerId) return { error: 'Saknar kund.' }

  const toArr = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40)

  const preferences = toArr(String(formData.get('preferences') ?? ''))
  const allergies = toArr(String(formData.get('allergies') ?? ''))
  const products = toArr(String(formData.get('products') ?? ''))

  const norm = (v: string, allowed: Set<string>): string | null => (allowed.has(v) ? v : null)
  const hairType = norm(String(formData.get('hairType') ?? ''), HAIR_TYPES)
  const hairLength = norm(String(formData.get('hairLength') ?? ''), HAIR_LENGTHS)
  const sensitivity = norm(String(formData.get('sensitivity') ?? ''), SENSITIVITIES)
  const internalNoteRaw = String(formData.get('internalNote') ?? '').trim()
  const internalNote = internalNoteRaw ? internalNoteRaw.slice(0, 2000) : null

  const supabase = await createClient()
  const { error } = await supabase.from('customer_notes').upsert(
    {
      tenant_id: user.tenantId ?? '',
      customer_id: customerId,
      preferences,
      allergies,
      products,
      hair_type: hairType,
      hair_length: hairLength,
      sensitivity,
      internal_note: internalNote,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,customer_id' },
  )
  if (error) return { error: 'Kunde inte spara klientkortet. Försök igen.' }

  revalidatePath('/personal')
  return { success: 'Klientkortet sparat.' }
}

// ── Time-bound contact-PII (M5 §2.2) ─────────────────────────────────────────
// Fetched only when a client card opens (never in the calendar payload). The DB
// fn get_customer_contact gates phone/email on the operative window and respects
// name_hidden; outside the window pii_visible=false and contact is null.
export type ContactResult = {
  ok: boolean
  displayName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  piiVisible: boolean
}

// Full client card + notes for one customer, loaded lazily when a card opens.
// No contact-PII here (that's getCustomerContact, window-gated, fetched on reveal).
export type ClientCardResult =
  | { ok: true; card: CustomerCard; notes: CustomerNotes }
  | { ok: false }

export async function getClientCard(customerId: string): Promise<ClientCardResult> {
  const user = await requirePortal('personal')
  if (!customerId) return { ok: false }
  const card = await getCustomerCard(customerId, user.tenantId ?? '')
  if (!card) return { ok: false }
  const notes = await getCustomerNotes(customerId)
  return { ok: true, card, notes }
}

export async function getCustomerContact(customerId: string): Promise<ContactResult> {
  await requirePortal('personal')
  const fail: ContactResult = {
    ok: false,
    displayName: null,
    fullName: null,
    email: null,
    phone: null,
    piiVisible: false,
  }
  if (!customerId) return fail

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_customer_contact', { p_customer: customerId })
  if (error || !data || data.length === 0) return fail
  const r = data[0]
  if (!r) return fail
  return {
    ok: true,
    displayName: r.display_name,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    piiVisible: r.pii_visible,
  }
}

// ── Time off (own) ───────────────────────────────────────────────────────────
// datetime-local values are tz-less wall-clock strings; convert through the
// shared zonedTimeToUtc in the staff's location timezone so the stored UTC
// interval lines up with what the M3 availability engine subtracts.
export async function addTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const startLocal = String(formData.get('start') ?? '')
  const endLocal = String(formData.get('end') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!startLocal || !endLocal) return { error: 'Ange både start och slut.' }

  const me = (await getMyStaff(user.id))[0]
  if (!me) return { error: NO_PROFILE }
  if (!me.locationId) return { error: 'Din personalprofil saknar plats. Kontakta administratören.' }

  const startUtc = localToUtc(startLocal, me.timeZone)
  const endUtc = localToUtc(endLocal, me.timeZone)
  if (!startUtc || !endUtc) return { error: 'Ogiltigt datum/tid.' }
  if (endUtc.getTime() <= startUtc.getTime()) return { error: 'Slutet måste vara efter starten.' }

  const supabase = await createClient()
  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'create_my_time_off',
      args: {
        p_staff: string
        p_location: string
        p_start: string
        p_end: string
        p_reason: string | null
      },
    ): PromiseLike<{ data: string | null; error: { message: string } | null }>
  }
  const { error } = await timeOffRpc.rpc('create_my_time_off', {
    p_staff: me.id,
    p_location: me.locationId,
    p_start: startUtc.toISOString(),
    p_end: endUtc.toISOString(),
    p_reason: reason || null,
  })
  if (error) return { error: 'Kunde inte spara frånvaron. Försök igen.' }

  revalidatePath('/personal/franvaro')
  return { success: 'Frånvaro tillagd.' }
}

export async function deleteTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }

  const supabase = await createClient()
  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'delete_my_time_off',
      args: { p_time_off: string },
    ): PromiseLike<{ data: boolean | null; error: { message: string } | null }>
  }
  const { error } = await timeOffRpc.rpc('delete_my_time_off', { p_time_off: id })
  if (error) return { error: 'Kunde inte ta bort frånvaron. Försök igen.' }

  revalidatePath('/personal/franvaro')
  return { success: 'Frånvaro borttagen.' }
}

/** 'YYYY-MM-DDTHH:MM' (datetime-local) → exact UTC instant in `timeZone`. */
function localToUtc(local: string, timeZone: string): Date | null {
  const [date, time] = local.split('T')
  if (!date || !time) return null
  return zonedTimeToUtc(date, time.slice(0, 5), timeZone)
}
