'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient } from '@/lib/platform/service'
import {
  computeSlots,
  intersectWorkingWindows,
} from '@/lib/booking/availability'
import { loadLocationAvailability } from '@/lib/booking/location-rules'
import { weekdayOf, zonedTimeToUtc } from '@/lib/booking/tz'
import { getPaymentGate } from '@/lib/booking/payment-gate'
import { getStripe } from '@/lib/stripe/client'
import { requestOrigin } from '@/lib/url'
import { sendBookingConfirmation } from '@/lib/notifications/booking'
import { getEnabledNotifications } from '@/lib/notifications/settings'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'

// The public booking flow runs as the anon role. Reads of staff/services/
// working_hours are gated by the anon RLS policies; proposed starts are filtered
// through get_public_bookable_starts, which returns only bookable staff/start pairs
// (never raw busy intervals). Inserts go through create_public_booking. Tenant
// identity is taken from the middleware-resolved header — NEVER from the client.

export type SlotOption = { start: string; staffId: string; staffTitle: string | null }
export type SlotsResult =
  | { ok: true; timeZone: string; slots: SlotOption[] }
  | { ok: false; error: string }

export type CreateBookingInput = {
  serviceId: string
  staffId: string
  startISO: string
  name: string
  email: string
  phone: string
  note?: string
  /** Vald plats (VÅG 4b). Utelämnad → create_public_booking faller tillbaka på
   *  tenantens primära aktiva plats (oförändrat för en-plats-salonger). */
  locationId?: string | null
  /** Idempotens-nyckel (0048): klient-genererad per boknings-INTENT och stabil
   *  över retries. Samma id igen ⇒ RPC:n returnerar den befintliga bokningen i
   *  stället för dubblett/23P01. Utelämnad → exakt gamla beteendet. */
  requestId?: string
}
export type CreateResult =
  | { ok: true; bookingId: string; requiresPayment: boolean }
  | { ok: false; reason: 'slot_taken' | 'invalid' | 'error'; message: string }

const SLOT_STEP_MIN = 15

type TenantContext = {
  tenantId: string
  slug: string
  timeZone: string
  /** Primary active location — the default scope when a caller omits a location
   *  (single-location tenants, /boka back-compat, rebok-flödet). May be null on
   *  the rare tenant with no primary; callers then fall back to the RPC default. */
  locationId: string | null
}

/** Resolve the request's tenant from the middleware header (never the client). */
async function getTenantContext(): Promise<TenantContext | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null
  // Primär aktiv plats: ger både tidszon (oförändrat) OCH default-scope (id) som
  // location-aware availability faller tillbaka på när ingen plats valts.
  const { data: loc } = await supabase
    .from('locations')
    .select('id, timezone')
    .eq('tenant_id', tenant.id)
    .eq('is_primary', true)
    .eq('active', true)
    .maybeSingle()
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    timeZone: loc?.timezone ?? 'Europe/Stockholm',
    locationId: loc?.id ?? null,
  }
}

/**
 * Available start times for a service on a date, optionally for one staff member
 * (null = "Alla", any staff who offers it). Each returned slot carries the staff
 * member who would take it, so booking is unambiguous.
 *
 * LOCATION-AWARE (VÅG 4b): availability is scoped to ONE location. A staff member
 * is bookable at location L iff they have ≥1 working_hours row at L, and only that
 * location's working_hours / working_hour_slots count. `staff_services` stays
 * tenant-global (a service is offered tenant-wide). When `locationId` is omitted we
 * resolve the tenant's PRIMARY active location, so single-location tenants behave
 * byte-identically to before (their rows already carry the primary's location_id).
 */
export async function getAvailableSlots(
  serviceId: string,
  staffId: string | null,
  date: string,
  locationId?: string | null,
): Promise<SlotsResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, error: 'Något gick fel — ladda om sidan och försök igen.' }
  const supabase = createPublicClient()

  // Default-scope: explicit val → annars tenantens primära plats. Saknas båda
  // (tenant utan primär plats) → ingen location-scope kan beräknas → tomt utbud,
  // konsekvent med create_public_booking som då reser 'no_location'.
  const loc = locationId ?? ctx.locationId
  if (!loc) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const locationAvailability = await loadLocationAvailability(supabase, ctx.tenantId, loc)
  if (!locationAvailability) return { ok: true, timeZone: ctx.timeZone, slots: [] }
  const { location, confirmedHours: confirmedLocationHours } = locationAvailability
  const timeZone = location.timezone ?? ctx.timeZone

  const { data: service } = await supabase
    .from('services')
    // slot_step_min / buffer_min (migr 0011): per-service raster + buffert. NULL på
    // alla befintliga rader → faller tillbaka på staff-värdet, sen på konstanten.
    .select('duration_min, slot_step_min, buffer_min, location_id')
    .eq('id', serviceId)
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .maybeSingle()
  if (!service || (service.location_id !== null && service.location_id !== loc)) {
    return { ok: false, error: 'Tjänsten finns inte på den valda platsen.' }
  }

  // staff who offer this service (tenant-global: staff_services has no location)
  const { data: offers } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('service_id', serviceId)
  let candidateIds = (offers ?? []).map((r) => r.staff_id)
  if (staffId) candidateIds = candidateIds.filter((id) => id === staffId)
  if (candidateIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const { data: staffRows } = await supabase
    .from('staff')
    // slot_step_min / buffer_min (migr 0011): per-frisör raster + buffert. NULL →
    // service-värdet om satt, annars konstanten (SLOT_STEP_MIN / 0).
    .select('id, title, slot_step_min, buffer_min')
    .eq('tenant_id', ctx.tenantId)
    .eq('location_id', loc)
    .eq('active', true)
    .in('id', candidateIds)
  const staffIds = (staffRows ?? []).map((s) => s.id)
  const titleById = new Map((staffRows ?? []).map((s) => [s.id, s.title]))
  // Per-frisör steg/buffert-uppslag (för fallback-ordningen service ?? staff ?? konst).
  const stepByStaff = new Map((staffRows ?? []).map((s) => [s.id, s.slot_step_min]))
  const bufferByStaff = new Map((staffRows ?? []).map((s) => [s.id, s.buffer_min]))
  if (staffIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const weekday = weekdayOf(date)
  const { data: hours } = await supabase
    .from('working_hours')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', ctx.tenantId)
    .eq('location_id', loc) // location-aware: bara denna plats fönster
    .eq('weekday', weekday)
    .in('staff_id', staffIds)

  const hasConfirmedLocationHours = confirmedLocationHours.length > 0
  const locationWindows = confirmedLocationHours
    .filter((window) => window.weekday === weekday)
    .map((window) => ({ start: window.start_time, end: window.end_time }))

  // working_hour_slots (migr 0011) — explicit bokbara starttider, OPT-IN per
  // (frisör, veckodag). Tom lista för en frisör denna dag → motorn faller tillbaka
  // på working_hours-rastret (range-vägen). KRITISKT: de flesta live-frisörer har
  // NOLL rader → de tar range-vägen och får aldrig tom availability. active-filtret
  // i app-lagret speglar 0011-policyn (working_hour_slots_public_read).
  const { data: explicitSlotRows } = await supabase
    .from('working_hour_slots')
    .select('staff_id, start_time')
    .eq('tenant_id', ctx.tenantId)
    .eq('location_id', loc) // location-aware: explicita starttider för denna plats
    .eq('weekday', weekday)
    .eq('active', true)
    .in('staff_id', staffIds)

  // A bounded local day is still used for max-advance handling below. Collision,
  // closure and absence filtering happens in the DB after candidate generation.
  const dayStart = zonedTimeToUtc(date, '00:00', timeZone)

  const windowsByStaff = new Map<string, { start: string; end: string }[]>()
  for (const w of hours ?? []) {
    const list = windowsByStaff.get(w.staff_id) ?? []
    list.push({ start: w.start_time, end: w.end_time })
    windowsByStaff.set(w.staff_id, list)
  }
  // Explicit starttider per frisör för dagen (tom map → alla tar range-vägen).
  const explicitByStaff = new Map<string, string[]>()
  for (const r of explicitSlotRows ?? []) {
    const list = explicitByStaff.get(r.staff_id) ?? []
    list.push(r.start_time)
    explicitByStaff.set(r.staff_id, list)
  }

  const requestNow = Date.now()
  const now = new Date(requestNow + location.min_notice_min * 60_000)
  const maximumStart = new Date(requestNow + location.max_advance_days * 86_400_000)
  if (dayStart.getTime() > maximumStart.getTime()) {
    return { ok: true, timeZone, slots: [] }
  }
  // start ISO → alla lediga frisörer den tiden. Vid "Alla" väljs sedan den med
  // minst bokad tid den dagen (Zivar 2026-07-10: systemet fördelar jobbet jämnt,
  // kunden ska inte se vem). RPC:ns dubbelboknings-skydd gäller oavsett.
  const candidateByStart = new Map<string, string[]>()
  for (const id of staffIds) {
    // Fallback-ordning (3a): service-värde ?? staff-värde ?? konstant. NULL i DB
    // (default för befintliga rader) → exakt dagens beteende (15 / 0).
    const stepMin =
      service.slot_step_min ?? stepByStaff.get(id) ?? location.slot_step_min ?? SLOT_STEP_MIN
    const bufferMin = service.buffer_min ?? bufferByStaff.get(id) ?? 0
    // Explicit-slots för just denna frisör denna dag; undefined/tom → range-vägen.
    const explicitStarts = explicitByStaff.get(id)
    const slots = computeSlots({
      date,
      timeZone,
      workingWindows: hasConfirmedLocationHours
        ? intersectWorkingWindows(windowsByStaff.get(id) ?? [], locationWindows)
        : windowsByStaff.get(id) ?? [],
      busy: [],
      durationMin: service.duration_min,
      slotStepMin: stepMin,
      bufferMin,
      explicitStarts,
      now,
    })
    for (const d of slots) {
      if (d > maximumStart) continue
      const iso = d.toISOString()
      const list = candidateByStart.get(iso)
      if (list) list.push(id)
      else candidateByStart.set(iso, [id])
    }
  }

  const candidateStarts = [...candidateByStart.keys()]
  if (candidateStarts.length === 0) return { ok: true, timeZone, slots: [] }
  type PublicBookableRow = { staff_id: string; start_ts: string }
  type PublicBookableRpc = {
    rpc: (
      name: 'get_public_bookable_starts',
      args: {
        p_tenant: string
        p_location: string
        p_service: string
        p_staff_ids: string[]
        p_starts: string[]
      },
    ) => Promise<{ data: PublicBookableRow[] | null; error: { message?: string } | null }>
  }
  const { data: bookableRows, error: bookableError } = await (
    supabase as unknown as PublicBookableRpc
  ).rpc('get_public_bookable_starts', {
    p_tenant: ctx.tenantId,
    p_location: loc,
    p_service: serviceId,
    p_staff_ids: staffIds,
    p_starts: candidateStarts,
  })
  if (bookableError) {
    return { ok: false, error: 'Kunde inte läsa lediga tider. Försök igen.' }
  }

  const byStart = new Map<string, string[]>()
  for (const row of bookableRows ?? []) {
    if (!candidateByStart.get(row.start_ts)?.includes(row.staff_id)) continue
    const list = byStart.get(row.start_ts)
    if (list) list.push(row.staff_id)
    else byStart.set(row.start_ts, [row.staff_id])
  }

  // Fler kvarvarande lediga starter betyder lägre belastning utan att exponera
  // råa bokningsintervall. Vid lika läge fördelar vi deterministiskt i denna lista.
  const availableCount = new Map<string, number>()
  for (const ids of byStart.values()) {
    for (const id of ids) availableCount.set(id, (availableCount.get(id) ?? 0) + 1)
  }
  // ponytail: greedy per slot-lista (minst bokad + minst tilldelad hittills) —
  // ingen global optimering, räcker för jämn fördelning över en dag.
  const assignedHere = new Map<string, number>()
  const pickLeastBusy = (ids: string[]): string => {
    let best = ids[0]!
    let bestScore = Infinity
    for (const id of ids) {
      const score = -(availableCount.get(id) ?? 0) + (assignedHere.get(id) ?? 0) * 0.001
      if (score < bestScore) {
        bestScore = score
        best = id
      }
    }
    assignedHere.set(best, (assignedHere.get(best) ?? 0) + 1)
    return best
  }

  const slots: SlotOption[] = [...byStart.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, ids]) => {
      const sId = staffId ? ids[0]! : pickLeastBusy(ids)
      return { start, staffId: sId, staffTitle: titleById.get(sId) ?? null }
    })

  return { ok: true, timeZone, slots }
}

/** Create a booking from the public flow. Leans on the EXCLUDE constraint. */
export async function createBooking(input: CreateBookingInput): Promise<CreateResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Något gick fel — ladda om sidan och försök igen.' }

  // Rate-limit booking writes per IP+tenant (G10) — guards the public, unauthed
  // create path against spam. Fails open on DB error.
  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('booking', ctx.tenantId, ip), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många bokningsförsök. Vänta en stund och försök igen.' }
  }

  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  if (!name || !email || !phone) {
    return { ok: false, reason: 'invalid', message: 'Fyll i namn, e-post och telefon.' }
  }
  if (!input.serviceId || !input.staffId || !input.startISO) {
    return { ok: false, reason: 'invalid', message: 'Ofullständig bokning. Börja om.' }
  }

  // Guest contact has no home table yet (customers table is a future goal), so it
  // rides `note` as a clearly-labelled temporary seam.
  const contactNote =
    `Gäst: ${name} <${email}> ${phone}` + (input.note?.trim() ? ` — ${input.note.trim()}` : '')

  const supabase = createPublicClient()
  const { data: bookingId, error } = await supabase.rpc('create_public_booking', {
    p_tenant_slug: ctx.slug,
    p_service: input.serviceId,
    p_staff: input.staffId,
    p_start: input.startISO,
    p_note: contactNote,
    p_guest_name: name,
    p_guest_email: email,
    p_guest_phone: phone,
    // Vald plats → validerad tenant+aktiv i RPC:n. Utelämnad (undefined) → RPC:ns
    // DEFAULT NULL → primär plats (back-compat). p_location är `string | undefined`
    // i de genererade typerna, så vi coalescear bort null.
    p_location: input.locationId ?? ctx.locationId ?? undefined,
    p_request_id: input.requestId ?? undefined,
  })

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, reason: 'slot_taken', message: 'Tyvärr, tiden togs precis. Välj en annan tid.' }
    }
    // P0001 = start_in_past (migr 0009): kunden satt på en gammal sida och valde en
    // tid som hunnit passera. Mappa till samma graceful "välj ny tid"-familj som
    // 23P01 i stället för ett kryptiskt "Något gick fel" (M3-bygg-item 1, stale-sida).
    if (error.code === 'P0001') {
      return { ok: false, reason: 'slot_taken', message: 'Den tiden är inte längre ledig — välj en ny tid.' }
    }
    // P0002 location-family (VÅG 5): the picked location was deactivated, or the
    // staff's working_hours at it were removed (0022 staff↔location fence), between
    // page-load and submit. A real user on a stale page can hit this → degrade to the
    // same "pick a new time" family as a taken slot, not a cryptic "something went
    // wrong". Other P0002s (invalid_service/invalid_staff) are start-over cases.
    if (error.code === 'P0002' && /invalid_staff_location|invalid_location/.test(error.message ?? '')) {
      return { ok: false, reason: 'slot_taken', message: 'Den tiden är inte längre ledig — välj en ny tid.' }
    }
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  if (!bookingId) {
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // Bokningsbekräftelse (G10): fire at CREATION (not on the webhook) — on-site
  // bookings never reach the webhook, so this is the only confirmation they get.
  // Best-effort + awaited so the mail flushes before the Workers request ends.
  // Gated on the owner's `confirmation` toggle (anon can read tenant_settings via
  // the public-read policy, migration 0004). Also carries the self-service cancel
  // link + opt-in SMS via the confirmation context.
  try {
    const prefs = await getEnabledNotifications(supabase, ctx.tenantId)
    if (prefs.confirmation) {
      const [{ data: tRow }, { data: sRow }, origin] = await Promise.all([
        supabase.from('tenants').select('name').eq('id', ctx.tenantId).maybeSingle(),
        supabase.from('services').select('name').eq('id', input.serviceId).eq('tenant_id', ctx.tenantId).maybeSingle(),
        requestOrigin(),
      ])
      await sendBookingConfirmation(
        email,
        {
          tenantName: tRow?.name ?? ctx.slug,
          serviceName: sRow?.name ?? 'Behandling',
          startISO: input.startISO,
          timeZone: ctx.timeZone,
        },
        { supabase, tenantId: ctx.tenantId, bookingId, origin, phone },
      )
    }
  } catch {
    // notifications are best-effort — never block the booking on a mail error.
  }

  // requiresPayment (G09): the SINGLE gate — payments_enabled AND charges_enabled.
  // True ⇒ the wizard starts Stripe Checkout; false ⇒ "betala på plats".
  // Bokningen är REDAN durabel här — ett kast i gate-läsningen får aldrig unwinda
  // svaret till ett fel (kunden skulle boka om → dold dubbelbokning, audit P1-3).
  // Fel ⇒ betala-på-plats-vägen, som alltid är giltig.
  let requiresPayment = false
  try {
    const gate = await getPaymentGate(supabase, ctx.tenantId)
    requiresPayment = gate.canTakeOnline
  } catch {
    requiresPayment = false
  }

  return { ok: true, bookingId, requiresPayment }
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unavailable' | 'error'; message: string }

/**
 * Start a Stripe Checkout Session for a just-created booking (G09 step 3).
 * DIRECT charge on the salong's connected account (`stripeAccount`), full service
 * price, application_fee_amount OMITTED ⇒ fee = 0 (Corevo tar inget snitt här).
 *
 * Runs service-role (RLS-bypass): the booking + payment row writes are invisible
 * to anon, and the connected account id must stay server-side. Degrades to
 * { unavailable } (→ "betala på plats") when Stripe/secret saknas eller gaten är av.
 */
export async function startBookingCheckout(bookingId: string): Promise<CheckoutResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'error', message: 'Något gick fel — ladda om sidan och försök igen.' }
  if (!bookingId) return { ok: false, reason: 'error', message: 'Saknar bokning.' }

  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }
  }

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    admin.from('tenants').select('stripe_account_id, stripe_charges_enabled').eq('id', ctx.tenantId).maybeSingle(),
    admin.from('tenant_settings').select('payments_enabled').eq('tenant_id', ctx.tenantId).maybeSingle(),
  ])
  const canTakeOnline = (settings?.payments_enabled ?? false) && (tenant?.stripe_charges_enabled ?? false)
  if (!canTakeOnline || !tenant?.stripe_account_id) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }
  }

  // Bokningen MÅSTE tillhöra denna tenant (bookingId kommer från klienten).
  const { data: booking } = await admin
    .from('bookings')
    .select('id, price_cents, status, services(name)')
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!booking) return { ok: false, reason: 'error', message: 'Bokningen hittades inte.' }
  const amount = booking.price_cents ?? 0
  if (amount <= 0) return { ok: false, reason: 'unavailable', message: 'Inget pris att betala.' }
  const serviceName = (booking.services as { name?: string } | null)?.name ?? 'Behandling'

  const origin = await requestOrigin()
  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: { currency: 'sek', unit_amount: amount, product_data: { name: serviceName } },
          },
        ],
        // application_fee_amount UTELÄMNAS medvetet ⇒ fee = 0.
        payment_intent_data: { metadata: { booking_id: bookingId, tenant_id: ctx.tenantId } },
        metadata: { booking_id: bookingId, tenant_id: ctx.tenantId },
        success_url: `${origin}/boka/bekraftelse/${bookingId}?betald=1`,
        cancel_url: `${origin}/boka/bekraftelse/${bookingId}?avbruten=1`,
      },
      { stripeAccount: tenant.stripe_account_id }, // DIRECT charge på salongens konto
    )
  } catch {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  if (!session.url) return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }

  // Payment-raden skrivs FÖRST när Stripe-sessionen finns (vattentät-audit P0-1):
  // en misslyckad checkout får ALDRIG lämna en föräldralös pending-rad — expire-
  // svepet (0018) matchar booking.pending + payments.pending och skulle annars
  // avboka en bokning kunden fått bekräftad som betala-på-plats. En payment-rad
  // per bokning (UNIQUE(booking_id) → idempotensgrund för webhooken).
  const { error: payErr } = await admin.from('payments').upsert(
    {
      tenant_id: ctx.tenantId, booking_id: bookingId, amount_cents: amount, currency: 'sek',
      status: 'pending', stripe_checkout_session_id: session.id,
    },
    { onConflict: 'booking_id' },
  )
  // Utan payment-rad ska kunden inte skickas till Stripe (webhooken skulle sakna
  // sin rad) — degradera till betala-på-plats; sessionen självdör hos Stripe.
  if (payErr) return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }

  return { ok: true, url: session.url }
}
