// Pure types + helpers for the loyalty (lojalitet) customer-admin surface.
// READ-ONLY module: the admin VIEWS the program (config + earned points) but never
// edits config (super-admin-locked) nor writes loyalty_ledger (the booking flow does
// that, reason='earn_completed'). No imports — keep this leaf pure so it is safe in a
// server component as well as the 'server-only' data layer.

export type LoyaltyVariant = 'points' | 'stamp_card'

/** tenant_modules.config for lojalitet, normalised to camelCase with safe fallbacks. */
export type LoyaltyConfig = {
  variant: LoyaltyVariant
  headline: string
  perkText: string
  /** Stamps needed for the perk (stamp_card variant). */
  stampGoal: number
  /** Points awarded per completed visit (points variant + stamp derivation). */
  pointsPerVisit: number
}

/** One aggregated loyalty member row (derived from loyalty_ledger, never stored). */
export type LoyaltyMemberRow = {
  customerId: string
  /** Privacy-preserving shown name (never a hidden full name); null when unknown. */
  customerName: string | null
  /** Signed sum of points_delta — the real balance (can be 0, never faked). */
  pointsBalance: number
  /** Number of ledger rows with reason='earn_completed' (≈ rewarded visits). */
  visits: number
  /** Most recent ledger created_at for this customer, or null. */
  lastActivityAt: string | null
}

/** One recent loyalty ledger entry, joined to a shown customer name. */
export type LoyaltyActivityRow = {
  id: string
  customerName: string | null
  /** Signed delta: positive = earned, negative = redeemed/adjusted down. */
  pointsDelta: number
  reason: string
  note: string | null
  createdAt: string
}

const VARIANTS: readonly LoyaltyVariant[] = ['points', 'stamp_card']

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function asInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback
}

/**
 * Normalise the raw tenant_modules.config jsonb into a typed LoyaltyConfig with
 * safe fallbacks. Defensive against missing/malformed values so the admin surface
 * never crashes on a half-configured program. Reads both the canonical snake_case
 * keys (stamp_goal / points_per_visit / perk_text) and a camelCase mirror, to stay
 * robust regardless of how the super-admin config writer shaped the jsonb.
 */
export function parseLoyaltyConfig(raw: Record<string, unknown>): LoyaltyConfig {
  const c = raw ?? {}
  const rawVariant = c.variant
  const variant: LoyaltyVariant =
    typeof rawVariant === 'string' && (VARIANTS as readonly string[]).includes(rawVariant)
      ? (rawVariant as LoyaltyVariant)
      : 'points'
  return {
    variant,
    headline: asString(c.headline, 'Bli stammis'),
    perkText: asString(c.perk_text ?? c.perkText, ''),
    stampGoal: asInt(c.stamp_goal ?? c.stampGoal, 10),
    pointsPerVisit: asInt(c.points_per_visit ?? c.pointsPerVisit, 50),
  }
}

/** Human label for a ledger reason code (unknown codes pass through verbatim). */
export function reasonLabel(r: string): string {
  switch (r) {
    case 'earn_completed':
      return 'Intjänat'
    case 'redeem':
      return 'Inlöst'
    case 'adjustment':
      return 'Justering'
    default:
      return r
  }
}

/**
 * Convert a points balance into stamps for the stamp_card variant. Math.floor so a
 * partially-filled card never over-counts; guards against pointsPerVisit <= 0 (would
 * otherwise divide by zero) by returning 0.
 */
export function pointsToStamps(points: number, pointsPerVisit: number): number {
  if (!Number.isFinite(pointsPerVisit) || pointsPerVisit <= 0) return 0
  if (!Number.isFinite(points) || points <= 0) return 0
  return Math.floor(points / pointsPerVisit)
}
