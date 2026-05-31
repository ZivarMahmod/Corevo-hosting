// Tenant-timezone date math for the admin dashboard + bookings filters. Builds
// on the booking engine's pure zonedTimeToUtc so day/week windows line up with
// the UTC instants stored on bookings.start_ts.
import { zonedTimeToUtc } from '@/lib/booking/tz'

/** Today's calendar date ('YYYY-MM-DD') as seen in `timeZone`. */
export function todayInTz(timeZone: string, now = new Date()): string {
  // en-CA renders ISO YYYY-MM-DD; the tz pins it to the salon's local day.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** [start, end) UTC ISO instants spanning the local calendar day `date`. */
export function dayRangeUtc(date: string, timeZone: string): { fromUtc: string; toUtc: string } {
  const from = zonedTimeToUtc(date, '00:00', timeZone)
  const to = new Date(from.getTime() + 24 * 3_600_000)
  // Re-anchor `to` via wall-clock +1 day so 23h/25h DST days stay exact.
  const next = addDays(date, 1)
  return { fromUtc: from.toISOString(), toUtc: zonedTimeToUtc(next, '00:00', timeZone).toISOString() }
}

/** [Mon 00:00, next Mon 00:00) UTC window for the local week containing `date`. */
export function weekRangeUtc(date: string, timeZone: string): { fromUtc: string; toUtc: string } {
  const monday = mondayOf(date)
  const sunEnd = addDays(monday, 7)
  return {
    fromUtc: zonedTimeToUtc(monday, '00:00', timeZone).toISOString(),
    toUtc: zonedTimeToUtc(sunEnd, '00:00', timeZone).toISOString(),
  }
}

function ymd(date: string): { y: number; m: number; d: number } {
  const p = date.split('-')
  return { y: Number(p[0]), m: Number(p[1]), d: Number(p[2]) }
}

/** Add `n` whole days to a 'YYYY-MM-DD' date (UTC-noon anchored, DST-safe). */
export function addDays(date: string, n: number): string {
  const { y, m, d } = ymd(date)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

/** Monday ('YYYY-MM-DD') of the ISO week containing `date`. */
function mondayOf(date: string): string {
  const { y, m, d } = ymd(date)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const dow = dt.getUTCDay() // 0 = Sun
  const delta = dow === 0 ? -6 : 1 - dow
  return addDays(date, delta)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** Validate a 'YYYY-MM-DD' query param, rejecting normalised junk (2026-13-45). */
export function isValidDate(s: string | undefined | null): s is string {
  if (!s || !DATE_RE.test(s)) return false
  const { y, m, d } = ymd(s)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
