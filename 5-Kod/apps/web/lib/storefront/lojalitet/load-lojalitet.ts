// Lojalitet-modul — SERVER data loader. Fetches ONLY the tenant's lojalitet config
// (from tenant_modules.config) via the anonymous public client, shaping it for
// LojalitetSection. Modeled ORDAGRANT on lib/storefront/blogg/load-blogg.ts +
// lib/storefront/shop/load-shop.ts.
//
// NO TABLE QUERY (unlike load-blogg/load-shop): the public surface is pure promo
// (headline + perk + variant presentation), so it needs no ledger data. The
// pre-existing loyalty_ledger table (0016) is SELECT-only and not anon-readable
// anyway — anon carries no tenant claim and the public promo needs no balance — so
// this loader reads config and nothing else.
//
// NOT a 'server-only' module by import convention: it uses the cookie-less anon
// public client (safe inside unstable_cache) exactly like load-shop.ts /
// load-blogg.ts / tenant-modules.ts. It is still only ever called from server
// components.
//
// CRITICAL (same fence as tenant-data.ts / tenant-modules.ts, ADR 01 §2): the
// `anon` role carries NO tenant_id claim, so RLS does NOT isolate tenants for the
// public client. The query filters by the resolved tenant_id IN THE APP LAYER
// (.eq('tenant_id', …)).
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// storefront resolves tenant_modules.state via getTenantModuleStates() and only
// renders LojalitetSection when lojalitet === 'live' (same shape as the booking +
// shop + offert + blogg gate). Off/draft når aldrig loadern; paused laddas för den
// stängda publika vyn.

// goal-64 TILLÄGG: loadern läser numera OCKSÅ kundens klubb-nivåer (loyalty_plans,
// migration 0057) — Källas Droppe/Källa/Flod. Samma cache-nyckel, samma `tenant:<slug>`-
// tag och samma app-lager-fence (.eq('tenant_id')) som configen; nivåerna är publikt
// läsbara (loyalty_plans_public_read, active=true) exakt som shop_products, men RLS
// isolerar INTE anon mellan tenants — .eq:t nedan är den enda isoleringen.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { parseLojalitetConfig, toLoyaltyPlan, type LojalitetConfig, type LojalitetData } from './types'

/**
 * Load the tenant's lojalitet config. Cached per-tenant and tagged with the SAME
 * `tenant:<slug>` tag the rest of the storefront uses, so a config change (variant
 * swap) that busts that tag refreshes here too.
 *
 * Returns null when the tenant has no lojalitet module row at all (nothing to
 * render).
 */
export async function loadLojalitetData(tenantId: string, slug: string): Promise<LojalitetData | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<LojalitetData | null> => {
      const supabase = createPublicClient()

      // The lojalitet module's per-tenant config (variant + params). No row → null.
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'lojalitet')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: LojalitetConfig = parseLojalitetConfig(moduleRow.config)

      // Klubbens nivåer. Fel/tom → [] (aldrig påhittade nivåer): en klubb utan
      // prisnivåer är en giltig klubb (stämpelkort/poäng), och vyn ritar då ingen
      // pristavla i stället för en tom platshållare.
      const { data: planRows } = await supabase
        .from('loyalty_plans')
        .select('id, name, price_cents, interval, perks, featured')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      return { config, plans: (planRows ?? []).map(toLoyaltyPlan) }
    },
    ['lojalitet-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
