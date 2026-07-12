import 'server-only'
import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { cleanCopyOverride, type CopyOverride } from './theme-content'
import { branschCopy } from './bransch-copy'

/**
 * Bransch-mall-texten (goal-57 körning 12): Zivars editorial copy-mall per bransch
 * (verticals.default_copy) — kundens startvärde/fallback FÖRE temats hårdkodade
 * THEME_CONTENT. Mönstret speglar staff-noun.ts: separat cachad anon-läsning per
 * vertical (plattforms-tabell → keyad på verticalId, tidsfönster i stället för
 * tenant-tagg), defensiv — varje miss ger {} så storefronten aldrig kan brytas
 * av en verticals-ändring.
 *
 * BRANSCH-LAGRET (Zivar: "branschen avgör mycket av vad som kommer stå"):
 * `verticals.default_copy` är TOM i DB idag → lagret levererade {} → mallens
 * frisör-copy läckte till ALLA branscher. Nu ligger en KOD-DEFAULT under DB-raden
 * (bransch-copy.ts), så en tatueringsstudio aldrig kan hälsa "välkommen till
 * salongen" — ens innan Zivar hunnit fylla i tabellen.
 *
 * Precedens INOM bransch-lagret (fält för fält):
 *     verticals.default_copy (DB)  >  BRANSCH_COPY (kod)
 * DB vinner alltså i samma sekund Zivar skriver en rad — kod-defaulten är golvet,
 * inte taket. Ett TOMT/blankt DB-fält räknas inte som satt (cleanCopyOverride
 * droppar det) → det faller igenom till kod-defaulten i stället för att blanka ut.
 *
 * MERGEN LIGGER MEDVETET UTANFÖR unstable_cache: bara DB-läsningen cachas. Ändrar
 * vi kod-defaulten slår den igenom vid nästa deploy i stället för att sitta fast i
 * ett upp till 300 s gammalt cache-värde.
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
  // Kod-defaulten i botten, DB:s ifyllda fält ovanpå. En DB-miss (tom tabell, borttagen
  // rad, RLS-fel) ger {} → branschens kod-copy står kvar och storefronten är oskadd.
  return { ...branschCopy(verticalId), ...(await loadDbCopy()) }
}
