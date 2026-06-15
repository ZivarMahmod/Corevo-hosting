// Webshop-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is imported by BOTH the server loader
// (load-shop.ts) AND the client CTA ('use client' ShopCta.tsx). It therefore must
// never import a 'server-only' module (e.g. the Supabase server client) — that
// would crash `next build` the moment a client component pulls a type from here.
// Only types + framework-agnostic helpers live here (same split as skin/types.ts).
//
// CONFIG-FIRST (beslut 14.5 / §15): the shop is ONE module with fulfilment
// VARIANTS, not a fork. The variant + its params live in tenant_modules.config;
// this module parses that jsonb into a typed ShopConfig the storefront can branch
// on. The DB tables (0032) are variant-agnostic; only presentation + the order
// snapshot differ per variant.

/** The three fulfilment variants (mirrors modules.variant_schema.fulfilment.enum
 *  in migration 0031 and the shop_orders.fulfilment CHECK in 0032). */
export const SHOP_FULFILMENTS = ['ship', 'pickup_within_days', 'order_in_then_pickup'] as const
export type ShopFulfilment = (typeof SHOP_FULFILMENTS)[number]

/** Human labels per variant (Swedish storefront copy). Kept here so the section
 *  and any admin reuse the same wording without a second source of truth. */
export const SHOP_FULFILMENT_LABELS: Record<ShopFulfilment, string> = {
  ship: 'Posta hem',
  pickup_within_days: 'Hämta i butik',
  order_in_then_pickup: 'Beställ hem till butik',
}

/** Parsed tenant_modules.config for the shop module. Defaults mirror 0031's
 *  default_config. `payment` is a PARKED hook — betal-rails are paused (beslut
 *  14.2); the storefront reads `payment.enabled` (always false today) and never
 *  renders a pay step. */
export type ShopConfig = {
  fulfilment: ShopFulfilment
  pickupDays: number
  leadDays: number
  currency: string
  /** Betal-hook — PAUSAD. enabled is false until rails open; provider is null. */
  payment: { provider: string | null; enabled: boolean }
}

/** One storefront-facing product (subset of shop_products needed to render). */
export type ShopProduct = {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  /** null = untracked (unlimited); 0 = sold out; >0 = in stock. */
  stock: number | null
  imageUrl: string | null
  imageAlt: string | null
}

/** Everything the ShopSection needs after the loader runs. */
export type ShopData = {
  config: ShopConfig
  products: ShopProduct[]
}

const DEFAULT_SHOP_CONFIG: ShopConfig = {
  fulfilment: 'ship',
  pickupDays: 3,
  leadDays: 7,
  currency: 'SEK',
  payment: { provider: null, enabled: false },
}

function asFulfilment(raw: unknown): ShopFulfilment {
  return (SHOP_FULFILMENTS as readonly string[]).includes(raw as string)
    ? (raw as ShopFulfilment)
    : DEFAULT_SHOP_CONFIG.fulfilment
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed ShopConfig.
 * Robust to missing/partial config (a freshly activated draft has only the 0031
 * default; a malformed row degrades to DEFAULT_SHOP_CONFIG). The payment hook is
 * always read as disabled unless an explicit `payment.enabled === true` appears —
 * and even then the storefront does not render a pay step (rails paused).
 */
export function parseShopConfig(raw: unknown): ShopConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SHOP_CONFIG }
  const src = raw as Record<string, unknown>
  const pay = (src.payment && typeof src.payment === 'object' ? src.payment : {}) as Record<
    string,
    unknown
  >
  return {
    fulfilment: asFulfilment(src.fulfilment),
    pickupDays: asPositiveInt(src.pickup_days, DEFAULT_SHOP_CONFIG.pickupDays),
    leadDays: asPositiveInt(src.lead_days, DEFAULT_SHOP_CONFIG.leadDays),
    currency: typeof src.currency === 'string' && src.currency ? src.currency : 'SEK',
    payment: {
      provider: typeof pay.provider === 'string' ? pay.provider : null,
      enabled: pay.enabled === true,
    },
  }
}

/** Format a minor-unit price (e.g. 14900) as a storefront string ("149 kr").
 *  Pure + currency-aware (SEK → "kr" suffix; otherwise ISO code prefix). */
export function formatShopPrice(cents: number, currency = 'SEK'): string {
  const major = (cents / 100).toLocaleString('sv-SE', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'SEK' ? `${major} kr` : `${major} ${currency}`
}

/** The short fulfilment promise shown under the shop header, derived from the
 *  resolved config + variant params. Pure — used by the server section. */
export function fulfilmentPromise(config: ShopConfig): string {
  switch (config.fulfilment) {
    case 'ship':
      return 'Vi postar hem din beställning.'
    case 'pickup_within_days':
      return `Handla online och hämta i butik inom ${config.pickupDays} ${
        config.pickupDays === 1 ? 'dag' : 'dagar'
      }.`
    case 'order_in_then_pickup':
      return `Beställ hem varan till butiken — klar för upphämtning inom ca ${config.leadDays} ${
        config.leadDays === 1 ? 'dag' : 'dagar'
      }.`
  }
}

/** Variant-aware CTA label for a product (what the button promises the buyer). */
export function shopCtaLabel(fulfilment: ShopFulfilment): string {
  switch (fulfilment) {
    case 'ship':
      return 'Lägg i kundvagn'
    case 'pickup_within_days':
      return 'Reservera för upphämtning'
    case 'order_in_then_pickup':
      return 'Beställ till butik'
  }
}
