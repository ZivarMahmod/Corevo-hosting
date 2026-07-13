// Kurser/event-modul — SERVER data loader (goal-54 körning 4). Fetches the
// tenant's upcoming OPEN tenant_events via the anonymous public client, shaped
// for the /kurser page. Modeled on lib/storefront/blogg/load-blogg.ts.
//
// CRITICAL (same fence as load-blogg.ts, ADR 01 §2): the `anon` role carries NO
// tenant_id claim, so RLS does NOT isolate tenants for the public client. Every
// query filters by the resolved tenant_id IN THE APP LAYER.
//
// TAKEN-RÄKNING (medvetet val): anon får LÄSA tenant_events men INTE
// event_registrations (anon har bara insert där). Antalet tagna platser måste
// därför räknas med SERVICE-klienten (lib/platform/service) — den kör
// server-side inuti unstable_cache, läcker aldrig till klienten, och läser bara
// en aggregerad siffra (aldrig PII-fälten). När SUPABASE_SERVICE_ROLE_KEY
// saknas (lokal dev) degraderar vi till taken=null → UI:t visar "Max Y platser"
// utan "kvar"-siffra istället för att gissa eller krascha.
//
// GATING IS THE CALLER'S JOB: /kurser gate:ar på booking-modulen (live/paused)
// innan loadern anropas — samma kontrakt som blogg/shop/offert.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { createServiceClient, hasServiceRole } from '@/lib/platform/service'
import { parseKurserConfig, type KurserConfig, type UpcomingEvent } from './types'

/**
 * goal-64: kundens kurs-config (betalas kursen på plats eller i kassan?). Egen loader —
 * /kurser behöver den för att välja mellan anmälningsformuläret och köpknappen, och
 * ingen annan yta ska behöva ladda hela kurslistan för att få veta det.
 */
export async function loadKurserConfig(tenantId: string, slug: string): Promise<KurserConfig> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<KurserConfig> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'kurser')
        .maybeSingle()
      return parseKurserConfig(data?.config)
    },
    ['kurser-config-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/**
 * Load the tenant's upcoming open events (starts_at >= now, ascending), each
 * with `taken` = sum of confirmed party_size (or null when uncountable).
 * Cached per-tenant with the SAME `tenant:<slug>` tag the rest of the
 * storefront uses, so an anmälan (revalidateTag in the action) refreshes the
 * "platser kvar" counts.
 */
export async function loadUpcomingEvents(tenantId: string, slug: string): Promise<UpcomingEvent[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<UpcomingEvent[]> => {
      const supabase = createPublicClient()
      const nowIso = new Date().toISOString()

      const { data: rows } = await supabase
        .from('tenant_events')
        .select('id, title, description, starts_at, duration_min, capacity, price_cents')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('status', 'open')
        .gte('starts_at', nowIso)
        .order('starts_at', { ascending: true })

      const events = rows ?? []
      if (events.length === 0) return []

      // Sum confirmed party_size per event via the service client (see header).
      // One query for ALL upcoming events; aggregated in-process (few rows).
      let takenByEvent: Map<string, number> | null = null
      if (hasServiceRole()) {
        const svc = createServiceClient()
        if (svc) {
          const { data: regs } = await svc
            .from('event_registrations')
            .select('event_id, party_size')
            .eq('tenant_id', tenantId)
            .eq('status', 'confirmed')
            .in('event_id', events.map((e) => e.id))
          takenByEvent = new Map()
          for (const r of regs ?? []) {
            takenByEvent.set(r.event_id, (takenByEvent.get(r.event_id) ?? 0) + r.party_size)
          }
        }
      }

      return events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description ?? null,
        startsAt: e.starts_at,
        durationMin: e.duration_min,
        capacity: e.capacity,
        priceCents: e.price_cents,
        taken: takenByEvent ? (takenByEvent.get(e.id) ?? 0) : null,
      }))
    },
    ['kurser-upcoming-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
