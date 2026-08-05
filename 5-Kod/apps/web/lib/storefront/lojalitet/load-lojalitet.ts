// Caller gates the live module. Every anon query must keep the explicit tenant_id
// filter; balances are never part of this public promo loader.

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
