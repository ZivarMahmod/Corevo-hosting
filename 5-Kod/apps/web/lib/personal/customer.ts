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
  lastStaffTitle: string | null
  favoriteStaffTitle: string | null
  usualServiceName: string | null
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
  if (c.name_hidden) {
    const initial = (c.full_name ?? '').trim().charAt(0)
    return initial ? `${initial.toUpperCase()}.` : 'Kund'
  }
  if (c.display_name && c.display_name.trim()) return c.display_name.trim()
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

export function deriveLoyalty(
  points: number,
  lifetime: number,
  tiers: Tier[],
): LoyaltyView {
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

type VisitSource = {
  status: string
  start_ts: string
  services: { name: string } | null
  staff: { title: string | null } | null
}

export type CustomerVisitSummary = {
  visits: number
  lastVisitTs: string | null
  lastStaffTitle: string | null
  favoriteStaffTitle: string | null
  usualServiceName: string | null
}

/** Relationship memory from real visits only. Input is newest-first; ties keep
 * the most recently seen staff/service instead of inventing another ranking. */
export function deriveCustomerVisitSummary(rows: VisitSource[]): CustomerVisitSummary {
  const completed = rows.filter((row) => row.status === 'completed')
  const staffCount = new Map<string, number>()
  const serviceCount = new Map<string, number>()
  for (const row of completed) {
    const staffTitle = row.staff?.title?.trim()
    if (staffTitle) staffCount.set(staffTitle, (staffCount.get(staffTitle) ?? 0) + 1)
    const serviceName = row.services?.name?.trim()
    if (serviceName) serviceCount.set(serviceName, (serviceCount.get(serviceName) ?? 0) + 1)
  }

  const mostFrequent = (counts: Map<string, number>): string | null => {
    let picked: string | null = null
    let best = 0
    for (const [value, count] of counts) {
      if (count > best) {
        picked = value
        best = count
      }
    }
    return picked
  }

  return {
    visits: completed.length,
    lastVisitTs: completed[0]?.start_ts ?? null,
    lastStaffTitle: completed[0]?.staff?.title?.trim() || null,
    favoriteStaffTitle: mostFrequent(staffCount),
    usualServiceName: mostFrequent(serviceCount),
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
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!cust) return null

  // History: every booking on this customer band (RLS tenant-fenced for staff).
  const { data: bookingRows } = await supabase
    .from('bookings')
    .select('id, status, start_ts, price_cents, services(name), staff(title), locations(timezone)')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
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

  const relationship = deriveCustomerVisitSummary(rows)

  // Balance/lifetime aggregeras utfallsmedvetet i DB utan PostgRESTs 1000-radstak.
  const [{ data: totalsRows }, { data: settingsRow }] = await Promise.all([
    supabase.rpc('customer_loyalty_totals', {
      p_tenant: tenantId,
      p_customer: customerId,
    }),
    supabase.from('tenant_settings').select('settings').eq('tenant_id', tenantId).maybeSingle(),
  ])
  const tiers = readTiers((settingsRow?.settings ?? {}) as Record<string, unknown>)
  const totals = (totalsRows as unknown as Array<{
    balance: number | string | null
    lifetime: number | string | null
  }> | null)?.[0]
  const points = Number(totals?.balance ?? 0)
  const lifetime = Number(totals?.lifetime ?? 0)
  const loyalty = deriveLoyalty(
    Number.isFinite(points) ? Math.trunc(points) : 0,
    Number.isFinite(lifetime) ? Math.max(0, Math.trunc(lifetime)) : 0,
    tiers,
  )

  return {
    customerId: cust.id,
    displayName: resolveCustomerName(cust),
    nameHidden: cust.name_hidden,
    visits: relationship.visits,
    totalBookings: rows.length,
    firstSeenAt: cust.first_seen_at,
    lastVisitTs: relationship.lastVisitTs,
    lastStaffTitle: relationship.lastStaffTitle,
    favoriteStaffTitle: relationship.favoriteStaffTitle,
    usualServiceName: relationship.usualServiceName,
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
  locationId: string | null
}

/** The one notes row for (tenant, customer), or empty defaults when none yet. */
export async function getCustomerNotes(customerId: string, tenantId: string): Promise<CustomerNotes> {
  const empty: CustomerNotes = {
    preferences: [],
    allergies: [],
    products: [],
    hairType: null,
    hairLength: null,
    sensitivity: null,
    internalNote: null,
    updatedAt: null,
    locationId: null,
  }
  if (!customerId) return empty
  const supabase = await createClient()
  const { data } = await supabase
    .from('customer_notes')
    .select(
      'preferences, allergies, products, hair_type, hair_length, sensitivity, internal_note, updated_at, location_id',
    )
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
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
    locationId: data.location_id,
  }
}
