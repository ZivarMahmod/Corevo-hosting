import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanCopyOverride, type CopyOverride } from './theme-copy'
import { branschCopy } from './bransch-copy'

/**
 * Non-empty database fields override code defaults. Only the database read is
 * cached, so deployed defaults are never captured inside the cache entry.
 */
export async function getVerticalCopy(verticalId: string | null): Promise<CopyOverride> {
  if (!verticalId) return {}
  const loadDbCopy = unstable_cache(
    async (): Promise<CopyOverride> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('verticals')
        .select('default_copy')
        .eq('key', verticalId)
        .maybeSingle()
      return cleanCopyOverride(data?.default_copy)
    },
    ['vertical-copy-by-vertical', verticalId],
    { revalidate: 300 },
  )
  return { ...branschCopy(verticalId), ...(await loadDbCopy()) }
}
