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
// shop + offert + blogg gate). A draft/off/paused lojalitet never reaches
// loadLojalitetData.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { parseLojalitetConfig, type LojalitetConfig, type LojalitetData } from './types'

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

      return { config }
    },
    ['lojalitet-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
