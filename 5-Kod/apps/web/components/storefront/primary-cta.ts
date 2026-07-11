// Server helper (goal-55 körning 8A): resolve a tenant's bransch-specific PRIMARY
// nav CTA — { label, href } — so a butiks-tung bransch (florist) leads with
// "Beställ blommor" → /shop instead of the hardcoded "Boka tid". Config-first
// (verticals.terminology.primary_cta_label/_href), NEVER if(bransch) — the
// goal-46 guardrail. Returns null when the bransch declares no override, so the
// (public) layout keeps today's BookCta byte-identically (DIFF-0 for every
// tenant without the keys).
//
// Same shape as staff-noun.ts: a SEPARATE, non-embedded, unstable_cache-wrapped
// read on `verticals` keyed per verticalId (platform-level catalog, not
// tenant-scoped). anon can read verticals (migration 0027), so the public
// storefront resolves it. On ANY DB miss → null → default behaviour.
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanTerminology } from '@/lib/platform/verticals-shared'

export type PrimaryCta = { label: string; href: string }

/**
 * Resolve the bransch primary nav CTA. Both keys must be present and valid
 * (cleanTerminology already enforces label ≤ 40 chars + href starting with '/')
 * — a half-declared override resolves to null rather than a broken pill.
 * Serialisable plain object | null (crosses the RSC boundary as a prop).
 */
export async function resolvePrimaryCta(verticalId: string | null): Promise<PrimaryCta | null> {
  if (!verticalId) return null
  const load = unstable_cache(
    async (): Promise<PrimaryCta | null> => {
      const supabase = createPublicClient()
      const { data: vertical } = await supabase
        .from('verticals')
        .select('terminology')
        .eq('key', verticalId)
        .maybeSingle()
      const terminology = cleanTerminology(vertical?.terminology)
      const label = terminology.primary_cta_label
      const href = terminology.primary_cta_href
      if (!label || !href) return null
      return { label, href }
    },
    ['primary-cta-by-vertical', verticalId],
    { revalidate: 300 },
  )
  return load()
}
