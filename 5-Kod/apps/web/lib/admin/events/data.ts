import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { EventRow, RegistrationRow } from './types'

/**
 * List all events for a tenant, newest start first, with `taken` = the sum of
 * party_size over CONFIRMED registrations. Two queries + JS aggregation (no
 * DB view needed at this scale). Reads via the authenticated server client —
 * salon_admin under RLS, platform_admin via the baked cross-tenant claim
 * (same model as lib/admin/blogg/data.ts). Returns [] on error — a read miss
 * must never crash an admin page.
 */
export async function listTenantEvents(tenantId: string): Promise<EventRow[]> {
  const supabase = await createClient()
  const [{ data: events }, { data: regs }] = await Promise.all([
    supabase
      .from('tenant_events')
      .select(
        'id, tenant_id, title, description, starts_at, duration_min, capacity, price_cents, status',
      )
      .eq('tenant_id', tenantId)
      .order('starts_at', { ascending: false })
      // ponytail: cap (goal-56 A5) — newest 200 events; raise/paginate if a tenant runs more.
      .limit(200),
    supabase
      .from('event_registrations')
      .select('event_id, party_size')
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed'),
  ])
  if (!events) return []
  const taken = new Map<string, number>()
  for (const r of regs ?? []) {
    taken.set(r.event_id, (taken.get(r.event_id) ?? 0) + r.party_size)
  }
  return events.map((e) => ({ ...e, taken: taken.get(e.id) ?? 0 }))
}

/**
 * List ALL registrations for a tenant (every event, both confirmed and
 * cancelled) — the drawer filters by event_id client-side.
 */
export async function listEventRegistrations(tenantId: string): Promise<RegistrationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_registrations')
    .select('id, tenant_id, event_id, name, email, phone, party_size, message, status')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    // ponytail: cap (goal-56 A5) — 2000 registrations covers admin scale; paginate past it.
    .limit(2000)
  return data ?? []
}
