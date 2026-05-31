// Timezone helpers for the booking engine. Pure + dependency-free (Intl only),
// so they run in Node tests, the Next server runtime, and Cloudflare Workers
// (which ship full ICU). DB stores UTC; the salon's working hours are wall-clock
// times in the location's IANA timezone (e.g. Europe/Stockholm, DST-aware).

/**
 * UTC offset (ms) of `timeZone` at the given instant. Computed by asking Intl
 * what wall-clock time the instant maps to in the zone, then diffing against the
 * same components read as if they were UTC.
 */
function offsetMsAt(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '0'
  // Intl can emit '24' for midnight in hour12:false mode — normalise to 0.
  const hour = get('hour') === '24' ? '0' : get('hour')
  const asUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(hour),
    Number(get('minute')),
    Number(get('second')),
  )
  return asUtc - instant.getTime()
}

/**
 * Convert a wall-clock date + time in `timeZone` to the exact UTC instant.
 * Two-pass so a DST transition (where the naive offset and the real offset
 * differ) resolves correctly.
 *
 *   zonedTimeToUtc('2026-07-15', '09:00', 'Europe/Stockholm') // → 07:00Z (CEST)
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [ys, mos, ds] = date.split('-')
  const [hs, mis, ss] = time.split(':')
  const y = Number(ys)
  const mo = Number(mos)
  const d = Number(ds)
  const h = Number(hs)
  const mi = Number(mis)
  const s = ss ? Number(ss) : 0
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  // First guess from the offset at the naive instant, then refine once using the
  // offset at the resulting instant (correct across spring-forward/fall-back).
  let utc = wallAsUtc - offsetMsAt(new Date(wallAsUtc), timeZone)
  utc = wallAsUtc - offsetMsAt(new Date(utc), timeZone)
  return new Date(utc)
}

/**
 * Day-of-week of a calendar date, 0 = Sunday … 6 = Saturday — matching
 * `working_hours.weekday`. Anchored at noon UTC so no timezone/DST edge can
 * shift it (a calendar date is timezone-independent).
 */
export function weekdayOf(date: string): number {
  const [ys, mos, ds] = date.split('-')
  return new Date(Date.UTC(Number(ys), Number(mos) - 1, Number(ds), 12, 0, 0)).getUTCDay()
}
