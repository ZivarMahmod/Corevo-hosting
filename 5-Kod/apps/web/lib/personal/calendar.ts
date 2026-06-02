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

/**
 * Midnight (00:00) of a calendar day in `timeZone`, as a UTC ISO string.
 *
 * Defensive: a broken tenant timezone (invalid IANA id) or a malformed dateStr
 * both make `zonedTimeToUtc` throw `RangeError` — the bad tz inside `Intl`, the
 * bad date when `.toISOString()` / `formatToParts` hits an Invalid Date. Rather
 * than let that bubble into the personal view as a crash, fall back to UTC
 * midnight for the same calendar date. This keeps the range query well-formed
 * (the view renders real-but-slightly-shifted data instead of throwing). The
 * normal flow never hits this path; it's a cheap guard, not a known crash.
 */
function midnightUtcIso(dateStr: string, timeZone: string): string {
  try {
    const d = zonedTimeToUtc(dateStr, '00:00', timeZone)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  } catch {
    // fall through to UTC fallback
  }
  // UTC fallback. Coerce each part so an entirely malformed dateStr (NaN parts)
  // can't make this path throw too — an unparseable year degrades to the epoch.
  const [ys, ms, ds] = dateStr.split('-')
  const y = Number.isFinite(Number(ys)) ? Number(ys) : 1970
  const m = Number.isFinite(Number(ms)) ? Number(ms) : 1
  const day = Number.isFinite(Number(ds)) ? Number(ds) : 1
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0)).toISOString()
}

/** UTC [from,to) for a calendar day in the given location timezone. */
export function dayRangeUtc(dateStr: string, timeZone: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: midnightUtcIso(dateStr, timeZone),
    toUtc: midnightUtcIso(addDays(dateStr, 1), timeZone),
  }
}

/** UTC [from,to) for the 7-day week starting at mondayStr, in the location tz. */
export function weekRangeUtc(mondayStr: string, timeZone: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: midnightUtcIso(mondayStr, timeZone),
    toUtc: midnightUtcIso(addDays(mondayStr, 7), timeZone),
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
