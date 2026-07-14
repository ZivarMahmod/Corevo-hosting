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
  // `to` is the wall-clock next-midnight (not +24h) so 23h/25h DST days stay exact.
  const from = zonedTimeToUtc(date, '00:00', timeZone)
  const to = zonedTimeToUtc(addDays(date, 1), '00:00', timeZone)
  return { fromUtc: from.toISOString(), toUtc: to.toISOString() }
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

/** [Mon 00:00, Mon 00:00) UTC-fönster som täcker HELA månadsrutnätet för `date` —
 *  alltså från måndagen i veckan där den 1:a ligger, till måndagen efter månadens
 *  sista dag. Kalendern ritar ett 7-kolumnersrutnät; randdagarna hör till grannmånaden
 *  men ska visa sina bokningar, annars ser rutnätet trasigt ut (goal-66). */
export function monthGridRangeUtc(
  date: string,
  timeZone: string,
): { fromUtc: string; toUtc: string; firstDay: string; lastDay: string } {
  const { y, m } = ymd(date)
  const firstDay = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  // Dag 0 i nästa månad = sista dagen i denna.
  const lastDate = new Date(Date.UTC(y, m, 0, 12, 0, 0))
  const lastDay = lastDate.toISOString().slice(0, 10)
  const gridStart = mondayOf(firstDay)
  const gridEnd = addDays(mondayOf(lastDay), 7)
  return {
    fromUtc: zonedTimeToUtc(gridStart, '00:00', timeZone).toISOString(),
    toUtc: zonedTimeToUtc(gridEnd, '00:00', timeZone).toISOString(),
    firstDay,
    lastDay,
  }
}

/** Måndagen ('YYYY-MM-DD') i veckan som innehåller `date`. */
export function mondayOfDate(date: string): string {
  return mondayOf(date)
}

/** Lägg till `n` månader på en 'YYYY-MM-DD' (klampas till månadens sista dag —
 *  31 jan + 1 månad = 28/29 feb, aldrig ett överspill till mars). */
export function addMonths(date: string, n: number): string {
  const { y, m, d } = ymd(date)
  const target = new Date(Date.UTC(y, m - 1 + n, 1, 12, 0, 0))
  const daysInTarget = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(d, daysInTarget))
  return target.toISOString().slice(0, 10)
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
