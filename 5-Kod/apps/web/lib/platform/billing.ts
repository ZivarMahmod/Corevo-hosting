// FLÖDE 2 billing model + faktureringsunderlag math (G08 / M7). Pure + unit-
// tested. Corevo invoices each salong manually; this computes the amount Zivar
// reads off the platform billing view. No Stripe, no money movement here.

export const BILLING_MODELS = ['per_booking', 'flat_monthly'] as const
export type BillingModel = (typeof BILLING_MODELS)[number]

export function isBillingModel(v: string): v is BillingModel {
  return (BILLING_MODELS as readonly string[]).includes(v)
}

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  per_booking: 'Per bokning',
  flat_monthly: 'Fast månadsavgift',
}

export type BillingInputs = {
  billingModel: string
  /** completed bookings in the calendar month (excl. cancelled/no_show). */
  completedBookings: number
  perBookingFeeCents: number
  flatMonthlyFeeCents: number
}

/**
 * Monthly invoiceable amount (öre) for one tenant:
 *   per_booking  → completedBookings × per_booking_fee
 *   flat_monthly → flat_monthly_fee  (independent of volume)
 * Negative/garbage inputs are floored to 0 so the underlag never goes negative.
 */
export function monthlyFeeCents(input: BillingInputs): number {
  const flat = Math.max(0, Math.trunc(input.flatMonthlyFeeCents))
  const per = Math.max(0, Math.trunc(input.perBookingFeeCents))
  const n = Math.max(0, Math.trunc(input.completedBookings))
  if (input.billingModel === 'flat_monthly') return flat
  return n * per // default = per_booking
}

// ── currency helpers (öre, Swedish), self-contained for the platform revir ──

/** öre → "1 234 kr" (sv-SE, no decimals). */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '–'
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/** "1234,50" (kr) form field → integer öre, or null if blank/invalid. */
export function kronorToCents(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** integer öre → "1234.5" for a kr-denominated <input>. */
export function centsToKronorInput(cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toString()
}

/** YYYY-MM label for a Date in a given month offset, e.g. "2026-06". */
export function monthKey(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}`
}
