// Server helper (Round-2 FIX, terminologi-wiring): resolve a tenant's bransch-
// specific STAFF noun (singular) for the customer-facing booking wizard, so a
// nagelstudio reads "Nagelteknolog", a barbershop "Barberare", etc. — instead of
// the hardcoded 'Frisör'. Used by BOTH non-sweep wizard mounts: the standalone
// /boka route (app/boka/page.tsx) and the storefront drawer ((public)/layout.tsx
// → BookingProvider).
//
// Mirror of getAdminTenant's terminology read (lib/admin/tenant.ts): a SEPARATE,
// non-embedded read on `verticals` so a verticals shape/RLS change can never null
// the tenant render — on any miss the overlay simply stays {} and resolveTerm
// falls back to the passed word. anon CAN read verticals (migration 0027:
// `verticals_read … to anon, authenticated using (true)` + grant select to anon),
// so the public storefront client resolves it correctly.
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanTerminology, resolveTerm } from '@/lib/platform/verticals-shared'

/** Neutral customer-facing staff word for tenants WITHOUT a bransch override.
 *  Branschens terminologi vinner alltid (resolveTerm) — detta är bara fallbacken. */
export const DEFAULT_STAFF_NOUN = 'Personal'

/**
 * Resolve the singular staff noun for a tenant's bransch. `verticalId` is the
 * tenant's `vertical_id` (null when unset → no overlay → default word). Always
 * returns a non-empty string; on any DB miss it returns {@link DEFAULT_STAFF_NOUN}.
 *
 * CACHED per `verticalId` (mirrors wizard-services.ts): the (public) layout runs
 * this on EVERY storefront page navigation, so the verticals read is wrapped in
 * unstable_cache to avoid a DB round-trip per nav. The verticals catalog is a
 * platform-level table (not tenant-scoped), so we key by verticalId and use a
 * revalidate window rather than a tenant tag. Returns a plain string (serialisable).
 */
export async function resolveStaffNoun(verticalId: string | null): Promise<string> {
  if (!verticalId) return DEFAULT_STAFF_NOUN
  const load = unstable_cache(
    async (): Promise<string> => {
      const supabase = createPublicClient()
      const { data: vertical } = await supabase
        .from('verticals')
        .select('terminology')
        .eq('key', verticalId)
        .maybeSingle()
      const terminology = cleanTerminology(vertical?.terminology)
      return resolveTerm(terminology, 'staff', DEFAULT_STAFF_NOUN)
    },
    ['staff-noun-by-vertical', verticalId],
    { revalidate: 300 },
  )
  return load()
}
