import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { CopyOverride } from './theme-content'

/**
 * Owner-editable storefront COPY reader (M2 side of the M2↔M6 copy contract).
 *
 * Why a dedicated reader: the owner's copy lives in `tenant_settings.settings`
 * under the top-level key `copy` (see theme-content.ts → CopyOverride). The frozen
 * tenant-data layer (`lib/tenant-data.ts` matches the frozen `lib/tenant*.ts`
 * pattern) does NOT surface `settings.copy` on its bundle, so M2 reads it itself
 * here — exactly the seam the Contract anticipated ("M2 threads settings.copy
 * through as the third arg" to resolveThemeContent). No frozen file is touched.
 *
 * Live-without-deploy (M2 §2.4): cached under the SAME `tenant:${slug}` tag the
 * tenant loader uses, so an M6 save that revalidates that tag invalidates this
 * read too — owner copy edits appear without a redeploy.
 *
 * Tenant isolation: scoped app-side by `tenant_id` (anon carries no tenant claim;
 * RLS does NOT isolate anon — same contract as lib/tenant-data.ts). The returned
 * value is treated as effectively `unknown` by resolveTenantCopy, so we pass it
 * through raw without validation here.
 */
export async function getTenantCopy(
  tenantId: string,
  slug: string,
): Promise<CopyOverride | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<CopyOverride | null> => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('settings')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .maybeSingle()
      if (error || !data) return null
      const raw = (data.settings ?? {}) as Record<string, unknown>
      const copy = raw.copy
      // Pass through raw — resolveTenantCopy is fully defensive about the shape.
      return copy && typeof copy === 'object' ? (copy as CopyOverride) : null
    },
    ['tenant-copy-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
