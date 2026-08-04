import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanTerminology, resolveTerm } from '@/lib/platform/verticals-shared'

/** Neutral fallback when the vertical has no staff terminology. */
export const DEFAULT_STAFF_NOUN = 'Personal'

/**
 * Resolve the public singular staff noun. The platform-level lookup is cached by
 * vertical key; every miss falls back to {@link DEFAULT_STAFF_NOUN}.
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
