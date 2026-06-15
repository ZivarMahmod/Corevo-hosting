import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { LoyaltyMemberRow, LoyaltyActivityRow } from './types'

// READ-ONLY loyalty data layer. Every read runs through the cookie-bound
// authenticated client, so RLS fences it: loyalty_ledger is SELECT-only tenant-wide
// for admin (role_level>=3, migr 0011:551) and customers_rls (0011:503) fences the
// name lookup to the same tenant. We ALSO pass tenant_id explicitly (defence-in-depth
// + stable scoping), mirroring the rest of the admin data layer. NOTHING here writes:
// the ledger is appended only by the booking flow (reason='earn_completed').
//
// loyalty_ledger may be absent from the generated @corevo/db Tables map, so we type
// the rows locally (a minimal cast in the .from() result) rather than touch the
// shared packages/db/types.ts file.

type LedgerRow = {
  id: string
  customer_id: string | null
  points_delta: number
  reason: string | null
  note: string | null
  created_at: string
}

type CustomerNameRow = {
  id: string
  display_name: string | null
  full_name: string | null
  name_hidden: boolean
}

/**
 * Public display name WITHOUT leaking a hidden full name. Mirrors shownNameOf in
 * lib/admin/data.ts (and get_customer_contact's display_name rule, migration
 * 0011:340): kund-chosen display_name wins; else the masked initial when name_hidden;
 * else the full name; else null (caller renders a neutral "Okänd kund").
 */
function shownNameOf(c: CustomerNameRow): string | null {
  const display = c.display_name?.trim()
  if (display) return display
  const full = c.full_name?.trim()
  if (!full) return null
  return c.name_hidden ? `${full[0]!.toUpperCase()}.` : full
}

/**
 * Resolve customer_id → shown name for a set of ids, in one tenant-scoped read.
 * Returns a Map; ids with no customers row (or a fully-hidden name) resolve to null
 * via Map.get → undefined at the call site, which the row mappers coerce to null.
 */
async function loadCustomerNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  ids: string[],
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>()
  if (ids.length === 0) return names
  const { data } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden')
    .eq('tenant_id', tenantId)
    .in('id', ids)
  for (const c of (data ?? []) as CustomerNameRow[]) {
    names.set(c.id, shownNameOf(c))
  }
  return names
}

/**
 * Aggregated loyalty members for one tenant, derived from loyalty_ledger:
 *  - pointsBalance = sum(points_delta)   (signed; the real balance)
 *  - visits        = count(reason='earn_completed')
 *  - lastActivityAt= max(created_at)
 * Sorted by pointsBalance descending. Customer names are resolved privacy-safe via a
 * single customers lookup. Returns [] on any error so an admin page never crashes.
 */
export async function listLoyaltyMembers(tenantId: string): Promise<LoyaltyMemberRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('loyalty_ledger')
      .select('customer_id, points_delta, reason, created_at')
      .eq('tenant_id', tenantId)
    if (error || !data) return []

    const rows = data as Pick<LedgerRow, 'customer_id' | 'points_delta' | 'reason' | 'created_at'>[]

    type Agg = { balance: number; visits: number; last: string | null }
    const byCustomer = new Map<string, Agg>()
    for (const r of rows) {
      if (!r.customer_id) continue
      const a = byCustomer.get(r.customer_id) ?? { balance: 0, visits: 0, last: null }
      a.balance += typeof r.points_delta === 'number' ? r.points_delta : 0
      if (r.reason === 'earn_completed') a.visits += 1
      if (a.last == null || r.created_at > a.last) a.last = r.created_at
      byCustomer.set(r.customer_id, a)
    }

    const names = await loadCustomerNames(supabase, tenantId, [...byCustomer.keys()])

    const members: LoyaltyMemberRow[] = [...byCustomer.entries()].map(([customerId, a]) => ({
      customerId,
      customerName: names.get(customerId) ?? null,
      pointsBalance: a.balance,
      visits: a.visits,
      lastActivityAt: a.last,
    }))
    members.sort((x, y) => y.pointsBalance - x.pointsBalance)
    return members
  } catch {
    return []
  }
}

/**
 * The most recent N loyalty ledger entries for one tenant (newest first), each
 * joined to a privacy-safe shown customer name. Returns [] on any error.
 */
export async function recentLoyaltyActivity(
  tenantId: string,
  limit = 20,
): Promise<LoyaltyActivityRow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('loyalty_ledger')
      .select('id, customer_id, points_delta, reason, note, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []

    const rows = data as LedgerRow[]
    const ids = [...new Set(rows.map((r) => r.customer_id).filter((x): x is string => !!x))]
    const names = await loadCustomerNames(supabase, tenantId, ids)

    return rows.map((r) => ({
      id: r.id,
      customerName: r.customer_id ? (names.get(r.customer_id) ?? null) : null,
      pointsDelta: typeof r.points_delta === 'number' ? r.points_delta : 0,
      reason: r.reason ?? 'adjustment',
      note: r.note,
      createdAt: r.created_at,
    }))
  } catch {
    return []
  }
}
