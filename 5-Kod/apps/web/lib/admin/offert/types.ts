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
  reply_message: string | null
  replied_at: string | null
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

/**
 * Status-FSM (goal-54 körning 3, A4): tillåtna övergångar per nuvarande status —
 * samma mönster som bokningarnas ALLOWED_FROM. Samma status = no-op (tillåtet).
 * En okänd/legacy nuvarande status får bara stängas (→ closed).
 */
export const OFFERT_ALLOWED_FROM: Record<OffertStatus, readonly OffertStatus[]> = {
  new: ['reviewing', 'quoted', 'declined', 'closed'],
  reviewing: ['quoted', 'declined', 'closed'],
  quoted: ['accepted', 'declined', 'closed'],
  accepted: ['closed'],
  declined: ['closed'],
  closed: [],
}

/** Pure transition check — the single source both the action and tests use. */
export function offertTransitionAllowed(from: string, to: OffertStatus): boolean {
  if (from === to) return true
  if (!(OFFERT_STATUSES as readonly string[]).includes(from)) return to === 'closed'
  return OFFERT_ALLOWED_FROM[from as OffertStatus].includes(to)
}

/**
 * Får förfrågan raderas? Syftet med radering är att RENSA SPAM — inte att kunna
 * radera bort en affär ur historiken.
 *
 * "Har blivit en order" — vad betyder det i det HÄR schemat? Det finns INGEN
 * FK offert_requests → shop_orders (0032 shop_orders bär ingen offert-koppling,
 * 0033 offert_requests bär ingen order-koppling). Kopplingen finns alltså inte i
 * DB:n att kontrollera. De två signaler schemat FAKTISKT bär är:
 *
 *   • status = 'accepted'      → kunden har tackat ja. Affären är sluten; det här
 *                                är offert-modulens motsvarighet till en order.
 *   • payment_status ≠ 'unpaid' → pengar har rört raden ('paid' | 'refunded').
 *                                Rör aldrig en rad som pengar tagit i.
 *
 * Allt annat (new/reviewing/quoted/declined/closed med payment_status='unpaid')
 * är raderbart — det är där spammen bor.
 *
 * OBS medvetet val: 'closed' blockeras INTE på status allena. 'closed' nås från
 * ALLA lägen (även new → closed, dvs "stängde skräpet"), så ett status-block på
 * 'closed' skulle göra just spammen oraderbar. En accepterad affär som sedan
 * stängts skyddas i praktiken av payment_status när pengar rört den.
 *
 * ENDA SANNINGEN: både DeleteSection (UI) och deleteOffertRequest (server) går
 * genom den här — samma mönster som offertTransitionAllowed.
 */
export function offertDeletable(status: string, paymentStatus: string): boolean {
  if (status === 'accepted') return false
  if (paymentStatus !== 'unpaid') return false
  return true
}

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
