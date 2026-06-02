import 'server-only'
import { createClient } from '@/lib/supabase/server'

// ── Loyalty VISNING (M4 §2.2) — read/derive only ─────────────────────────────
// We build only the DISPLAY here. EARNING (inserts into loyalty_ledger) is NOT
// built in this revir: loyalty_ledger is SELECT-only for authenticated (RLS,
// migration 0011 §6.3); points are minted exclusively by a SECURITY DEFINER /
// service-role path on `status = completed` (a separate trigger, migration 0013).
// So an unconfigured / never-earned customer shows an HONEST empty state, not a
// fake balance.
//
// Two derived totals, deliberately distinct:
//   · balance  = sum(points_delta)              — spendable (earns − redemptions)
//   · lifetime = sum(positive earn_completed)   — tier basis; redeeming never
//                                                 demotes you. Adjustments only
//                                                 count toward lifetime when they
//                                                 are positive earn-equivalents.
// Tier is f(lifetime, thresholds), thresholds read from tenant_settings.settings
// with a sane platform default (the salon may override per M6).

export type LoyaltyTier = {
  /** Machine key: 'brons' | 'silver' | 'guld' (lowercase, theme-agnostic). */
  key: string
  /** Swedish display label. */
  label: string
  /** lifetime points needed to be AT this tier. */
  threshold: number
}

/** Platform default tiers (brons/silver/guld). Owners may override thresholds in
 *  tenant_settings.settings.loyalty.tiers; the labels stay fixed. */
const DEFAULT_TIERS: LoyaltyTier[] = [
  { key: 'brons', label: 'Brons', threshold: 0 },
  { key: 'silver', label: 'Silver', threshold: 200 },
  { key: 'guld', label: 'Guld', threshold: 500 },
]

export type StaffBand = { staffId: string; staffTitle: string | null; visits: number }

export type LoyaltyView = {
  /** True when the loyalty section is worth rendering at all (config, ledger rows,
   *  or at least one completed visit). When false the UI shows the honest
   *  "tjänas vid genomförda besök" empty state. */
  hasActivity: boolean
  /** True only when REAL points have been recorded (loyalty_ledger rows). Earning
   *  is wired separately (DB trigger, migration 0013) — until then this is false
   *  for everyone, so the UI must NOT imply accrual (no progress bar, no "X kvar
   *  till Silver") when this is false, even if completed visits exist. */
  hasLedger: boolean
  balance: number
  lifetime: number
  tier: LoyaltyTier
  nextTier: LoyaltyTier | null
  /** points still needed to reach nextTier (0 when already top tier). */
  toNextTier: number
  /** All configured tiers, ascending — lets the UI render the ladder. */
  tiers: LoyaltyTier[]
  /** "Du har sett Erik X ggr" — completed visits per staff, busiest first. */
  staffBands: StaffBand[]
  /** Total completed visits at this salon (the framing for earning). */
  completedVisits: number
}

type SettingsShape = { loyalty?: { tiers?: unknown } }

/** Read + validate per-tenant tier thresholds; fall back to the platform default
 *  for anything missing/malformed. Mirrors the safe-default pattern in
 *  lib/kund/settings.ts (getCancellationCutoffHours). */
function parseTiers(raw: unknown): { tiers: LoyaltyTier[]; configured: boolean } {
  const s = (raw ?? {}) as SettingsShape
  const list = s.loyalty?.tiers
  if (!Array.isArray(list) || list.length === 0) {
    return { tiers: DEFAULT_TIERS, configured: false }
  }
  const labelByKey: Record<string, string> = { brons: 'Brons', silver: 'Silver', guld: 'Guld' }
  const cleaned: LoyaltyTier[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const key = typeof o.key === 'string' ? o.key.trim().toLowerCase() : ''
    const threshold = typeof o.threshold === 'number' ? o.threshold : Number(o.threshold)
    if (!key || !Number.isFinite(threshold) || threshold < 0) continue
    cleaned.push({
      key,
      label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : (labelByKey[key] ?? key),
      threshold: Math.floor(threshold),
    })
  }
  if (cleaned.length === 0) return { tiers: DEFAULT_TIERS, configured: false }
  cleaned.sort((a, b) => a.threshold - b.threshold)
  return { tiers: cleaned, configured: true }
}

function tierFor(lifetime: number, tiers: LoyaltyTier[]): { tier: LoyaltyTier; next: LoyaltyTier | null } {
  let current = tiers[0]!
  let next: LoyaltyTier | null = null
  for (let i = 0; i < tiers.length; i++) {
    if (lifetime >= tiers[i]!.threshold) {
      current = tiers[i]!
      next = tiers[i + 1] ?? null
    } else {
      next = tiers[i]!
      break
    }
  }
  return { tier: current, next }
}

/**
 * Build the loyalty view for the signed-in customer at the CURRENT tenant.
 * Single-tenant by design: /konto runs on one salon's subdomain and RLS +
 * private.tenant_id() already scope the ledger — no cross-salon aggregation.
 *
 * `customerId` is the caller-resolved customers.id (or null when none exists yet);
 * passed in so the page's single getCustomerId read is reused. The visit band is
 * keyed on customer_profile_id (the live ownership key), so it works even when
 * customerId is null.
 */
export async function getLoyaltyView(
  userId: string,
  tenantId: string,
  customerId: string | null,
): Promise<LoyaltyView> {
  const supabase = await createClient()

  // Tier thresholds (safe default when unset). configured == owner opted in.
  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const { tiers, configured } = parseTiers(settingsRow?.settings)

  // Completed visits per staff — the "sett Erik X ggr" band. Keyed on
  // customer_profile_id (the live ownership key the portal already uses), so it
  // works even before a customers row exists. Only genuinely completed visits.
  const { data: completedRows } = await supabase
    .from('bookings')
    .select('staff_id, staff(title)')
    .eq('customer_profile_id', userId)
    .eq('status', 'completed')

  type CompletedRow = { staff_id: string; staff: { title: string | null } | null }
  const rows = (completedRows ?? []) as unknown as CompletedRow[]
  const completedVisits = rows.length
  const byStaff = new Map<string, StaffBand>()
  for (const r of rows) {
    if (!r.staff_id) continue
    const cur = byStaff.get(r.staff_id)
    if (cur) cur.visits += 1
    else byStaff.set(r.staff_id, { staffId: r.staff_id, staffTitle: r.staff?.title ?? null, visits: 1 })
  }
  const staffBands = [...byStaff.values()].sort((a, b) => b.visits - a.visits)

  // Ledger totals — only if a customers row exists (the ledger keys on it).
  let balance = 0
  let lifetime = 0
  let hasLedger = false
  if (customerId) {
    const { data: ledger } = await supabase
      .from('loyalty_ledger')
      .select('points_delta, reason')
      .eq('customer_id', customerId)
    const entries = (ledger ?? []) as { points_delta: number; reason: string }[]
    hasLedger = entries.length > 0
    for (const e of entries) {
      balance += e.points_delta
      // lifetime (tier basis): positive earns + positive adjustments; never
      // reduced by redemptions or negative adjustments.
      if (e.points_delta > 0 && (e.reason === 'earn_completed' || e.reason === 'adjustment')) {
        lifetime += e.points_delta
      }
    }
  }

  const { tier, next } = tierFor(lifetime, tiers)
  const toNextTier = next ? Math.max(0, next.threshold - lifetime) : 0

  return {
    // Activity exists if the salon configured loyalty, the customer has ledger
    // rows, or they have completed visits to anchor the band framing.
    hasActivity: configured || hasLedger || completedVisits > 0,
    hasLedger,
    balance,
    lifetime,
    tier,
    nextTier: next,
    toNextTier,
    tiers,
    staffBands,
    completedVisits,
  }
}
