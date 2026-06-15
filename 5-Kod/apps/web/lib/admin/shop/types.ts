// Admin-shop types + pure helpers. PURE module: zero imports, no 'server-only',
// no 'use server'. Safe to import from client components (import type only) and
// server loaders/actions alike.

export type ShopProductRow = {
  id: string
  name: string
  slug: string | null
  description: string | null
  price_cents: number
  currency: string
  stock: number | null
  image_asset_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string | null
}

export type ShopOrderRow = {
  id: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  fulfilment: string
  status: string
  payment_status: string
  total_cents: number
  currency: string
  note: string | null
  created_at: string
}

/** DB CHECK values — do NOT change without a migration. */
export const SHOP_ORDER_STATUSES = [
  'pending',
  'confirmed',
  'ready',
  'completed',
  'cancelled',
] as const
export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number]

export const SHOP_ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  pending: 'Väntar',
  confirmed: 'Bekräftad',
  ready: 'Klar att hämta',
  completed: 'Slutförd',
  cancelled: 'Avbruten',
}

/**
 * Format a minor-unit price (e.g. 14900) as a Swedish-formatted string.
 * Pure + currency-aware (SEK → "kr" suffix; otherwise ISO code prefix).
 * Mirrors formatShopPrice in lib/storefront/shop/types.ts — kept as a
 * separate copy so this module has zero imports and remains a PUR file.
 */
export function formatCents(cents: number, currency = 'SEK'): string {
  const major = (cents / 100).toLocaleString('sv-SE', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'SEK' ? `${major} kr` : `${major} ${currency}`
}
