// Team — SERVER data loader (goal-64). Läser kundens EGEN personal ur `staff`.
//
// INTE 'server-only' by import convention: den använder den cookie-lösa anon-klienten
// (säker inuti unstable_cache), exakt som load-blogg.ts / load-galleri.ts. Anropas ändå
// bara från serverkomponenter.
//
// KRITISKT (samma stängsel som tenant-data.ts, ADR 01 §2): `anon` bär INGET tenant_id-
// claim → RLS isolerar INTE tenants för den publika klienten. Queryn filtrerar på det
// upplösta tenant_id:t I APP-LAGRET (.eq('tenant_id', …)). Det är HELA anledningen till
// att teamsidan bara någonsin kan visa kundens egen personal — aldrig grannens.
//
// TVÅ SANNINGSFLAGGOR, båda måste vara true:
//   active       — medarbetaren är bokningsbar över huvud taget (Personal-fliken).
//   show_on_site — medarbetaren VILL synas publikt (Sida-fliken). Rör aldrig bokningen.
// En inaktiv medarbetare visas ALDRIG, oavsett show_on_site.
//
// INGEN MODUL-GATE: teamet är inte en modul (se types.ts). TOM LISTA ÄR ETT GILTIGT SVAR
// — då renderar sidan/mallen inget team alls. Aldrig stock-ansikten som utges för att
// vara kundens folk.

import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { TeamMember } from './types'

/**
 * Ladda kundens publika team. Cachas per tenant och taggas med SAMMA `tenant:<slug>`-tagg
 * som resten av storefronten, så en personaländring i kundkortet (som bustar taggen)
 * syns direkt.
 *
 * Returnerar ALLTID en array — tom när kunden inte har någon synlig personal.
 */
export async function loadTeamMembers(tenantId: string, slug: string): Promise<TeamMember[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<TeamMember[]> => {
      const supabase = createPublicClient()

      const { data: rows } = await supabase
        .from('staff')
        .select('id, title, short_name, specialties, bio, avatar_url')
        .eq('tenant_id', tenantId) // app-lagrets tenant-isolering (RLS gör det INTE för anon)
        .eq('active', true)
        .eq('show_on_site', true)
        .order('created_at', { ascending: true })

      return (
        (rows ?? []) as unknown as {
          id: string
          title: string | null
          short_name: string | null
          specialties: string | null
          bio: string | null
          avatar_url: string | null
        }[]
      )
        .map((r) => {
          const name = r.title?.trim() ?? ''
          return {
            id: r.id,
            name,
            shortName: r.short_name?.trim() || null,
            title: r.title?.trim() || null,
            specialties: r.specialties?.trim() || null,
            bio: r.bio?.trim() || null,
            imageUrl: r.avatar_url ?? null,
          }
        })
        // En namnlös rad är inte en person besökaren kan möta — den utelämnas hellre än
        // renderas som "Namnlös medarbetare" på kundens publika sida.
        .filter((m) => m.name.length > 0)
    },
    ['team-members-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/**
 * Prestanda C1: navlänken /team gatas på FÖREKOMST — layouten laddade hela team-listan
 * (6 fält + mappning) bara för `.length > 0`. Det här är EXAKT samma render-villkor som
 * loadTeamMembers (active + show_on_site + trimmat namn), men drar bara `title`-kolumnen.
 * Team-SIDAN använder fortfarande loadTeamMembers (den behöver fälten). Samma tenant-tag
 * → busts ihop.
 *
 * En head-count går inte: loadTeamMembers släpper rader vars title är NULL *eller*
 * blanksteg (name = title?.trim(); filter name.length>0). En count-i-DB kan inte uttrycka
 * trim utan RPC. Staff-rader per tenant är få → hämta title och filtrera i app-lagret,
 * identiskt med render-filtret. Aldrig en /team-länk till en tom team-sida.
 */
export async function countTeamMembers(tenantId: string, slug: string): Promise<number> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<number> => {
      const supabase = createPublicClient()
      const { data } = await supabase
        .from('staff')
        .select('title')
        .eq('tenant_id', tenantId) // app-lagrets tenant-isolering (RLS gör det INTE för anon)
        .eq('active', true)
        .eq('show_on_site', true)
      return ((data ?? []) as { title: string | null }[]).filter(
        (r) => (r.title?.trim() ?? '').length > 0,
      ).length
    },
    ['team-count-by-tenant', tenantId, norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}
