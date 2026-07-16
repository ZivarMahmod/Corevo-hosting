'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant, type AdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'
import { adminDaySlots, type AdminSlot } from '@/lib/admin/calendar-slots'
import { seriesOccurrences, REPEAT_KINDS, type RepeatKind } from '@/lib/admin/block-series'
import { setBookingStatus } from '@/lib/admin/actions'
import { resolveCustomerName } from '@/lib/personal/customer'
import { sendBookingConfirmation } from '@/lib/notifications/booking'
import { requestOrigin } from '@/lib/url'

/** Kalenderns skriv- och sökvägar (goal-66). Admin-RPC:n delegerar själva slotten
 *  till samma create_public_booking som kundflödet använder — dubbelbokningsspärr,
 *  staff↔plats-fence och tenant-validering gäller därför oförändrat. */

export type SlotsState = { slots?: AdminSlot[]; error?: string }

export async function loadDaySlots(input: {
  serviceId: string
  date: string
  locationId?: string
}): Promise<SlotsState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }
  if (!input.serviceId || !input.date) return { error: 'Välj en tjänst först.' }
  if (!input.locationId) return { error: 'Välj en plats först.' }

  try {
    const slots = await adminDaySlots({
      tenantId: tenant.id,
      date: input.date,
      timeZone: tenant.timeZone,
      serviceId: input.serviceId,
      locationId: input.locationId,
      // Samma nutidsgräns som skriv-RPC:n. Kalendern ska aldrig erbjuda en tid som
      // sedan avslås som passerad när ägaren trycker Spara.
      now: new Date(),
    })
    return { slots }
  } catch {
    return { error: 'Lediga tider kunde inte hämtas. Försök igen.' }
  }
}

export type CustomerHit = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export type CustomerSearchResult = { hits: CustomerHit[]; error?: string }

async function queryCustomers(tenantId: string, query: string): Promise<CustomerSearchResult> {
  const q = query.trim()
  if (q.length < 2) return { hits: [] }

  const supabase = await createClient()
  const like = `%${q}%`
  const { data, error } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden, email, phone')
    .eq('tenant_id', tenantId)
    // Dold kund (B-25) hittas inte i sök — det är vad "dold" betyder. Behöver man
    // hen ändå finns "Dolda kunder" på Kunder-sidan; bokningen går alltid via namn.
    .is('hidden_at', null)
    .or(
      `display_name.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`,
    )
    .limit(8)
  if (error) return { hits: [], error: 'Kundsökningen gick inte att genomföra.' }

  return {
    hits: (data ?? []).map((c) => ({
      id: c.id,
      // Samma maskningsregel som resten av adminen — ett dolt fullnamn läcker aldrig.
      name: resolveCustomerName(c),
      email: c.email,
      phone: c.phone,
    })),
  }
}

/** Sök kund på namn/e-post/telefon. Samma kontroll söker OCH skapar i drawern —
 *  ingen träff betyder "skriv klart, så blir det en ny kund" (Wavys enda formulär). */
export async function searchCustomers(query: string): Promise<CustomerSearchResult> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { hits: [], error: 'Kundsökningen gick inte att genomföra.' }
  return queryCustomers(tenant.id, query)
}

export type MoveBookingState = { success?: string; error?: string }

function availabilityFenceMessage(message: string, unchanged = false): string | null {
  const suffix = unchanged ? ' Bokningen är oförändrad.' : ''
  if (message.includes('booking_outside_working_hours')) {
    return `Tiden ligger utanför medarbetarens arbetstid.${suffix}`
  }
  if (message.includes('booking_not_explicit_slot')) {
    return `Starttiden är inte bokningsbar i medarbetarens schema.${suffix}`
  }
  if (message.includes('booking_not_on_slot_step')) {
    return `Starttiden följer inte medarbetarens bokningsintervall.${suffix}`
  }
  if (message.includes('invalid_booking_duration')) {
    return `Bokningens längd stämmer inte med tjänsten.${suffix}`
  }
  if (message.includes('booking_overlaps_time_off')) {
    return `Tiden överlappar en blockering eller frånvaro.${suffix}`
  }
  if (message.includes('booking_overlaps_location_closure')) {
    return `Platsen är stängd under den tiden.${suffix}`
  }
  if (message.includes('booking_outside_location_opening_hours')) {
    return `Tiden ligger utanför platsens öppettider.${suffix}`
  }
  if (message.includes('booking_inside_min_notice')) {
    return `Tiden ligger för nära i tid enligt platsens bokningsregler.${suffix}`
  }
  if (message.includes('booking_outside_advance_window')) {
    return `Tiden ligger längre fram än platsens bokningshorisont.${suffix}`
  }
  if (message.includes('booking_overlaps_reserved_time')) {
    return `Tiden krockar med en annan bokning.${suffix}`
  }
  if (message.includes('start_in_past')) {
    return `Tiden har redan passerat.${suffix}`
  }
  return null
}

/**
 * Flytta en bokning till ny tid och/eller ny resurs (drag i kalendern, eller
 * Flytta-knappen i drawern — samma väg).
 *
 * Krockskyddet ligger i DATABASEN (`no_double_booking`, EXCLUDE-constraint sedan
 * 0001). Vi kontrollerar alltså inte själva om tiden är ledig — vi låter skrivningen
 * försöka och tolkar avslaget. Det är det enda sättet som håller när två personer
 * flyttar samtidigt: en app-side "är den ledig?"-koll kan alltid bli inaktuell mellan
 * kollen och skrivningen.
 *
 * Längden följer med bokningen: en 60-minuterstid som flyttas till 11:00 slutar 12:00.
 */
export async function moveBooking(input: {
  bookingId: string
  /** Ny starttid, UTC ISO. */
  startIso: string
  /** Ny resurs. Samma som förut = ren tidsflytt. */
  staffId: string
  locationId: string
  serviceId: string
  expectedStartIso: string
  expectedStaffId: string
  /** När flytten startades i en frånvarokö auditeras upplösningen atomiskt. */
  absenceTimeOffId?: string
}): Promise<MoveBookingState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }
  if (
    !input.bookingId ||
    !input.staffId ||
    !input.locationId ||
    !input.serviceId ||
    !input.expectedStaffId ||
    Number.isNaN(Date.parse(input.startIso)) ||
    Number.isNaN(Date.parse(input.expectedStartIso))
  ) {
    return { error: 'Ogiltig flytt — ladda om och försök igen.' }
  }

  const supabase = await createClient()
  const bookingRpc = supabase as unknown as {
    rpc(
      name: 'reschedule_admin_booking' | 'reschedule_admin_absence_booking',
      args: {
        p_booking: string
        p_location: string
        p_staff: string
        p_service: string
        p_start: string
        p_expected_start: string
        p_expected_staff: string
        p_time_off?: string
      },
    ): PromiseLike<{
      data: unknown
      error: { code?: string; message: string } | null
    }>
  }
  const rpcName = input.absenceTimeOffId
    ? 'reschedule_admin_absence_booking'
    : 'reschedule_admin_booking'
  const { error } = await bookingRpc.rpc(rpcName, {
    p_booking: input.bookingId,
    p_location: input.locationId,
    p_staff: input.staffId,
    p_service: input.serviceId,
    p_start: input.startIso,
    p_expected_start: input.expectedStartIso,
    p_expected_staff: input.expectedStaffId,
    ...(input.absenceTimeOffId ? { p_time_off: input.absenceTimeOffId } : {}),
  })

  if (error) {
    // 23P01 = exclusion_violation → tiden krockar med en annan bokning. Originalet
    // ligger kvar orört; användaren får veta det och kan välja en annan tid.
    if (error.message.includes('no_double_booking') || error.code === '23P01') {
      return { error: 'Tiden krockar med en annan bokning. Bokningen ligger kvar där den var.' }
    }
    if (error.code === '40001' || error.message.includes('booking_changed_concurrently')) {
      return { error: 'Tiden ändrades av någon annan just nu. Bokningen är oförändrad här.' }
    }
    if (error.message.includes('booking_not_reschedulable')) {
      return { error: 'En avslutad tid kan inte flyttas. Skapa en ny bokning i stället.' }
    }
    if (error.message.includes('cross_location_reschedule_forbidden')) {
      return { error: 'Bokningen kan inte flyttas mellan platser. Bokningen är oförändrad.' }
    }
    if (error.message.includes('invalid_staff_location')) {
      return { error: 'Medarbetaren arbetar inte på bokningens plats. Bokningen är oförändrad.' }
    }
    if (
      error.message.includes('invalid_staff') ||
      error.message.includes('invalid_booking_resources')
    ) {
      return { error: 'Medarbetaren kan inte utföra den här tjänsten. Bokningen är oförändrad.' }
    }
    if (error.message.includes('invalid_location')) {
      return { error: 'Bokningens plats är inte längre tillgänglig. Bokningen är oförändrad.' }
    }
    const availabilityError = availabilityFenceMessage(error.message, true)
    if (availabilityError) return { error: availabilityError }
    return { error: 'Flytten gick inte igenom. Bokningen ligger kvar där den var.' }
  }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: 'Bokningen är flyttad.' }
}

export type BlockState = { success?: string; error?: string; blockId?: string }

export type BlockImpact = {
  bookingId: string
  startTs: string
  endTs: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  serviceName: string
  status: string
  handled: boolean
  resolution: string | null
}

type BlockImpactRow = {
  booking_id: string
  start_ts: string
  end_ts: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  service_name: string
  status: string
  handled: boolean
  resolution: string | null
}

const mapBlockImpact = (row: BlockImpactRow): BlockImpact => ({
  bookingId: row.booking_id,
  startTs: row.start_ts,
  endTs: row.end_ts,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  serviceName: row.service_name,
  status: row.status,
  handled: row.handled,
  resolution: row.resolution,
})

export async function previewBlockImpacts(input: {
  locationId: string
  staffId: string
  startIso: string
  endIso: string
}): Promise<{ impacts: BlockImpact[]; error?: string }> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant || !input.locationId || !input.staffId) {
    return { impacts: [], error: 'Välj plats och medarbetare först.' }
  }
  const supabase = await createClient()
  const impactRpc = supabase as unknown as {
    rpc(
      name: 'preview_admin_time_off_impacts',
      args: { p_location: string; p_staff: string; p_start: string; p_end: string },
    ): PromiseLike<{ data: BlockImpactRow[] | null; error: { message: string } | null }>
  }
  const { data, error } = await impactRpc.rpc('preview_admin_time_off_impacts', {
    p_location: input.locationId,
    p_staff: input.staffId,
    p_start: input.startIso,
    p_end: input.endIso,
  })
  if (error) return { impacts: [], error: 'Bokningarna kunde inte kontrolleras. Försök igen.' }
  return { impacts: (data ?? []).map(mapBlockImpact) }
}

export async function loadBlockImpacts(
  timeOffId: string,
): Promise<{ impacts: BlockImpact[]; error?: string }> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant || !timeOffId) return { impacts: [], error: 'Blockeringen kunde inte läsas.' }
  const supabase = await createClient()
  const impactRpc = supabase as unknown as {
    rpc(
      name: 'get_admin_time_off_impacts',
      args: { p_time_off: string },
    ): PromiseLike<{ data: BlockImpactRow[] | null; error: { message: string } | null }>
  }
  const { data, error } = await impactRpc.rpc('get_admin_time_off_impacts', {
    p_time_off: timeOffId,
  })
  if (error) return { impacts: [], error: 'Arbetskön kunde inte laddas.' }
  return { impacts: (data ?? []).map(mapBlockImpact) }
}

export async function markBlockImpactHandled(input: {
  timeOffId: string
  bookingId: string
  resolution: 'contacted' | 'rescheduled' | 'cancelled' | 'handled'
  note?: string
}): Promise<BlockState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant || !input.timeOffId || !input.bookingId) return { error: 'Bokningen saknas.' }
  const supabase = await createClient()
  const impactRpc = supabase as unknown as {
    rpc(
      name: 'mark_admin_time_off_booking_handled',
      args: {
        p_time_off: string
        p_booking: string
        p_resolution: string
        p_note: string | null
      },
    ): PromiseLike<{ data: null; error: { message: string } | null }>
  }
  const { error } = await impactRpc.rpc('mark_admin_time_off_booking_handled', {
    p_time_off: input.timeOffId,
    p_booking: input.bookingId,
    p_resolution: input.resolution,
    p_note: input.note?.trim().slice(0, 200) || null,
  })
  if (error) {
    if (error.message.includes('absence_booking_not_active')) {
      return { error: 'Bokningen är redan flyttad eller avbokad. Ladda om kön.' }
    }
    return { error: 'Hanteringen kunde inte sparas.' }
  }
  revalidatePath('/admin/bokningar')
  return { success: 'Bokningen är markerad som hanterad.' }
}

/**
 * Blockera tid (rast, frånvaro, avvikande arbetstid) — EN mekanism för allt som gör
 * en resurs obokningsbar. Wavys lärdom: ingen rastmodul, ingen frånvaromodul, ingen
 * schemaundantagsmodul. En blockering räcker för alla fyra behoven.
 *
 * Skrivs till `time_off` — samma tabell som personalens frånvaro, och samma rader som
 * bokningsmotorn redan räknar som upptagen tid (get_busy_intervals). Blockerar man en
 * timme här försvinner den ur den publika bokningen i samma stund.
 *
 * Upprepning (B-22/B-23) är MATERIALISERAD: "lunch varje dag" skrivs som en rad per
 * dag 12 månader fram, alla med samma series_id. Läskedjan (kalender, bokningsmotor,
 * realtid) förblir orörd — den ser bara vanliga rader. Väggklockelogiken bor i
 * seriesOccurrences och är DST-testad.
 */
export async function createBlock(input: {
  locationId: string
  staffId: string
  startIso: string
  endIso: string
  kind: 'break' | 'leave' | 'sick' | 'other'
  reason: string
  repeat?: RepeatKind
}): Promise<BlockState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }

  const start = new Date(input.startIso)
  const end = new Date(input.endIso)
  if (
    !input.locationId ||
    !input.staffId ||
    !['break', 'leave', 'sick', 'other'].includes(input.kind) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return { error: 'Ogiltig tid — ladda om och försök igen.' }
  }
  if (end <= start) return { error: 'Sluttiden måste vara efter starttiden.' }

  const repeat: RepeatKind = REPEAT_KINDS.includes(input.repeat as RepeatKind)
    ? (input.repeat as RepeatKind)
    : 'ingen'

  const supabase = await createClient()
  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('timezone')
    .eq('id', input.locationId)
    .eq('tenant_id', tenant.id)
    .maybeSingle<{ timezone: string | null }>()
  if (locationError || !location) {
    return { error: 'Platsen kunde inte verifieras. Ladda om och försök igen.' }
  }

  const occurrences = seriesOccurrences({
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    repeat,
    tz: location.timezone ?? tenant.timeZone,
  })
  const seriesId = occurrences.length > 1 ? crypto.randomUUID() : null
  const reason = input.reason.trim() || 'Blockerad'

  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'create_admin_time_off_series',
      args: {
        p_location: string
        p_staff: string
        p_occurrences: { start_ts: string; end_ts: string }[]
        p_kind: 'break' | 'leave' | 'sick' | 'other'
        p_reason: string
        p_series_id: string | null
      },
    ): PromiseLike<{ data: string[] | null; error: { message: string } | null }>
  }
  const { data: blockIds, error } = await timeOffRpc.rpc('create_admin_time_off_series', {
    p_location: input.locationId,
    p_staff: input.staffId,
    p_occurrences: occurrences.map((o) => ({ start_ts: o.startIso, end_ts: o.endIso })),
    p_kind: input.kind,
    p_reason: reason,
    p_series_id: seriesId,
  })
  if (error) return { error: 'Blockeringen gick inte att spara. Försök igen.' }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return {
    blockId: blockIds?.[0],
    success:
      occurrences.length > 1
        ? `Tiden är blockerad och upprepas — ${occurrences.length} tillfällen inlagda (12 månader framåt).`
        : 'Tiden är blockerad — den går inte längre att boka.',
  }
}

/** Ta bort en blockering. Befintliga bokningar i tiden påverkas ALDRIG — de ligger
 *  kvar; blockeringen hindrade bara NYA bokningar.
 *
 *  scope (B-23): 'en' tar bort exakt den valda förekomsten; 'framat' tar bort den
 *  och alla senare i samma serie. Bakåt skrivs ALDRIG om — raderna för förra veckan
 *  är historik om vad som faktiskt var blockerat. */
export async function removeBlock(
  blockId: string,
  scope: 'en' | 'framat' = 'en',
): Promise<BlockState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }
  if (!blockId) return { error: 'Ogiltig blockering.' }

  const supabase = await createClient()
  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'delete_admin_time_off',
      args: { p_time_off: string; p_delete_series: boolean },
    ): PromiseLike<{ data: number | null; error: { message: string } | null }>
  }
  const { data: deleted, error } = await timeOffRpc.rpc('delete_admin_time_off', {
    p_time_off: blockId,
    p_delete_series: scope === 'framat',
  })
  if (error) {
    if (error.message.includes('time_off_not_found')) {
      return { error: 'Blockeringen finns inte längre.' }
    }
    return { error: 'Blockeringen gick inte att ta bort. Försök igen.' }
  }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return {
    success:
      scope === 'framat' && (deleted ?? 0) > 1
        ? `${deleted} blockeringar borttagna — denna och alla framåt. Tidigare tillfällen ligger kvar.`
        : 'Blockeringen är borttagen — tiden går att boka igen.',
  }
}

// ── Sök ───────────────────────────────────────────────────────────────────────

export type BookingHit = {
  id: string
  startTs: string
  /** Datum i salongens tidszon (YYYY-MM-DD) — kalendern hoppar hit direkt. */
  date: string
  customerName: string
  serviceName: string
  staffTitle: string
  status: string
}

export type AdminPaletteSearchResult = {
  items: {
    href: string
    label: string
    sub?: string
    kind: 'Kund' | 'Bokning'
    icon: 'users' | 'calendar'
  }[]
  error?: string
}

async function queryBookings(
  tenant: Pick<AdminTenant, 'id' | 'timeZone'>,
  hits: CustomerHit[],
): Promise<BookingHit[]> {
  if (hits.length === 0) return []
  const byId = new Map(hits.map((hit) => [hit.id, hit.name]))
  const supabase = await createClient()
  const from = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  const to = new Date(Date.now() + 365 * 24 * 3600_000).toISOString()
  const { data } = await supabase
    .from('bookings')
    .select('id, start_ts, status, customer_id, services(name), staff(title)')
    .eq('tenant_id', tenant.id)
    .in('customer_id', [...byId.keys()])
    .gte('start_ts', from)
    .lt('start_ts', to)
    .order('start_ts', { ascending: true })
    .limit(20)

  return (data ?? []).map((booking) => {
    const row = booking as unknown as {
      id: string
      start_ts: string
      status: string
      customer_id: string
      services: { name: string } | null
      staff: { title: string | null } | null
    }
    return {
      id: row.id,
      startTs: row.start_ts,
      // Kalenderlänken måste följa salongens väggklocka, inte UTC-datumet.
      date: new Intl.DateTimeFormat('sv-SE', { timeZone: tenant.timeZone }).format(
        new Date(row.start_ts),
      ),
      customerName: byId.get(row.customer_id) ?? 'Kund',
      serviceName: row.services?.name ?? 'Bokning',
      staffTitle: row.staff?.title ?? '',
      status: row.status,
    }
  })
}

/**
 * Hitta en kunds bokningar. Svarar på frisörens vanligaste fråga: "när kommer Anna?"
 *
 * Sökningen går i TVÅ indexerade steg — kund först (searchCustomers, samma kontroll
 * som bokningsdialogen), sedan bokningar på de kund-id:na. Att i stället läsa ett halvårs
 * bokningar och filtrera i appen hade varit färre rader kod och tusentals rader data
 * per tangenttryck.
 *
 * Fönstret är 30 dagar bakåt (nyss varit här — "vad klippte vi förra gången?") och
 * ett år framåt (en kund kan boka långt fram).
 */
export async function searchBookings(query: string): Promise<BookingHit[]> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return []
  const q = query.trim()
  if (q.length < 2) return []

  const customerSearch = await queryCustomers(tenant.id, q)
  const hits = customerSearch.hits
  if (customerSearch.error || hits.length === 0) return []
  return queryBookings(tenant, hits)
}

/** Toppbannerns globala sök: riktiga tenant-scopade kunder + bokningar, inte
 * bara statiska navigationslänkar. Returnerar direktlänkar till kundkortet eller
 * rätt kalenderdag med bokningsdrawern öppen. */
export async function searchAdminPalette(query: string): Promise<AdminPaletteSearchResult> {
  const q = query.trim()
  if (q.length < 2) return { items: [] }

  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { items: [], error: 'Sökningen gick inte att genomföra.' }
  const customers = await queryCustomers(tenant.id, q)
  if (customers.error) return { items: [], error: customers.error }
  const bookings = await queryBookings(tenant, customers.hits)

  return {
    items: [
      ...customers.hits.slice(0, 5).map((customer) => ({
        href: `/admin/kunder/${customer.id}`,
        label: customer.name,
        sub: customer.email ?? customer.phone ?? 'Kundkort',
        kind: 'Kund' as const,
        icon: 'users' as const,
      })),
      ...bookings.slice(0, 6).map((booking) => ({
        href: `/admin/bokningar?vy=dag&datum=${booking.date}&open=${booking.id}`,
        label: booking.customerName,
        sub: `${booking.date} · ${booking.serviceName}${booking.staffTitle ? ` · ${booking.staffTitle}` : ''}`,
        kind: 'Bokning' as const,
        icon: 'calendar' as const,
      })),
    ],
  }
}

// ── Ångraloggen (B-24) ────────────────────────────────────────────────────────

export type CancelledBooking = {
  id: string
  startTs: string
  serviceName: string
  staffTitle: string | null
  customerName: string
  cancelledAt: string | null
  cancelledBy: 'customer' | 'business' | 'system' | null
  /** Tiden har redan passerat — då finns inget att återställa, bara att läsa. */
  isPast: boolean
}

/** Avbokningar de senaste 30 dagarna. Fönstret är loggens hela poäng: en felavbokad
 *  tid upptäcks samma vecka, aldrig ett halvår senare — och en obegränsad logg blir
 *  ett arkiv ingen läser (och en fråga som växer för alltid).
 *
 *  Läses först när loggen ÖPPNAS, inte vid varje kalenderrendering. Kalendern laddas
 *  femtio gånger om dagen; loggen öppnas kanske en gång i veckan. */
export async function loadCancelled(): Promise<CancelledBooking[]> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return []

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(
      'id, start_ts, cancelled_at, cancelled_by, services(name), staff(title), customers(display_name, full_name, name_hidden)',
    )
    .eq('tenant_id', tenant.id)
    .eq('status', 'cancelled')
    .gte('cancelled_at', since)
    .order('cancelled_at', { ascending: false })
    .limit(50)

  const now = Date.now()
  return (data ?? []).map((b) => {
    const row = b as unknown as {
      id: string
      start_ts: string
      cancelled_at: string | null
      cancelled_by: CancelledBooking['cancelledBy']
      services: { name: string } | null
      staff: { title: string | null } | null
      customers: Parameters<typeof resolveCustomerName>[0] | null
    }
    return {
      id: row.id,
      startTs: row.start_ts,
      serviceName: row.services?.name ?? 'Bokning',
      staffTitle: row.staff?.title ?? null,
      customerName: row.customers ? resolveCustomerName(row.customers) : 'Okänd kund',
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
      isPast: new Date(row.start_ts).getTime() < now,
    }
  })
}

/** Ångra en avbokning: tiden bokas tillbaka som bekräftad.
 *
 *  Går genom setBookingStatus, inte förbi den. Det är hela vitsen — där sitter
 *  refund-vakten (en återbetald bokning väcks aldrig), tenant-fencet och tolkningen
 *  av dubbelbokningsspärren. En egen UPDATE här hade varit tre rader kortare och en
 *  andra sanning om vad som får hända med en bokning. */
export async function restoreBooking(bookingId: string): Promise<MoveBookingState> {
  const fd = new FormData()
  fd.set('bookingId', bookingId)
  fd.set('status', 'confirmed')
  const res = await setBookingStatus({}, fd)
  if (res.error) return { error: res.error }
  return { success: 'Bokningen är återställd och ligger i kalendern igen.' }
}

export type CreateBookingState = { success?: string; error?: string; bookingId?: string }

/**
 * Skapa bokning från kalendern.
 *
 * KONTAKTKRAV (låst beslut, codex/00 §9): personal som bokar behöver BARA ett namn.
 * E-post och telefon är frivilliga. Saknas kontaktväg går ingen notis ut — och UI:t
 * säger det FÖRE spara i stället för att låtsas ha skickat något.
 */
export async function createAdminBooking(
  _prev: CreateBookingState,
  fd: FormData,
): Promise<CreateBookingState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }

  const serviceId = String(fd.get('service') ?? '')
  const staffId = String(fd.get('staff') ?? '')
  const start = String(fd.get('start') ?? '')
  const locationId = String(fd.get('location') ?? '')
  const customerId = String(fd.get('customerId') ?? '')
  const guestName = String(fd.get('guestName') ?? '').trim()
  const guestEmail = String(fd.get('guestEmail') ?? '').trim()
  const guestPhone = String(fd.get('guestPhone') ?? '').trim()
  const note = String(fd.get('note') ?? '').trim()
  const requestId = String(fd.get('requestId') ?? '')

  if (
    !serviceId ||
    !staffId ||
    !locationId ||
    Number.isNaN(Date.parse(start)) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    return { error: 'Ogiltig tid eller tjänst — ladda om och försök igen.' }
  }
  // Enda kravet: vi måste veta VEM tiden är för. Antingen en befintlig kund, eller
  // ett namn att skapa.
  if (!customerId && !guestName) {
    return { error: 'Skriv kundens namn — det är det enda som krävs.' }
  }

  const supabase = await createClient()

  // Admin bokar åt någon annan än auth.uid(). Den särskilda admin-RPC:n gör
  // bokning + exakt kundkoppling atomiskt och tenant-säkert. Publik självbokning
  // fortsätter gå genom create_public_booking direkt.
  const { data: bookingResultRaw, error } = await supabase.rpc('create_admin_booking', {
    p_service: serviceId,
    p_staff: staffId,
    p_location: locationId,
    p_start: start,
    p_customer_id: customerId || undefined,
    p_guest_name: guestName || undefined,
    p_guest_email: guestEmail || undefined,
    p_guest_phone: guestPhone || undefined,
    p_note: note || undefined,
    p_request_id: requestId,
  })

  const bookingResult =
    bookingResultRaw && typeof bookingResultRaw === 'object' && !Array.isArray(bookingResultRaw)
      ? (bookingResultRaw as { booking_id?: unknown; created?: unknown })
      : null
  if (error || !bookingResult || typeof bookingResult.booking_id !== 'string') {
    const msg = error?.message ?? ''
    // Konflikten är ÄRLIG: någon annan hann före. Inmatningen ligger kvar i drawern
    // så användaren kan välja en annan tid utan att skriva om allt.
    if (msg.includes('no_double_booking') || error?.code === '23P01') {
      return { error: 'Tiden hann bli tagen. Välj en annan tid — dina uppgifter är kvar.' }
    }
    if (
      msg.includes('invalid_staff_location') ||
      msg.includes('invalid_booking_staff_location') ||
      msg.includes('admin_booking_location_required')
    ) {
      return { error: 'Medarbetaren har inga tider på den platsen.' }
    }
    if (msg.includes('invalid_customer')) {
      return { error: 'Kunden hittades inte — ladda om och försök igen.' }
    }
    const availabilityError = availabilityFenceMessage(msg)
    if (availabilityError) return { error: availabilityError }
    return { error: 'Bokningen gick inte igenom. Försök igen.' }
  }
  const bookingId = bookingResult.booking_id

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')

  const created = bookingResult.created === true
  if (!created) {
    return {
      success: 'Bokningen var redan sparad. Inget nytt meddelande skickades.',
      bookingId,
    }
  }

  // NOTISEN. Drawern har redan visat exakt vad som skulle skickas — nu måste det
  // faktiskt ske, annars ljuger UI:t. Valde användaren "Skicka inget" skickas inget.
  //
  // Skickas det: bokningen är ändå SPARAD. Ett trasigt mejlutskick får aldrig se ut
  // som en misslyckad bokning — vi säger sanningen om båda delarna var för sig.
  const wantsEmail = String(fd.get('notify') ?? '') === 'epost'
  if (!wantsEmail) {
    return {
      success: 'Bokningen är sparad. Inget meddelande skickades.',
      bookingId: String(bookingId),
    }
  }

  const { data: fresh } = await supabase
    .from('bookings')
    .select('start_ts, services(name), staff(title), customers(email), locations(timezone)')
    .eq('id', bookingId)
    .eq('tenant_id', tenant.id)
    .maybeSingle<{
      start_ts: string
      services: { name: string } | null
      staff: { title: string | null } | null
      customers: { email: string | null } | null
      locations: { timezone: string } | null
    }>()

  const to = fresh?.customers?.email ?? (customerId ? null : guestEmail || null)
  if (!to || !fresh) {
    return {
      success: 'Bokningen är sparad — men inget mejl kunde skickas (adress saknas).',
      bookingId: String(bookingId),
    }
  }

  try {
    await sendBookingConfirmation(
      to,
      {
        tenantName: tenant.name,
        serviceName: fresh.services?.name ?? 'Bokning',
        staffTitle: fresh.staff?.title ?? null,
        startISO: fresh.start_ts,
        // Tiden i mejlet ska stå i SALONGENS tidszon — kunden bryr sig om väggklockan,
        // inte om UTC.
        timeZone: fresh.locations?.timezone ?? tenant.timeZone,
      },
      {
        supabase,
        tenantId: tenant.id,
        bookingId: String(bookingId),
        origin: await requestOrigin(),
      },
    )
  } catch {
    return {
      success: 'Bokningen är sparad, men bekräftelsemejlet gick inte iväg. Skicka det manuellt.',
      bookingId: String(bookingId),
    }
  }

  return {
    success: `Bokningen är sparad. Bekräftelse skickad till ${to}.`,
    bookingId: String(bookingId),
  }
}
