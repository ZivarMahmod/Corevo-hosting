export type OffertRequestRow = {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  mode: string
  subject: string | null
  message: string | null
  details: unknown
  estimate_cents: number | null
  currency: string
  status: string
  payment_status: string
  note: string | null
  created_at: string
}

export const OFFERT_STATUSES = [
  'new',
  'reviewing',
  'quoted',
  'accepted',
  'declined',
  'closed',
] as const

export type OffertStatus = (typeof OFFERT_STATUSES)[number]

export const OFFERT_STATUS_LABELS: Record<OffertStatus, string> = {
  new: 'Ny',
  reviewing: 'Granskas',
  quoted: 'Offererad',
  accepted: 'Accepterad',
  declined: 'Avböjd',
  closed: 'Stängd',
}

export const OFFERT_MODE_LABELS: Record<string, string> = {
  request_quote: 'Begär offert',
  estimate_form: 'Prisuppskattning',
  callback: 'Vi återkommer',
}

/** öre → "1 234 kr" (sv-SE, no decimals). */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency || 'SEK',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
