import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { sanitizeBookingNote } from '@/lib/booking/note'
import { getCustomerId } from './customer'

// ── Customer booking reads ──────────────────────────────────────────────────
// SECURITY (two-layer, mirrors migration 0004's documented pattern):
//   · cross-tenant isolation  → the bookings_rls policy (tenant_id = the JWT's
//     private.tenant_id()) is a HARD fence; a kund of tenant A physically cannot
//     read tenant B's rows. This is the DoD's "tenant A ser ej tenant B".
//   · own-only, within a tenant → both the legacy customer_profile_id band and
//     the durable customer_id resolved from auth_user_id. The 0076 RLS policy and
//     these app filters enforce the same OR; privileged mutations re-check tenant,
//     booking id, active status and the same ownership pair.

export type KundBooking = {
  id: string
  status: string
  startTs: string
  endTs: string
  priceCents: number | null
  serviceId: string
  staffId: string
  serviceName: string | null
  staffTitle: string | null
  timeZone: string
  note: string | null
  customerId?: string | null
}

type BookingJoinRow = {
  id: string
  status: string
  start_ts: string
  end_ts: string
  price_cents: number | null
  service_id: string
  staff_id: string
  note: string | null
  customer_id: string | null
  services: { name: string } | null
  staff: { title: string | null } | null
  locations: { timezone: string } | null
}

const SELECT =
  'id, status, start_ts, end_ts, price_cents, service_id, staff_id, customer_id, note, ' +
  'services(name), staff(title), locations(timezone)'

function map(r: BookingJoinRow): KundBooking {
  return {
    id: r.id,
    status: r.status,
    startTs: r.start_ts,
    endTs: r.end_ts,
    priceCents: r.price_cents,
    serviceId: r.service_id,
    staffId: r.staff_id,
    serviceName: r.services?.name ?? null,
    staffTitle: r.staff?.title ?? null,
    timeZone: r.locations?.timezone ?? 'Europe/Stockholm',
    note: sanitizeBookingNote(r.note),
    customerId: r.customer_id,
  }
}

const ACTIVE_STATUSES = new Set(['pending', 'confirmed'])

export type MyBookings = { upcoming: KundBooking[]; past: KundBooking[] }

/**
 * All bookings belonging to the signed-in customer, split into upcoming
 * (active + not yet ended) and everything that needs a truthful outcome label.
 * `past` is not synonymous with visits: only status=completed is a visit.
 * The legacy profile id and claimed durable customer id both scope to this user.
 */
export async function getMyBookings(userId: string, tenantId: string): Promise<MyBookings> {
  const supabase = await createClient()
  const customerId = await getCustomerId(userId, tenantId)
  let query = supabase
    .from('bookings')
    .select(SELECT)
    .order('start_ts', { ascending: true })
  query = customerId
    ? query.or(`customer_profile_id.eq.${userId},customer_id.eq.${customerId}`)
    : query.eq('customer_profile_id', userId)
  const { data } = await query

  const rows = ((data ?? []) as unknown as BookingJoinRow[]).map(map)
  const now = Date.now()
  const upcoming: KundBooking[] = []
  const past: KundBooking[] = []
  for (const b of rows) {
    const isFuture = new Date(b.endTs).getTime() > now
    if (isFuture && ACTIVE_STATUSES.has(b.status)) upcoming.push(b)
    else past.push(b)
  }
  // History reads newest-first.
  past.sort((a, b) => (a.startTs < b.startTs ? 1 : -1))
  return { upcoming, past }
}

/** A single booking owned by the customer, or null (not found / not theirs). */
export async function getMyBooking(
  userId: string,
  tenantId: string,
  bookingId: string,
): Promise<KundBooking | null> {
  const supabase = await createClient()
  const customerId = await getCustomerId(userId, tenantId)
  let query = supabase
    .from('bookings')
    .select(SELECT)
    .eq('id', bookingId)
  query = customerId
    ? query.or(`customer_profile_id.eq.${userId},customer_id.eq.${customerId}`)
    : query.eq('customer_profile_id', userId)
  const { data } = await query.maybeSingle()
  const row = data as unknown as BookingJoinRow | null
  return row ? map(row) : null
}
