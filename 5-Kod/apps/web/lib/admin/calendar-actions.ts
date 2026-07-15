'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { createClient } from '@/lib/supabase/server'
import { adminDaySlots, type AdminSlot } from '@/lib/admin/calendar-slots'
import { seriesOccurrences, REPEAT_KINDS, type RepeatKind } from '@/lib/admin/block-series'
import { setBookingStatus } from '@/lib/admin/actions'
import { resolveCustomerName } from '@/lib/personal/customer'
import { sendBookingConfirmation } from '@/lib/notifications/booking'
import { requestOrigin } from '@/lib/url'

/** Kalenderns skriv- och sökvägar (goal-66). Bokningen går genom SAMMA RPC som
 *  kundens egen bokning (create_public_booking) — då gäller alla skydd automatiskt:
 *  dubbelbokningsspärren, staff↔plats-fencet och tenant-valideringen. En adminbokning
 *  får inte vara en gräddfil förbi reglerna. */

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

  const slots = await adminDaySlots({
    tenantId: tenant.id,
    date: input.date,
    timeZone: tenant.timeZone,
    serviceId: input.serviceId,
    locationId: input.locationId,
    // Ägaren får boka bakåt i tiden (efterregistrera ett besök som redan skett) —
    // det publika flödet får inte. Därför skickas inget `now`-tak här.
    now: new Date(0),
  })
  return { slots }
}

export type CustomerHit = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

/** Sök kund på namn/e-post/telefon. Samma kontroll söker OCH skapar i drawern —
 *  ingen träff betyder "skriv klart, så blir det en ny kund" (Wavys enda formulär). */
export async function searchCustomers(query: string): Promise<CustomerHit[]> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return []
  const q = query.trim()
  if (q.length < 2) return []

  const supabase = await createClient()
  const like = `%${q}%`
  const { data } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden, email, phone')
    .eq('tenant_id', tenant.id)
    // Dold kund (B-25) hittas inte i sök — det är vad "dold" betyder. Behöver man
    // hen ändå finns "Dolda kunder" på Kunder-sidan; bokningen går alltid via namn.
    .is('hidden_at', null)
    .or(`display_name.ilike.${like},full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    .limit(8)

  return (data ?? []).map((c) => ({
    id: c.id,
    // Samma maskningsregel som resten av adminen — ett dolt fullnamn läcker aldrig.
    name: resolveCustomerName(c),
    email: c.email,
    phone: c.phone,
  }))
}

export type MoveBookingState = { success?: string; error?: string }

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
}): Promise<MoveBookingState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }
  if (!input.bookingId || !input.staffId || Number.isNaN(Date.parse(input.startIso))) {
    return { error: 'Ogiltig flytt — ladda om och försök igen.' }
  }

  const supabase = await createClient()

  // Läs bokningens längd — den ska bevaras. Läsningen är RLS-fencad till egen tenant,
  // så en påhittad boknings-id kan aldrig träffa någon annans rad.
  const { data: current } = await supabase
    .from('bookings')
    .select('start_ts, end_ts, status')
    .eq('id', input.bookingId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Bokningen finns inte längre. Ladda om kalendern.' }
  if (current.status === 'cancelled' || current.status === 'no_show') {
    return { error: 'En avbokad tid kan inte flyttas. Skapa en ny bokning i stället.' }
  }

  const durationMs = new Date(current.end_ts).getTime() - new Date(current.start_ts).getTime()
  const start = new Date(input.startIso)
  const end = new Date(start.getTime() + durationMs)

  // goal-67 (belastningstest): statusvakten ovan LÄSER status, men läsningen och
  // skrivningen är två anrop. En bokning som avbokas i glappet flyttades ändå — bevisat
  // med samtidig avboka+flytta: slutstatus 'cancelled', och tiden hade ändå flyttats.
  // Vakten måste sitta i SKRIVNINGEN, inte bara framför den: `.in('status', …)` gör
  // UPDATE:n till en villkorad skrivning, så en avbokad rad matchar noll rader.
  const MOVABLE = ['pending', 'confirmed', 'completed'] as const
  const { data: moved, error } = await supabase
    .from('bookings')
    .update({
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      staff_id: input.staffId,
    })
    .eq('id', input.bookingId)
    .eq('tenant_id', tenant.id)
    .in('status', MOVABLE as unknown as string[])
    .select('id')

  // Noll rader utan fel = raden ändrade status under oss (avbokad/utebliven mitt i
  // draget). Inte ett tekniskt fel — ett kapplöpningsfall med ett ärligt svar.
  if (!error && (moved?.length ?? 0) === 0) {
    return { error: 'Tiden ändrades av någon annan just nu. Ladda om kalendern.' }
  }

  if (error) {
    // 23P01 = exclusion_violation → tiden krockar med en annan bokning. Originalet
    // ligger kvar orört; användaren får veta det och kan välja en annan tid.
    if (error.message.includes('no_double_booking') || error.code === '23P01') {
      return { error: 'Tiden krockar med en annan bokning. Bokningen ligger kvar där den var.' }
    }
    return { error: 'Flytten gick inte igenom. Bokningen ligger kvar där den var.' }
  }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: 'Bokningen är flyttad.' }
}

export type BlockState = { success?: string; error?: string }

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
  staffId: string
  startIso: string
  endIso: string
  reason: string
  repeat?: RepeatKind
}): Promise<BlockState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }

  const start = new Date(input.startIso)
  const end = new Date(input.endIso)
  if (!input.staffId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Ogiltig tid — ladda om och försök igen.' }
  }
  if (end <= start) return { error: 'Sluttiden måste vara efter starttiden.' }

  const repeat: RepeatKind = REPEAT_KINDS.includes(input.repeat as RepeatKind)
    ? (input.repeat as RepeatKind)
    : 'ingen'
  const occurrences = seriesOccurrences({
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    repeat,
    tz: tenant.timeZone,
  })
  const seriesId = occurrences.length > 1 ? crypto.randomUUID() : null
  const reason = input.reason.trim() || 'Blockerad'

  const supabase = await createClient()
  const { error } = await supabase.from('time_off').insert(
    occurrences.map((o) => ({
      tenant_id: tenant.id,
      staff_id: input.staffId,
      start_ts: o.startIso,
      end_ts: o.endIso,
      reason,
      series_id: seriesId,
    })),
  )
  if (error) return { error: 'Blockeringen gick inte att spara. Försök igen.' }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return {
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
export async function removeBlock(blockId: string, scope: 'en' | 'framat' = 'en'): Promise<BlockState> {
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) return { error: 'Inget företag är kopplat till ditt konto.' }
  if (!blockId) return { error: 'Ogiltig blockering.' }

  const supabase = await createClient()

  if (scope === 'framat') {
    // Läs den valda radens serie + start (RLS-fencad). Utan serie faller vi ner
    // till singel-borttagning — knappen ska aldrig kunna radera mer än den lovar.
    const { data: row } = await supabase
      .from('time_off')
      .select('series_id, start_ts')
      .eq('id', blockId)
      .eq('tenant_id', tenant.id)
      .maybeSingle()
    if (!row) return { error: 'Blockeringen finns inte längre.' }

    if (row.series_id) {
      const { data: gone, error } = await supabase
        .from('time_off')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('series_id', row.series_id)
        .gte('start_ts', row.start_ts)
        .select('id')
      if (error) return { error: 'Blockeringarna gick inte att ta bort. Försök igen.' }

      revalidatePath('/admin/bokningar')
      revalidatePath('/admin')
      return {
        success: `${gone?.length ?? 0} blockeringar borttagna — denna och alla framåt. Tidigare tillfällen ligger kvar.`,
      }
    }
  }

  const { error } = await supabase
    .from('time_off')
    .delete()
    .eq('id', blockId)
    .eq('tenant_id', tenant.id)
  if (error) return { error: 'Blockeringen gick inte att ta bort. Försök igen.' }

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')
  return { success: 'Blockeringen är borttagen — tiden går att boka igen.' }
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

  const hits = await searchCustomers(q)
  if (hits.length === 0) return []
  const byId = new Map(hits.map((h) => [h.id, h.name]))

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

  return (data ?? []).map((b) => {
    const row = b as unknown as {
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
      // Datumet måste vara salongens VÄGGKLOCKA, inte UTC: en tid 23:30 svensk tid
      // ligger på nästa UTC-datum, och då hade sökträffen hoppat till fel dag.
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

  if (!serviceId || !staffId || Number.isNaN(Date.parse(start))) {
    return { error: 'Ogiltig tid eller tjänst — ladda om och försök igen.' }
  }
  // Enda kravet: vi måste veta VEM tiden är för. Antingen en befintlig kund, eller
  // ett namn att skapa.
  if (!customerId && !guestName) {
    return { error: 'Skriv kundens namn — det är det enda som krävs.' }
  }

  const supabase = await createClient()

  // KUNDIDENTITET. RPC:ns p_customer är en AUTH-ANVÄNDARE (customer_profile_id) och dess
  // identitetsvakt kräver p_customer = auth.uid() — dvs "boka bara åt dig själv". Det är
  // rätt för publik självbokning, men admin bokar åt NÅGON ANNAN. `customerId` här är
  // dessutom en rad i `customers` (inte ett user-id), så att skicka den som p_customer gav
  // alltid `forbidden_customer` → bokningen föll. Lösning: skicka den valda kundens kontakt
  // som gäst-fält och lämna p_customer null. resolve_customer_id länkar då tillbaka till
  // SAMMA kundrad via contact_hash (e-post/telefon) — ingen dubblett, ingen vakt.
  let cName = guestName
  let cEmail = guestEmail
  let cPhone = guestPhone
  if (customerId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('display_name, full_name, email, phone')
      .eq('id', customerId)
      .eq('tenant_id', tenant.id)
      .maybeSingle<{
        display_name: string | null
        full_name: string | null
        email: string | null
        phone: string | null
      }>()
    if (!cust) return { error: 'Kunden hittades inte — ladda om och försök igen.' }
    cName = (cust.full_name?.trim() || cust.display_name?.trim() || guestName || 'Kund').trim()
    cEmail = cust.email?.trim() || ''
    cPhone = cust.phone?.trim() || ''
  }

  const { data: bookingId, error } = await supabase.rpc('create_public_booking', {
    p_tenant_slug: tenant.slug,
    p_service: serviceId,
    p_staff: staffId,
    p_location: locationId || undefined,
    p_start: start,
    // p_customer lämnas alltid null i admin-flödet (se ovan) — kunden länkas via kontakten.
    p_customer: undefined,
    p_guest_name: cName || undefined,
    p_guest_email: cEmail || undefined,
    p_guest_phone: cPhone || undefined,
    p_note: note || undefined,
    p_request_id: crypto.randomUUID(),
  })

  if (error || !bookingId) {
    const msg = error?.message ?? ''
    // Konflikten är ÄRLIG: någon annan hann före. Inmatningen ligger kvar i drawern
    // så användaren kan välja en annan tid utan att skriva om allt.
    if (msg.includes('no_double_booking') || error?.code === '23P01') {
      return { error: 'Tiden hann bli tagen. Välj en annan tid — dina uppgifter är kvar.' }
    }
    if (msg.includes('invalid_staff_location')) {
      return { error: 'Medarbetaren har inga tider på den platsen.' }
    }
    return { error: 'Bokningen gick inte igenom. Försök igen.' }
  }

  // Bokad av personalen = bekräftad. Kunden står framför dig eller ringde — det finns
  // inget att vänta på. (Publika självbokningar kan kräva godkännande; det är en
  // annan väg.)
  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('tenant_id', tenant.id)

  revalidatePath('/admin/bokningar')
  revalidatePath('/admin')

  // NOTISEN. Drawern har redan visat exakt vad som skulle skickas — nu måste det
  // faktiskt ske, annars ljuger UI:t. Valde användaren "Skicka inget" skickas inget.
  //
  // Skickas det: bokningen är ändå SPARAD. Ett trasigt mejlutskick får aldrig se ut
  // som en misslyckad bokning — vi säger sanningen om båda delarna var för sig.
  const wantsEmail = String(fd.get('notify') ?? '') === 'epost'
  if (!wantsEmail) {
    return { success: 'Bokningen är sparad. Inget meddelande skickades.', bookingId: String(bookingId) }
  }

  const { data: fresh } = await supabase
    .from('bookings')
    .select('start_ts, services(name), staff(title), customers(email)')
    .eq('id', bookingId)
    .eq('tenant_id', tenant.id)
    .maybeSingle<{
      start_ts: string
      services: { name: string } | null
      staff: { title: string | null } | null
      customers: { email: string | null } | null
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
        timeZone: tenant.timeZone,
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

  return { success: `Bokningen är sparad. Bekräftelse skickad till ${to}.`, bookingId: String(bookingId) }
}
