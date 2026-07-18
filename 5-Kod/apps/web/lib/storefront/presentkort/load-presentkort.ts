// Presentkort-modul — SERVER data loader. Fetches ONLY the tenant's presentkort
// config (from tenant_modules.config) via the anonymous public client, shaping it
// for PresentkortSection. Modeled ORDAGRANT on lib/storefront/lojalitet/
// load-lojalitet.ts + lib/storefront/shop/load-shop.ts.
//
// NO TABLE QUERY (unlike load-blogg/load-shop): the public surface is pure promo
// (headline + amount presets + fulfilment), so it needs no gift_cards data. The
// gift_cards table (0036) is NOT anon-readable on purpose — codes + balances are
// sensitive and must never leak, and the public promo needs no row — so this loader
// reads config and nothing else.
//
// NOT a 'server-only' module by import convention: it uses the cookie-less anon
// public client (safe inside unstable_cache) exactly like load-lojalitet.ts /
// load-shop.ts / tenant-modules.ts. It is still only ever called from server
// components.
//
// CRITICAL (same fence as tenant-data.ts / tenant-modules.ts, ADR 01 §2): the
// `anon` role carries NO tenant_id claim, so RLS does NOT isolate tenants for the
// public client. The query filters by the resolved tenant_id IN THE APP LAYER
// (.eq('tenant_id', …)).
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// storefront resolves tenant_modules.state via getTenantModuleStates() and only
// renders PresentkortSection when presentkort === 'live' (same shape as the booking
// + shop + offert + blogg + lojalitet gate). Off/draft når aldrig loadern; paused
// laddas för den stängda publika vyn.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { parsePresentkortConfig, type PresentkortConfig, type PresentkortData } from './types'

/**
 * Load the tenant's presentkort config. Cached per-tenant and tagged with the SAME
 * `tenant:<slug>` tag the rest of the storefront uses, so a config change (variant
 * swap) that busts that tag refreshes here too.
 *
 * Returns null when the tenant has no presentkort module row at all (nothing to
 * render).
 */
export async function loadPresentkortData(
  tenantId: string,
  slug: string,
): Promise<PresentkortData | null> {
  if (!commerceReleaseGate(tenantId).presentkort) return null
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<PresentkortData | null> => {
      const supabase = createPublicClient()

      // The presentkort module's per-tenant config (variant + params). No row → null.
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'presentkort')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: PresentkortConfig = parsePresentkortConfig(moduleRow.config)

      return { config }
    },
    ['presentkort-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
