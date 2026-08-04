// Caller gates the live module. Every anon query must keep the explicit tenant_id
// filter because the public client has no tenant claim.

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
