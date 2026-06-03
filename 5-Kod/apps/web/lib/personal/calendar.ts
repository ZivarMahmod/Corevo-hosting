import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays, parseGuestName } from './format'
import { resolveCustomerName } from './customer'

export type StaffBooking = {
  id: string
  status: string
  startTs: string
  endTs: string
  priceCents: number | null
  staffId: string
  serviceId: string | null
  serviceName: string | null
  /** NEW stable customer band (customers.id). null = guest/walk-in not linked. */
  customerId: string | null
  /** Resolved label for the row — never raw contact-PII (name/initial or "Kund"). */
  customerLabel: string
  /** The booking's own note (single shared bookings.note field), or null. */
  note: string | null
  timeZone: string
}

type BookingJoinRow = {
  id: string
  status: string
  start_ts: string
  end_ts: string
  price_cents: number | null
  staff_id: string
  service_id: string | null
  customer_id: string | null
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
 * fence; the staff_id filter gives own-only (NOT colleagues — see report).
 *
 * The row label is the customer's chosen NAME (display_name / initial via
 * resolveCustomerName), else the guest name parsed from the note for unlinked
 * walk-ins/guests, else "Kund". The raw guest email is NEVER used as a label
 * (FAS0 PII fix) — contact-PII is window-gated and fetched only on card open.
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
      'id, status, start_ts, end_ts, price_cents, staff_id, service_id, customer_id, note, services(name), locations(timezone)',
    )
    .in('staff_id', staffIds)
    .lt('start_ts', toUtc)
    .gt('end_ts', fromUtc)
    .order('start_ts', { ascending: true })

  const rows = (data ?? []) as unknown as BookingJoinRow[]

  // Resolve visible NAMES (not contact) for linked customers in one batched query.
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v))]
  const nameById = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: custs } = await supabase
      .from('customers')
      .select('id, display_name, full_name, name_hidden')
      .in('id', customerIds)
    for (const c of custs ?? []) nameById.set(c.id, resolveCustomerName(c))
  }

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    startTs: r.start_ts,
    endTs: r.end_ts,
    priceCents: r.price_cents,
    staffId: r.staff_id,
    serviceId: r.service_id,
    serviceName: r.services?.name ?? null,
    customerId: r.customer_id,
    customerLabel:
      (r.customer_id ? nameById.get(r.customer_id) : null) ??
      parseGuestName(r.note) ??
      'Kund',
    note: r.note,
    timeZone: r.locations?.timezone ?? 'Europe/Stockholm',
  }))
}

// ── Frisör "idag" list with recognition context (M5 §3) ──────────────────────
// The "idag" view wants each booking row to carry enough context for the frisör
// to recognise the customer: their preference chips (customer_notes.preferences,
// staff-readable via role_level>=3 RLS, 0011:563) + the booking note (the single
// shared bookings.note — the customer-channel message; NOT split into staff/kund,
// because the schema has no channel column). The internal staff note lives on
// customer_notes and is intentionally NOT folded into the row note here (keep the
// two channels distinct). Both enrichments are batched (one notes query for the
// whole day) on top of getBookingsInRange, so this stays a thin composition.

export type StaffScheduleEntry = StaffBooking & {
  /** Customer preference chips (staff-readable). [] when none / guest. */
  customerPrefs: string[]
  /** The booking's own note = customer-channel message (single shared field). */
  customerNote: string | null
}

/**
 * Own bookings in [fromUtc, toUtc) enriched with per-customer preference chips and
 * the booking note. Reuses getBookingsInRange for the booking band + name resolve,
 * then batches customer_notes.preferences for the day's linked customers in one
 * query. Guests (no customer_id) get [] prefs. Read-only; RLS tenant-fences both.
 */
export async function getStaffScheduleWithNotes(
  staffIds: string[],
  fromUtc: string,
  toUtc: string,
): Promise<StaffScheduleEntry[]> {
  const bookings = await getBookingsInRange(staffIds, fromUtc, toUtc)
  if (bookings.length === 0) return []

  // Batch the preference chips for every linked customer in the window.
  const customerIds = [...new Set(bookings.map((b) => b.customerId).filter((v): v is string => !!v))]
  const prefsById = new Map<string, string[]>()
  if (customerIds.length > 0) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('customer_notes')
      .select('customer_id, preferences')
      .in('customer_id', customerIds)
    for (const n of (data ?? []) as { customer_id: string; preferences: string[] | null }[]) {
      prefsById.set(n.customer_id, n.preferences ?? [])
    }
  }

  return bookings.map((b) => ({
    ...b,
    customerPrefs: (b.customerId ? prefsById.get(b.customerId) : null) ?? [],
    // bookings.note is the single shared note (no channel column) — treated as the
    // customer-channel message. Distinct from customer_notes (staff-internal).
    customerNote: b.note,
  }))
}
