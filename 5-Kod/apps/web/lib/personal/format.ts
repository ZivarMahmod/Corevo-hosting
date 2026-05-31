// Display + small date helpers for the staff portal. Times always render in the
// location's timezone (never the server's). Calendar-date math is tz-independent.

/** 0 = Sunday … 6 = Saturday — matches working_hours.weekday / tz.weekdayOf. */
export const WEEKDAYS_SV = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

export function fmtTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export function fmtDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

/** Parse 'YYYY-MM-DD' into [year, month, day] numbers. */
function dateParts(dateStr: string): [number, number, number] {
  const [ys, ms, ds] = dateStr.split('-')
  return [Number(ys), Number(ms), Number(ds)]
}

/** Heading for a calendar date string, e.g. "Måndag 1 juni". */
export function fmtDateHeading(dateStr: string): string {
  const [y, m, d] = dateParts(dateStr)
  const at = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at)
}

/** 'YYYY-MM-DD' for a Date's UTC calendar date. */
export function ymdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Add n calendar days to a 'YYYY-MM-DD' string (tz-independent). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateParts(dateStr)
  return ymdUtc(new Date(Date.UTC(y, m - 1, d + n, 12, 0, 0)))
}

/** Monday of the ISO week containing dateStr. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateParts(dateStr)
  const dow = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay() // 0=Sun
  const offset = (dow + 6) % 7 // 0 = Monday
  return addDays(dateStr, -offset)
}

/** Today's calendar date in a given IANA timezone, as 'YYYY-MM-DD'. */
export function todayInTz(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date())
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ej bekräftad',
  confirmed: 'Bekräftad',
  completed: 'Genomförd',
  cancelled: 'Avbokad',
  no_show: 'Uteblev',
}
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

/** Guest contact rides bookings.note as "Gäst: <name> <<email>> <phone>" (G04). */
export function parseGuestName(note: string | null): string | null {
  if (!note) return null
  const m = /^Gäst:\s*(.+?)\s*</.exec(note)
  return m?.[1] ?? null
}
