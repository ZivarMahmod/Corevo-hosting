import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays, parseGuestName } from './format'

export type StaffBooking = {
  id: string
  status: string
  startTs: string
  endTs: string
  priceCents: number | null
  staffId: string
  serviceName: string | null
  customerLabel: string
  timeZone: string
}

type BookingJoinRow = {
  id: string
  status: string
  start_ts: string
  end_ts: string
  price_cents: number | null
  staff_id: string
  customer_profile_id: string | null
  note: string | null
  services: { name: string } | null
  locations: { timezone: string } | null
}

/** UTC [from,to) for a calendar day in the given location timezone. */
export function dayRangeUtc(dateStr: string, timeZone: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: zonedTimeToUtc(dateStr, '00:00', timeZone).toISOString(),
    toUtc: zonedTimeToUtc(addDays(dateStr, 1), '00:00', timeZone).toISOString(),
  }
}

/** UTC [from,to) for the 7-day week starting at mondayStr, in the location tz. */
export function weekRangeUtc(mondayStr: string, timeZone: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: zonedTimeToUtc(mondayStr, '00:00', timeZone).toISOString(),
    toUtc: zonedTimeToUtc(addDays(mondayStr, 7), '00:00', timeZone).toISOString(),
  }
}

/**
 * Own bookings in [fromUtc, toUtc) for the given staff ids. RLS gives the tenant
 * fence; the staff_id filter gives own-only (NOT colleagues — see report). The
 * customer label is the guest name parsed from note, else the linked customer's
 * email, else "Kund".
 */
export async function getBookingsInRange(
  staffIds: string[],
  fromUtc: string,
  toUtc: string,
): Promise<StaffBooking[]> {
  if (staffIds.length === 0) return []
  const supabase = await createClient()

  const { data } = await supabase
    .from('bookings')
    .select(
      'id, status, start_ts, end_ts, price_cents, staff_id, customer_profile_id, note, services(name), locations(timezone)',
    )
    .in('staff_id', staffIds)
    .lt('start_ts', toUtc)
    .gt('end_ts', fromUtc)
    .order('start_ts', { ascending: true })

  const rows = (data ?? []) as unknown as BookingJoinRow[]

  // Resolve names for customer-linked (non-guest) bookings via users.email.
  const customerIds = [...new Set(rows.map((r) => r.customer_profile_id).filter((v): v is string => !!v))]
  const emailById = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, email').in('id', customerIds)
    for (const u of users ?? []) if (u.email) emailById.set(u.id, u.email)
  }

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    startTs: r.start_ts,
    endTs: r.end_ts,
    priceCents: r.price_cents,
    staffId: r.staff_id,
    serviceName: r.services?.name ?? null,
    customerLabel:
      parseGuestName(r.note) ??
      (r.customer_profile_id ? emailById.get(r.customer_profile_id) ?? 'Kund' : 'Kund'),
    timeZone: r.locations?.timezone ?? 'Europe/Stockholm',
  }))
}
