// Offert-modul — SERVER data loader. Fetches the tenant's offert config (from
// tenant_modules.config) via the anonymous public client, shaping it for
// OffertSection. Modeled ORDAGRANT on lib/storefront/shop/load-shop.ts.
//
// NOT a 'server-only' module by import convention: it uses the cookie-less anon
// public client (safe inside unstable_cache) exactly like load-shop.ts /
// tenant-modules.ts. It is still only ever called from server components.
//
// CRITICAL (same fence as tenant-data.ts / tenant-modules.ts, ADR 01 §2): the
// `anon` role carries NO tenant_id claim, so RLS does NOT isolate tenants for the
// public client. Every query filters by the resolved tenant_id IN THE APP LAYER
// (.eq('tenant_id', …)). RLS (0033) is defense-in-depth only.
//
// GATING IS THE CALLER'S JOB: this loader does not check module state. The
// storefront resolves tenant_modules.state via getTenantModuleStates() and only
// renders OffertSection when offert === 'live' (same shape as the booking + shop
// gate). Off/draft når aldrig loadern; paused laddas för den stängda publika vyn.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { parseOffertConfig, type OffertConfig, type OffertData } from './types'

/**
 * Load the tenant's offert config. Cached per-tenant and tagged with the SAME
 * `tenant:<slug>` tag the rest of the storefront uses, so a config change (variant
 * swap) that busts that tag refreshes here too.
 *
 * Returns null when the tenant has no offert module row at all (nothing to render).
 */
export async function loadOffertData(tenantId: string, slug: string): Promise<OffertData | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<OffertData | null> => {
      const supabase = createPublicClient()

      // The offert module's per-tenant config (variant + params). No row → null.
      const { data: moduleRow, error: modErr } = await supabase
        .from('tenant_modules')
        .select('config')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('module_key', 'offert')
        .maybeSingle()
      if (modErr || !moduleRow) return null

      const config: OffertConfig = parseOffertConfig(moduleRow.config)
      return { config }
    },
    ['offert-data-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
