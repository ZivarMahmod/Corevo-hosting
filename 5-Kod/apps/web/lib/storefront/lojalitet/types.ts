// Lojalitet-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is the client-safe twin of the shop's
// lib/storefront/shop/types.ts and the blogg module's lib/storefront/blogg/types.ts:
// it may be imported by BOTH the server loader (load-lojalitet.ts) AND any future
// 'use client' island (e.g. an interactive membership widget). It therefore must
// NEVER import a 'server-only' module (the Supabase server client) — that crashes
// `next build` the moment a client component pulls a type from here. Only types +
// framework-agnostic helpers live here.
//
// CONFIG-FIRST (beslut 14.5 / §15): lojalitet is ONE module with presentation
// VARIANTS, not a fork. The variant + its params live in tenant_modules.config;
// this module parses that jsonb into a typed LojalitetConfig the storefront can
// branch on. The DB table (loyalty_ledger, 0016 — pre-existing, untouched) is
// variant-agnostic; only presentation differs.
//
// NO PAYMENT (unlike shop/offert): loyalty points never touch direct money, so
// there is no payment hook here at all — nothing to park.

/** The two presentation variants (mirrors modules.variant_schema.variant.enum in
 *  0035). */
export const LOJALITET_VARIANTS = ['points', 'stamp_card'] as const
export type LojalitetVariant = (typeof LOJALITET_VARIANTS)[number]

/** Human labels per variant (Swedish storefront copy). Single source of truth so
 *  the section and any admin reuse the same wording. */
export const LOJALITET_VARIANT_LABELS: Record<LojalitetVariant, string> = {
  points: 'Poäng',
  stamp_card: 'Stämpelkort',
}

/** Parsed tenant_modules.config for the lojalitet module. Defaults mirror 0035's
 *  default_config. No payment hook — loyalty never renders a pay step. */
export type LojalitetConfig = {
  variant: LojalitetVariant
  /** Points earned per visit (used by the 'points' variant copy). */
  pointsPerVisit: number
  /** Number of stamps to fill the card (used by the 'stamp_card' variant). */
  stampGoal: number
  /** Promo headline shown in the section header. */
  headline: string
  /** Short perk/benefit copy shown under the headline. */
  perkText: string
}

/** Everything the LojalitetSection needs after the loader runs. */
export type LojalitetData = {
  config: LojalitetConfig
}

const DEFAULT_LOJALITET_CONFIG: LojalitetConfig = {
  variant: 'points',
  pointsPerVisit: 50,
  stampGoal: 10,
  headline: 'Bli stammis',
  perkText: 'Tjäna poäng varje besök och få förmåner.',
}

function asVariant(raw: unknown): LojalitetVariant {
  return (LOJALITET_VARIANTS as readonly string[]).includes(raw as string)
    ? (raw as LojalitetVariant)
    : DEFAULT_LOJALITET_CONFIG.variant
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

function asNonEmptyString(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw ? raw : fallback
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed
 * LojalitetConfig. Robust to missing/partial config (a freshly activated draft has
 * only the 0035 default; a malformed row degrades to DEFAULT_LOJALITET_CONFIG).
 * Reads the snake_case jsonb keys (points_per_visit, stamp_goal, headline,
 * perk_text) exactly as written by the migration default_config.
 */
export function parseLojalitetConfig(raw: unknown): LojalitetConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_LOJALITET_CONFIG }
  const src = raw as Record<string, unknown>
  return {
    variant: asVariant(src.variant),
    pointsPerVisit: asPositiveInt(src.points_per_visit, DEFAULT_LOJALITET_CONFIG.pointsPerVisit),
    stampGoal: asPositiveInt(src.stamp_goal, DEFAULT_LOJALITET_CONFIG.stampGoal),
    headline: asNonEmptyString(src.headline, DEFAULT_LOJALITET_CONFIG.headline),
    perkText: asNonEmptyString(src.perk_text, DEFAULT_LOJALITET_CONFIG.perkText),
  }
}

/** Human label for a variant (Swedish). Pure — used by the server section and any
 *  admin reuse. */
export function lojalitetVariantLabel(variant: LojalitetVariant): string {
  return LOJALITET_VARIANT_LABELS[variant]
}
