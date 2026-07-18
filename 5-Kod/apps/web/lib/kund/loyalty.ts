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
//   · lifetime = original earn for bookings whose CURRENT outcome is completed,
//                plus explicit positive non-booking adjustments. A no_show and
//                its re-earn/reversal cycle can therefore never inflate a tier.
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

type LoyaltyTotalsRow = {
  balance: number | string | null
  lifetime: number | string | null
  entry_count: number | string | null
}

export type LoyaltyTotals = { balance: number; lifetime: number; entryCount: number }

function finiteInteger(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

/** Normalize Postgres bigint output without deriving lifetime from ledger deltas. */
export function normalizeLoyaltyTotals(row: LoyaltyTotalsRow | null): LoyaltyTotals {
  return {
    balance: finiteInteger(row?.balance),
    lifetime: Math.max(0, finiteInteger(row?.lifetime)),
    entryCount: Math.max(0, finiteInteger(row?.entry_count)),
  }
}

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
 * passed in so the page's single getCustomerId read is reused. The visit band
 * accepts both the legacy profile key and the durable customer key so a securely
 * claimed guest visit remains part of the relationship after account creation.
 */
export async function getLoyaltyView(
  userId: string,
  tenantId: string,
  customerId: string | null,
): Promise<LoyaltyView> {
  const supabase = await createClient()

  const totalsPromise = customerId
    ? supabase.rpc('customer_loyalty_totals', {
        p_tenant: tenantId,
        p_customer: customerId,
      })
    : Promise.resolve({ data: null, error: null })

  // Oberoende reads parallellt. Besöksbandet har ett explicit tenantfilter även
  // om RLS också fencar, och ledgeraggregatet görs i DB utan 1000-radstak.
  let completedVisitsQuery = supabase
    .from('bookings')
    .select('staff_id, staff(title)')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
  completedVisitsQuery = customerId
    ? completedVisitsQuery.or(`customer_profile_id.eq.${userId},customer_id.eq.${customerId}`)
    : completedVisitsQuery.eq('customer_profile_id', userId)

  const [{ data: settingsRow }, { data: completedRows }, { data: totalsRows }] = await Promise.all([
    supabase
      .from('tenant_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    completedVisitsQuery,
    totalsPromise,
  ])
  const { tiers, configured } = parseTiers(settingsRow?.settings)

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

  const totals = normalizeLoyaltyTotals(
    ((totalsRows as unknown as LoyaltyTotalsRow[] | null)?.[0] ?? null),
  )
  const { balance, lifetime } = totals
  const hasLedger = totals.entryCount > 0

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

// ── Points-per-visit history (/konto history row, Fas 2 P2) ──────────────────
// loyalty_ledger is append-only; each EARN entry carries the booking_id it was
// minted for (nullable: manual adjustments have none). The /konto history wants
// "X poäng" next to each visit. Several ledger rows can share one booking_id
// (e.g. a base earn + a bonus adjustment on the same visit), so we SUM the deltas
// per booking_id. Only rows WITH a booking_id are visit-attributable; adjustments
// (booking_id null) are deliberately excluded from the per-visit view.

export type LoyaltyVisitPoints = {
  bookingId: string
  /** Net points attributed to this visit (sum of that booking's ledger deltas). */
  pointsDelta: number
}

type LedgerVisitRow = { booking_id: string | null; points_delta: number }

/**
 * Pure: collapse ledger rows into one signed total per booking_id. Rows without a
 * booking_id (manual adjustments) are dropped — they are not visit-attributable.
 * A net-zero booking is kept (it represents a visit that earned then redeemed),
 * so the consumer can decide whether to render a 0 row. Insertion order of the
 * first-seen booking_id is preserved for stable display.
 */
export function pointsPerVisit(rows: LedgerVisitRow[]): LoyaltyVisitPoints[] {
  const byBooking = new Map<string, number>()
  for (const r of rows) {
    if (!r.booking_id) continue
    byBooking.set(r.booking_id, (byBooking.get(r.booking_id) ?? 0) + r.points_delta)
  }
  return [...byBooking.entries()].map(([bookingId, pointsDelta]) => ({ bookingId, pointsDelta }))
}

/**
 * Per-visit loyalty points for the signed-in customer, keyed on booking_id so a
 * consumer can join it to a booking's date/service. customerId is the resolved
 * customers.id (loyalty_ledger keys on it); null → no customers row yet → []
 * (honest empty, never fabricated). RLS scopes the ledger to this customer.
 */
export async function getCustomerLoyaltyPointsPerVisit(
  customerId: string | null,
): Promise<LoyaltyVisitPoints[]> {
  if (!customerId) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('loyalty_ledger')
    .select('booking_id, points_delta')
    .eq('customer_id', customerId)
    .not('booking_id', 'is', null)
  return pointsPerVisit((data ?? []) as LedgerVisitRow[])
}
