import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanCopyOverride, type CopyOverride } from './theme-content'

/**
 * Bransch-mall-texten (goal-57 körning 12): Zivars editorial copy-mall per bransch
 * (verticals.default_copy) — kundens startvärde/fallback FÖRE temats hårdkodade
 * THEME_CONTENT. Mönstret speglar staff-noun.ts: separat cachad anon-läsning per
 * vertical (plattforms-tabell → keyad på verticalId, tidsfönster i stället för
 * tenant-tagg), defensiv — varje miss ger {} så storefronten aldrig kan brytas
 * av en verticals-ändring.
 */
export async function getVerticalCopy(verticalId: string | null): Promise<CopyOverride> {
  if (!verticalId) return {}
  const load = unstable_cache(
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
  return load()
}
