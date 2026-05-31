// Display + small domain helpers for the salon-admin portal (G07). Self-contained
// so the admin revir does not couple to the kund/personal portals' own helpers.

/** öre → "1 234 kr" (Swedish currency, no decimals). */
export function formatPrice(cents: number | null): string {
  if (cents == null) return ''
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/** "1234,50" (kr) string from a form field → integer öre, or null if blank/invalid. */
export function kronorToCents(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** integer öre → "1234.50" for a kr-denominated <input>. */
export function centsToKronorInput(cents: number | null): string {
  if (cents == null) return ''
  return (cents / 100).toString()
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

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

/** working_hours.weekday: 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS_SV = [
  'Söndag',
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
] as const
