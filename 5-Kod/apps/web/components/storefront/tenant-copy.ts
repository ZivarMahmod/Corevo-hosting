import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { layerCopy, type CopyOverride } from './theme-content'
import { getVerticalCopy } from './vertical-copy'
import { themeOwnsCopy } from '@/lib/platform/theme-capabilities'

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
  /** tenants.vertical_id — lagrar branschens mall-text UNDER kundens egna fält
   *  (goal-57 körning 12): kund → bransch → tema. null/utelämnad = ingen bransch-nivå.
   *  Hoppas HELT över när mallen äger sin text (goal-64, se themeOwnsCopy nedan). */
  verticalId: string | null = null,
  /** goal-64: mallen som faktiskt renderas. Utelämnad → den mall tenanten valt
   *  (settings.theme, samma rad vi redan läser). Skickas explicit av preview-tvillingen,
   *  som kan rendera en ANNAN mall än den sparade (?theme= i SidaStudio) — annars skulle
   *  previewen gata bransch-lagret på fel mall och visa något live aldrig visar. */
  themeOverride: string | null = null,
): Promise<CopyOverride | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<{ copy: CopyOverride | null; theme: string | null }> => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('settings')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .maybeSingle()
      if (error || !data) return { copy: null, theme: null }
      const raw = (data.settings ?? {}) as Record<string, unknown>
      const copy = raw.copy
      return {
        // Pass through raw — resolveTenantCopy is fully defensive about the shape.
        copy: copy && typeof copy === 'object' ? (copy as CopyOverride) : null,
        theme: typeof raw.theme === 'string' ? raw.theme : null,
      }
    },
    ['tenant-copy-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  const stored = await load()
  // goal-64: äger mallen sin text finns ingen bransch-nivå — vi slipper DB-rundan helt.
  const theme = themeOverride ?? stored.theme
  if (theme && themeOwnsCopy(theme)) return stored.copy
  const verticalCopy = await getVerticalCopy(verticalId)
  return layerCopy(verticalCopy, stored.copy)
}
