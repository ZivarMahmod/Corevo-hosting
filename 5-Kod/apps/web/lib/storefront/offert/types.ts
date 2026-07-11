// Offert-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is the client-safe twin of the shop's
// lib/storefront/shop/types.ts: it may be imported by BOTH the server loader
// (load-offert.ts) AND any future 'use client' island (e.g. an interactive offert
// form). It therefore must NEVER import a 'server-only' module (the Supabase server
// client) — that crashes `next build` the moment a client component pulls a type
// from here. Only types + framework-agnostic helpers live here.
//
// CONFIG-FIRST (beslut 14.5 / §15): offert is ONE module with intake VARIANTS, not
// a fork. The variant + its params live in tenant_modules.config; this module parses
// that jsonb into a typed OffertConfig the storefront can branch on. The DB table
// (0033) is variant-agnostic; only presentation + the request snapshot differ.

/** The three intake variants (mirrors modules.variant_schema.mode.enum in 0033 and
 *  the offert_requests.mode CHECK in 0033). */
export const OFFERT_MODES = ['request_quote', 'estimate_form', 'callback'] as const
export type OffertMode = (typeof OFFERT_MODES)[number]

/** Human labels per variant (Swedish storefront copy). Single source of truth so
 *  the section and any admin reuse the same wording. */
export const OFFERT_MODE_LABELS: Record<OffertMode, string> = {
  request_quote: 'Begär offert',
  estimate_form: 'Prisuppskattning',
  callback: 'Vi återkommer',
}

/** Parsed tenant_modules.config for the offert module. Defaults mirror 0033's
 *  default_config. `payment` is a PARKED hook — betal-rails are paused (beslut
 *  14.2); an offert is an underlag and never renders a pay step. */
export type OffertConfig = {
  mode: OffertMode
  /** Promised response time (days) for estimate_form / callback. */
  responseDays: number
  currency: string
  /** Snabbval-ämnen ("Vad gäller det?"-chips) — config-styrda per kund/bransch
   *  (t.ex. florist: Bröllop/Begravning/Event). Tom lista = inga chips, fritext. */
  subjects: string[]
  /** Betal-hook — PAUSAD. enabled is false until rails open; provider is null. */
  payment: { provider: string | null; enabled: boolean }
}

/** Everything the OffertSection needs after the loader runs. */
export type OffertData = {
  config: OffertConfig
}

const DEFAULT_OFFERT_CONFIG: OffertConfig = {
  mode: 'request_quote',
  responseDays: 2,
  currency: 'SEK',
  subjects: [],
  payment: { provider: null, enabled: false },
}

function asMode(raw: unknown): OffertMode {
  return (OFFERT_MODES as readonly string[]).includes(raw as string)
    ? (raw as OffertMode)
    : DEFAULT_OFFERT_CONFIG.mode
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed OffertConfig.
 * Robust to missing/partial config (a freshly activated draft has only the 0033
 * default; a malformed row degrades to DEFAULT_OFFERT_CONFIG). The payment hook is
 * always read as disabled unless an explicit `payment.enabled === true` appears —
 * and even then the storefront does not render a pay step (rails paused).
 */
export function parseOffertConfig(raw: unknown): OffertConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_OFFERT_CONFIG }
  const src = raw as Record<string, unknown>
  const pay = (src.payment && typeof src.payment === 'object' ? src.payment : {}) as Record<
    string,
    unknown
  >
  return {
    mode: asMode(src.mode),
    responseDays: asPositiveInt(src.response_days, DEFAULT_OFFERT_CONFIG.responseDays),
    currency: typeof src.currency === 'string' && src.currency ? src.currency : 'SEK',
    subjects: Array.isArray(src.subjects)
      ? src.subjects
          .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
          .map((s) => s.trim().slice(0, 60))
          .slice(0, 8)
      : [],
    payment: {
      provider: typeof pay.provider === 'string' ? pay.provider : null,
      enabled: pay.enabled === true,
    },
  }
}

/** The short promise shown under the offert header, derived from the resolved
 *  config + variant. Pure — used by the server section. */
export function offertPromise(config: OffertConfig): string {
  const days = `${config.responseDays} ${config.responseDays === 1 ? 'dag' : 'dagar'}`
  switch (config.mode) {
    case 'request_quote':
      return 'Beskriv ditt behov så återkommer vi med en offert utan kostnad.'
    case 'estimate_form':
      return `Fyll i formuläret för en prisuppskattning — vi bekräftar inom ${days}.`
    case 'callback':
      return `Lämna dina uppgifter så hör vi av oss inom ${days}.`
  }
}

/** Variant-aware submit-label for the offert form (what the button promises). */
export function offertCtaLabel(mode: OffertMode): string {
  switch (mode) {
    case 'request_quote':
      return 'Skicka förfrågan'
    case 'estimate_form':
      return 'Få prisuppskattning'
    case 'callback':
      return 'Be oss ringa upp'
  }
}

/** Discriminated state for the anonymous offert intake (useActionState). PURE — the
 *  'use client' island imports this; it must therefore stay free of any I/O. */
export type OffertSubmitState =
  | { phase: 'idle' }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

export const OFFERT_SUBMIT_INITIAL: OffertSubmitState = { phase: 'idle' }
