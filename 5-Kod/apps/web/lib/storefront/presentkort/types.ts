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
  /**
   * Beloppsvalen — KUNDENS EGNA, aldrig hårdkodade (goal-64). Designen visar
   * [300,500,750,1000] (calytrix), [600,800,1200,2000] (ateljevinter),
   * [500,900,1500,2500] (kalla) — tre kunder, tre listor.
   *
   * HELA KRONOR (inte ören) — se formatGiftPrice. TOM LISTA = kunden har inga belopp
   * konfigurerade → mallen visar inga belopp och ingen köpknapp. Det är ett giltigt
   * läge, inte ett fel att "laga" med defaults: en knapp utan ett lagligt belopp bakom
   * sig är en knapp som ljuger. Saknas nyckeln HELT faller vi tillbaka på 0036:s
   * default (bakåtkompatibelt — befintliga kunder tappar inga belopp).
   */
  amountPresets: number[]
  currency: string
  /** Promo headline shown in the section header. */
  headline: string
  /**
   * goal-64: kodserie-prefix. Blomstertorget: giftSerial: '1962-' + … → serien är
   * kundens, inte plattformens. Tom sträng = ren kod utan prefix.
   * Används av _generate_gift_code (0059) vid utfärdandet.
   */
  codePrefix: string
  /**
   * goal-64: leveransvalen köparen får se. Aurora ritar TVÅ
   * (giftModes = ['Digitalt','Inslaget i butik']), de flesta mallar bara ett.
   * Sätts av kunden (config.delivery_modes); utelämnad → härledd ur `fulfilment`,
   * så befintliga kunder är oförändrade.
   */
  deliveryModes: GiftDeliveryMode[]
  /** Betal-hook (legacy 0036). Betal-rälsen gatas numera av tenant_settings.payments_enabled
   *  + stripe_charges_enabled i confirm_shop_order — samma gate som produkter. */
  paymentEnabled: boolean
}

/**
 * Är beloppet ett av kundens EGNA? Ren spegling av vakten i reserve_shop_order (0059) —
 * samma regel, två lager. Klient-lagret är bekvämlighet (ingen knapp för ett belopp som
 * ändå skulle avvisas); SERVER-lagret är sanningen och kan inte förbigås.
 * Tom lista = inga belopp konfigurerade = INGET belopp är giltigt (aldrig "då är allt ok").
 */
export function isAllowedGiftAmount(config: PresentkortConfig, amount: number): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false
  return config.amountPresets.includes(amount)
}

/** Auroras giftModes = ['Digitalt','Inslaget i butik'] → gift_cards.delivery_mode (0057). */
export const GIFT_DELIVERY_MODES = ['digital', 'in_store'] as const
export type GiftDeliveryMode = (typeof GIFT_DELIVERY_MODES)[number]
export const GIFT_DELIVERY_LABELS: Record<GiftDeliveryMode, string> = {
  digital: 'Digitalt',
  in_store: 'Inslaget i butik',
}

/** Kundens leveransval, härlett ur den konfigurerade varianten (0036 fulfilment).
 *  physical → kortet hämtas i butik; digital → det mejlas. Ingen bransch-if. */
export function giftDeliveryModes(config: PresentkortConfig): GiftDeliveryMode[] {
  return config.fulfilment === 'physical' ? ['in_store'] : ['digital']
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
  codePrefix: '',
  deliveryModes: ['digital'],
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

/**
 * Coerce a raw jsonb value into a list of positive integer amounts (whole kronor).
 * Drops anything that is not a finite positive number.
 *
 * goal-64 — VIKTIG ÄNDRING: en TOM lista respekteras nu (den föll förut tillbaka på
 * defaulten). "Inga belopp" är kundens val och betyder att mallen inte visar några —
 * att smyga in [200,500,1000] där skulle rendera en köpknapp för ett belopp kunden
 * aldrig godkänt, och servern (0059) skulle ändå avvisa köpet. Bara en SAKNAD nyckel
 * ger defaulten, så befintliga kunder är oförändrade.
 */
function asPositiveIntArray(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback]
  return raw
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
    .map((n) => Math.floor(n))
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
  const fulfilment = asFulfilment(src.fulfilment)
  // `amounts` = goal-64:s nyckel; `amount_presets` = 0036:s. Läs den nya först, fall
  // tillbaka på den gamla — EXAKT samma prioritet som reserve_shop_order (0059), annars
  // kan mallen visa ett belopp som servern sedan vägrar sälja.
  const rawAmounts = src.amounts !== undefined ? src.amounts : src.amount_presets
  const rawModes = Array.isArray(src.delivery_modes)
    ? (src.delivery_modes as unknown[]).filter((m): m is GiftDeliveryMode =>
        (GIFT_DELIVERY_MODES as readonly string[]).includes(m as string),
      )
    : []
  return {
    fulfilment,
    amountPresets: asPositiveIntArray(rawAmounts, DEFAULT_PRESENTKORT_CONFIG.amountPresets),
    currency: typeof src.currency === 'string' && src.currency ? src.currency : 'SEK',
    headline: asNonEmptyString(src.headline, DEFAULT_PRESENTKORT_CONFIG.headline),
    codePrefix: typeof src.code_prefix === 'string' ? src.code_prefix.trim() : '',
    deliveryModes: rawModes.length > 0 ? rawModes : fulfilment === 'physical' ? ['in_store'] : ['digital'],
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
