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

// Allowed SOURCE statuses per TARGET for an admin status change (setBookingStatus).
// An admin may move a booking INTO a status only from one of the listed sources;
// an empty source list ⇒ unreachable. Re-saving the current status is a no-op
// handled in the action, not via this matrix.
//
// `cancelled` was the one non-revivable terminal state, because cancelling refunds
// the payment and reviving a refunded booking would desync Stripe. B-24 (ångraloggen)
// opens `cancelled → confirmed` — but the refund invariant is NOT dropped, it moves
// to where it can actually be checked: setBookingStatus refuses the restore when a
// payment was refunded. The matrix cannot see money; the action can.
export const ALLOWED_FROM: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'completed', 'no_show'],
  confirmed: ['pending', 'completed', 'no_show', 'cancelled'],
  completed: ['pending', 'confirmed'],
  no_show: ['pending', 'confirmed'],
  cancelled: ['pending', 'confirmed', 'completed', 'no_show'],
}

/** Refund-vakten (B-24): en ÅTERBETALD bokning får aldrig väckas — då skulle systemet
 *  påstå "betald" om en tid kunden fått pengarna tillbaka för. Ren funktion så
 *  invarianten är testbar utan databas; setBookingStatus är enda anroparen. */
export function restoreBlockedByRefund(
  currentStatus: string,
  paymentStatus: string | null | undefined,
): boolean {
  return currentStatus === 'cancelled' && paymentStatus === 'refunded'
}

/** Avbokningsspåret (B-24): vad som ska skrivas på bookings-raden vid en statusändring.
 *  In i cancelled → stämpla när+vem. Ut ur cancelled → NOLLA spåret (annars ligger
 *  bokningen kvar i ångraloggen fast den är aktiv igen). Övriga övergångar rör det inte. */
export function cancellationTrace(
  currentStatus: string,
  targetStatus: string,
  now = new Date(),
): { cancelled_at: string | null; cancelled_by: string | null } | Record<string, never> {
  if (targetStatus === 'cancelled')
    return { cancelled_at: now.toISOString(), cancelled_by: 'business' }
  if (currentStatus === 'cancelled') return { cancelled_at: null, cancelled_by: null }
  return {}
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
