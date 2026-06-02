import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Staff-facing client card (M5 §2.2). Built on the NEW customer band:
// bookings.customer_id → public.customers(id). Identity (visits/history/loyalty)
// is readable tenant-wide for staff/admin (role_level >= 3, migration 0011 RLS).
// Contact-PII is NOT read here — it is window-gated and fetched separately via the
// get_customer_contact RPC (see actions.getCustomerContact), only when a card opens.
//
// Names are NOT window-gated (only contact is): a returning customer's chosen
// display name / initial is always shown so the frisör recognises them. The raw
// guest email is never used as a label (that was the FAS0 PII leak).

export type CustomerHistoryItem = {
  bookingId: string
  startTs: string
  serviceName: string | null
  staffTitle: string | null
  priceCents: number | null
  status: string
  timeZone: string
}

export type LoyaltyView = {
  /** Derived balance = sum(points_delta). 0 when no ledger rows. */
  points: number
  /** Lifetime earned (sum of positive deltas) — drives tier. */
  lifetime: number
  /** Resolved tier name, or null when no thresholds configured / nothing earned. */
  tier: string | null
  /** Points to the next tier, or null when already top / unconfigured. */
  toNext: number | null
  /** True only when the tenant has loyalty thresholds AND the customer has earned. */
  hasProgram: boolean
}

export type CustomerCard = {
  customerId: string
  /** Resolved display name (display_name, else name_hidden→initial, else full_name). */
  displayName: string
  nameHidden: boolean
  visits: number // completed visits
  totalBookings: number
  firstSeenAt: string | null
  lastVisitTs: string | null
  favoriteStaffTitle: string | null
  history: CustomerHistoryItem[]
  loyalty: LoyaltyView
}

type CustomerRow = {
  id: string
  display_name: string | null
  full_name: string | null
  name_hidden: boolean
  first_seen_at: string | null
}

/**
 * Resolve a customer's visible NAME (never contact-PII). display_name wins; when
 * the customer asked to hide their name we show only an initial of the full name;
 * otherwise the full name. Falls back to a neutral label when nothing is known.
 */
export function resolveCustomerName(c: {
  display_name: string | null
  full_name: string | null
  name_hidden: boolean
}): string {
  if (c.display_name && c.display_name.trim()) return c.display_name.trim()
  if (c.name_hidden) {
    const initial = (c.full_name ?? '').trim().charAt(0)
    return initial ? `${initial.toUpperCase()}.` : 'Kund'
  }
  if (c.full_name && c.full_name.trim()) return c.full_name.trim()
  return 'Kund'
}

/**
 * Batch-resolve visible names for a set of customer ids (one query). Used to label
 * calendar rows without per-row PII calls. RLS lets staff (level >= 3) read every
 * customer row in their own tenant, so the names come back for the whole day.
 */
export async function resolveCustomerNames(customerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = [...new Set(customerIds.filter(Boolean))]
  if (ids.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden')
    .in('id', ids)
  for (const c of (data ?? []) as CustomerRow[]) {
    out.set(c.id, resolveCustomerName(c))
  }
  return out
}

/** Tier thresholds live in tenant_settings.settings.loyalty.tiers as {name, points}[]. */
type Tier = { name: string; points: number }

function readTiers(settings: Record<string, unknown>): Tier[] {
  const loyalty = (settings.loyalty ?? {}) as Record<string, unknown>
  const raw = loyalty.tiers
  if (!Array.isArray(raw)) return []
  const tiers: Tier[] = []
  for (const t of raw) {
    if (t && typeof t === 'object') {
      const name = (t as Record<string, unknown>).name
      const points = (t as Record<string, unknown>).points
      if (typeof name === 'string' && typeof points === 'number' && Number.isFinite(points)) {
        tiers.push({ name, points })
      }
    }
  }
  return tiers.sort((a, b) => a.points - b.points)
}

function deriveLoyalty(
  ledger: { points_delta: number }[],
  tiers: Tier[],
): LoyaltyView {
  let points = 0
  let lifetime = 0
  for (const r of ledger) {
    points += r.points_delta
    if (r.points_delta > 0) lifetime += r.points_delta
  }

  // No program configured OR nothing earned yet → honest empty state (no fake tier).
  if (tiers.length === 0 || lifetime === 0) {
    return { points, lifetime, tier: null, toNext: null, hasProgram: false }
  }

  let tier: string | null = null
  let next: Tier | null = null
  for (const t of tiers) {
    if (lifetime >= t.points) tier = t.name
    else if (!next) next = t
  }
  return {
    points,
    lifetime,
    tier,
    toNext: next ? Math.max(0, next.points - lifetime) : null,
    hasProgram: true,
  }
}

/**
 * Full client card for one customer (drawer view). NO contact-PII — that is fetched
 * separately and window-gated. Returns null when the id is unknown / not in tenant.
 */
export async function getCustomerCard(
  customerId: string,
  tenantId: string,
): Promise<CustomerCard | null> {
  if (!customerId) return null
  const supabase = await createClient()

  const { data: cust } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden, first_seen_at')
    .eq('id', customerId)
    .maybeSingle()
  if (!cust) return null

  // History: every booking on this customer band (RLS tenant-fenced for staff).
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('id, status, start_ts, price_cents, services(name), staff(title), locations(timezone)')
    .eq('customer_id', customerId)
    .order('start_ts', { ascending: false })

  type HistRow = {
    id: string
    status: string
    start_ts: string
    price_cents: number | null
    services: { name: string } | null
    staff: { title: string | null } | null
    locations: { timezone: string } | null
  }
  const rows = (bookingRows ?? []) as unknown as HistRow[]

  const history: CustomerHistoryItem[] = rows.map((r) => ({
    bookingId: r.id,
    startTs: r.start_ts,
    serviceName: r.services?.name ?? null,
    staffTitle: r.staff?.title ?? null,
    priceCents: r.price_cents,
    status: r.status,
    timeZone: r.locations?.timezone ?? 'Europe/Stockholm',
  }))

  const completed = rows.filter((r) => r.status === 'completed')
  const visits = completed.length
  const lastVisitTs = completed[0]?.start_ts ?? null // rows already desc by start_ts

  // Favorite staff = the staff title the customer has been to most (completed).
  const staffCount = new Map<string, number>()
  for (const r of completed) {
    const t = r.staff?.title
    if (t) staffCount.set(t, (staffCount.get(t) ?? 0) + 1)
  }
  let favoriteStaffTitle: string | null = null
  let best = 0
  for (const [title, n] of staffCount) {
    if (n > best) {
      best = n
      favoriteStaffTitle = title
    }
  }

  // Loyalty (read/derive only — earning is a DB trigger built elsewhere, 0013).
  const [{ data: ledger }, { data: settingsRow }] = await Promise.all([
    supabase.from('loyalty_ledger').select('points_delta').eq('customer_id', customerId),
    supabase.from('tenant_settings').select('settings').eq('tenant_id', tenantId).maybeSingle(),
  ])
  const tiers = readTiers((settingsRow?.settings ?? {}) as Record<string, unknown>)
  const loyalty = deriveLoyalty((ledger ?? []) as { points_delta: number }[], tiers)

  return {
    customerId: cust.id,
    displayName: resolveCustomerName(cust),
    nameHidden: cust.name_hidden,
    visits,
    totalBookings: rows.length,
    firstSeenAt: cust.first_seen_at,
    lastVisitTs,
    favoriteStaffTitle,
    history,
    loyalty,
  }
}

// ── Customer notes (internal client card, M5 §2.3) ───────────────────────────
// Strictly internal — read only via the staff RLS (no customer-facing path).
export type CustomerNotes = {
  preferences: string[]
  allergies: string[]
  products: string[]
  hairType: string | null
  hairLength: string | null
  sensitivity: string | null
  internalNote: string | null
  updatedAt: string | null
}

/** The one notes row for (tenant, customer), or empty defaults when none yet. */
export async function getCustomerNotes(customerId: string): Promise<CustomerNotes> {
  const empty: CustomerNotes = {
    preferences: [],
    allergies: [],
    products: [],
    hairType: null,
    hairLength: null,
    sensitivity: null,
    internalNote: null,
    updatedAt: null,
  }
  if (!customerId) return empty
  const supabase = await createClient()
  const { data } = await supabase
    .from('customer_notes')
    .select(
      'preferences, allergies, products, hair_type, hair_length, sensitivity, internal_note, updated_at',
    )
    .eq('customer_id', customerId)
    .maybeSingle()
  if (!data) return empty
  return {
    preferences: data.preferences ?? [],
    allergies: data.allergies ?? [],
    products: data.products ?? [],
    hairType: data.hair_type,
    hairLength: data.hair_length,
    sensitivity: data.sensitivity,
    internalNote: data.internal_note,
    updatedAt: data.updated_at,
  }
}
