// FLÖDE 2 billing model + faktureringsunderlag math (G08 / M7). Pure + unit-
// tested. Corevo invoices each salong manually; this computes the amount Zivar
// uses for its billing ledger. No Stripe calls or money movement live here.

import {
  formatTenantMoney,
  parseTenantMoneyInput,
  tenantMoneyInputValue,
} from '@/lib/tenant-region'

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

export function billingPeriod(
  yearValue: string | undefined,
  monthValue: string | undefined,
  now = new Date(),
): { year: number; month: number } {
  const year = Number(yearValue)
  const month = Number(monthValue)
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100
      ? year
      : previous.getUTCFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12
      ? month
      : previous.getUTCMonth() + 1,
  }
}

export function isClosedBillingPeriod(year: number, month: number, now = new Date()): boolean {
  return Number.isInteger(year)
    && Number.isInteger(month)
    && year >= 2000
    && year <= 2100
    && month >= 1
    && month <= 12
    && Date.UTC(year, month, 1) <= now.getTime()
}

export function isRetryableBillingDraft(status: string | null, errorCode: string | null): boolean {
  return Boolean(errorCode) && (status === null || status === 'draft')
}

// ── currency helpers (öre, Swedish), self-contained for the platform revir ──

/** öre → "1 234 kr" (sv-SE, no decimals). */
export function formatPrice(cents: number | null | undefined): string {
  return cents == null ? '–' : formatTenantMoney(cents)
}

export { parseTenantMoneyInput as kronorToCents }
export { tenantMoneyInputValue as centsToKronorInput }
