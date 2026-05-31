import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ── Customer booking reads ──────────────────────────────────────────────────
// SECURITY (two-layer, mirrors migration 0004's documented pattern):
//   · cross-tenant isolation  → the bookings_rls policy (tenant_id = the JWT's
//     private.tenant_id()) is a HARD fence; a kund of tenant A physically cannot
//     read tenant B's rows. This is the DoD's "tenant A ser ej tenant B".
//   · own-only, within a tenant → an APP-LAYER filter .eq('customer_profile_id',
//     user.id). The authenticated bookings RLS is tenant-wide (it must be, for
//     staff/admin), so the per-customer scope is enforced here AND re-checked in
//     every mutating action. (A role-aware RLS policy that pins kund to their own
//     rows is flagged as a follow-up migration — out of scope this wave.)

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
  services: { name: string } | null
  staff: { title: string | null } | null
  locations: { timezone: string } | null
}

const SELECT =
  'id, status, start_ts, end_ts, price_cents, service_id, staff_id, note, ' +
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
    note: r.note,
  }
}

const ACTIVE_STATUSES = new Set(['pending', 'confirmed'])

export type MyBookings = { upcoming: KundBooking[]; past: KundBooking[] }

/**
 * All bookings belonging to the signed-in customer, split into upcoming
 * (active + not yet ended) and history. RLS scopes to the tenant; the
 * customer_profile_id filter scopes to this customer.
 */
export async function getMyBookings(userId: string): Promise<MyBookings> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(SELECT)
    .eq('customer_profile_id', userId)
    .order('start_ts', { ascending: true })

  const rows = ((data ?? []) as unknown as BookingJoinRow[]).map(map)
  const now = Date.now()
  const upcoming: KundBooking[] = []
  const past: KundBooking[] = []
  for (const b of rows) {
    const isFuture = new Date(b.endTs).getTime() >= now
    if (isFuture && ACTIVE_STATUSES.has(b.status)) upcoming.push(b)
    else past.push(b)
  }
  // History reads newest-first.
  past.sort((a, b) => (a.startTs < b.startTs ? 1 : -1))
  return { upcoming, past }
}

/** A single booking owned by the customer, or null (not found / not theirs). */
export async function getMyBooking(userId: string, bookingId: string): Promise<KundBooking | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select(SELECT)
    .eq('id', bookingId)
    .eq('customer_profile_id', userId)
    .maybeSingle()
  const row = data as unknown as BookingJoinRow | null
  return row ? map(row) : null
}
