// Caller gates the live module. Every anon query must keep the explicit tenant_id
// filter; gift-card codes and balances never leave their protected table.

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
