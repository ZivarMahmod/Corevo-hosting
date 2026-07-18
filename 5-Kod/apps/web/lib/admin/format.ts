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

/** Kunder v2-listan: senaste besök som mänsklig relativtid ("idag", "3 v sedan",
 *  "4 mån sedan"). Ren funktion (now injiceras) så den är testbar. Grov men ärlig:
 *  vecka = 7 dgr, månad = 30 dgr — för en registerlista räcker approximationen. */
export function relativeVisitSv(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'aldrig'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const days = Math.floor((now.getTime() - then) / 86_400_000)
  if (days <= 0) return 'idag'
  if (days === 1) return 'igår'
  if (days < 7) return `${days} dgr sedan`
  if (days < 60) return `${Math.floor(days / 7)} v sedan`
  return `${Math.floor(days / 30)} mån sedan`
}

/** Kunder v2: är senaste besök äldre än `days` dagar (inaktiv-filtret >3 mån)? */
export function isInactiveSince(iso: string | null, days = 90, now: Date = new Date()): boolean {
  if (!iso) return true
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return false
  return now.getTime() - then > days * 86_400_000
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
// Cancelled kan återställas till confirmed före originalstarten om ingen refund
// finns. Historiska utfall återöppnas däremot aldrig som aktiva: en felmarkering
// rättas direkt completed ↔ no_show så DB:n kan reversera/re-earn lojalitet atomiskt.
export const ALLOWED_FROM: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed'],
  confirmed: ['pending', 'cancelled'],
  completed: ['pending', 'confirmed', 'no_show'],
  no_show: ['pending', 'confirmed', 'completed'],
  cancelled: ['pending', 'confirmed'],
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
