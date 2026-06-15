// Presentkort-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is the client-safe twin of the shop's
// lib/storefront/shop/types.ts, the blogg module's lib/storefront/blogg/types.ts and
// the lojalitet module's lib/storefront/lojalitet/types.ts: it may be imported by
// BOTH the server loader (load-presentkort.ts) AND any future 'use client' island
// (e.g. an interactive purchase widget). It therefore must NEVER import a
// 'server-only' module (the Supabase server client) — that crashes `next build` the
// moment a client component pulls a type from here. Only types + framework-agnostic
// helpers live here.
//
// CONFIG-FIRST (beslut 14.5 / §15): presentkort is ONE module with fulfilment
// VARIANTS, not a fork. The variant + its params live in tenant_modules.config;
// this module parses that jsonb into a typed PresentkortConfig the storefront can
// branch on. The DB table (gift_cards, 0036) is variant-agnostic; only presentation
// differs.
//
// ⚠ PAYMENT PARKED (compliance): a gift card touches money, but NO betal-rails are
// built (locked rule: no payment services without explicit OK). The `payment` hook
// is a PARKED hook — `paymentEnabled` is ALWAYS false until rails open; there is no
// provider, no purchase, no order. The storefront reads `paymentEnabled` (always
// false today) and never renders a pay step. This mirrors the shop's parked payment
// hook EXACTLY.

/** The two fulfilment variants (mirrors modules.variant_schema.fulfilment.enum in
 *  0036). */
export const PRESENTKORT_FULFILMENTS = ['digital', 'physical'] as const
export type PresentkortFulfilment = (typeof PRESENTKORT_FULFILMENTS)[number]

/** Human labels per variant (Swedish storefront copy). Single source of truth so
 *  the section and any admin reuse the same wording. */
export const PRESENTKORT_FULFILMENT_LABELS: Record<PresentkortFulfilment, string> = {
  digital: 'Digitalt (mejl)',
  physical: 'Fysiskt (hämtas)',
}

/** Parsed tenant_modules.config for the presentkort module. Defaults mirror 0036's
 *  default_config. `paymentEnabled` is a PARKED hook — betal-rails are paused
 *  (compliance); it is ALWAYS false until rails open and the storefront never
 *  renders a pay step (same shape as the shop's payment hook). */
export type PresentkortConfig = {
  fulfilment: PresentkortFulfilment
  /** Preset amounts shown as chips. WHOLE KRONOR (not cents) — see formatGiftPrice. */
  amountPresets: number[]
  currency: string
  /** Promo headline shown in the section header. */
  headline: string
  /** Betal-hook — PARKAD. false until rails open; there is no provider, no purchase. */
  paymentEnabled: boolean
}

/** Everything the PresentkortSection needs after the loader runs. Config only —
 *  the public surface is pure promo and never reads gift_cards (codes/balances are
 *  private; the promo needs no row). */
export type PresentkortData = {
  config: PresentkortConfig
}

const DEFAULT_PRESENTKORT_CONFIG: PresentkortConfig = {
  fulfilment: 'digital',
  amountPresets: [200, 500, 1000],
  currency: 'SEK',
  headline: 'Presentkort',
  paymentEnabled: false,
}

function asFulfilment(raw: unknown): PresentkortFulfilment {
  return (PRESENTKORT_FULFILMENTS as readonly string[]).includes(raw as string)
    ? (raw as PresentkortFulfilment)
    : DEFAULT_PRESENTKORT_CONFIG.fulfilment
}

function asNonEmptyString(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw ? raw : fallback
}

/** Coerce a raw jsonb value into a list of positive integer amounts (whole kronor).
 *  Drops anything that is not a finite positive number; falls back to the default
 *  presets when the result is empty or the input is not an array. */
function asPositiveIntArray(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback]
  const out = raw
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
    .map((n) => Math.floor(n))
  return out.length > 0 ? out : [...fallback]
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed
 * PresentkortConfig. Robust to missing/partial config (a freshly activated draft has
 * only the 0036 default; a malformed row degrades to DEFAULT_PRESENTKORT_CONFIG).
 * Reads the snake_case jsonb keys (amount_presets, currency, headline, payment.enabled)
 * exactly as written by the migration default_config. The payment hook is always read
 * as disabled unless an explicit `payment.enabled === true` appears — and even then
 * the storefront does not render a pay step (rails parked, compliance).
 */
export function parsePresentkortConfig(raw: unknown): PresentkortConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_PRESENTKORT_CONFIG }
  const src = raw as Record<string, unknown>
  const pay = (src.payment && typeof src.payment === 'object' ? src.payment : {}) as Record<
    string,
    unknown
  >
  return {
    fulfilment: asFulfilment(src.fulfilment),
    amountPresets: asPositiveIntArray(src.amount_presets, DEFAULT_PRESENTKORT_CONFIG.amountPresets),
    currency: typeof src.currency === 'string' && src.currency ? src.currency : 'SEK',
    headline: asNonEmptyString(src.headline, DEFAULT_PRESENTKORT_CONFIG.headline),
    paymentEnabled: pay.enabled === true,
  }
}

/** Format a WHOLE-KRONOR amount (e.g. 500) as a storefront string ("500 kr").
 *  ⚠ Unlike the shop's formatShopPrice (which takes minor units / cents), the
 *  presentkort amount_presets are stored as WHOLE KRONOR, so no /100 happens here.
 *  Pure + currency-aware (SEK → "kr" suffix; otherwise ISO code suffix). */
export function formatGiftPrice(amount: number, currency = 'SEK'): string {
  const major = amount.toLocaleString('sv-SE', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'SEK' ? `${major} kr` : `${major} ${currency}`
}

/** Human label for a fulfilment variant (Swedish). Pure — used by the server
 *  section and any admin reuse. */
export function presentkortFulfilmentLabel(fulfilment: PresentkortFulfilment): string {
  return PRESENTKORT_FULFILMENT_LABELS[fulfilment]
}
