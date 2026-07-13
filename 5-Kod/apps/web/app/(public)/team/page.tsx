import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { TeamSection } from '@/components/storefront/team/TeamSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadTeamMembers } from '@/lib/storefront/team/load-team'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { branschBokning } from '@/components/storefront/bransch-copy'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('team')
}

/**
 * Teamets EGEN sida (goal-64). De tre salong-mallarna har `team` som nav-punkt.
 *
 * INGEN MODUL-GATE — och det är avsiktligt: teamet är inte en modul, det är kundens
 * FOLK. Sanningen är staff.active && staff.show_on_site (kundens egen av/på per person).
 * Har kunden ingen synlig personal renderar TeamSection null, och layoutens nav-länk
 * visas inte heller — så sidan blir aldrig en tom rubrik utan innehåll.
 */
export default async function TeamPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  const members = await loadTeamMembers(tenant.id, tenant.slug)

  // VEKTOR-REGELN: mallen äger formen, plattformen datan + boknings-kopplingen.
  const View = themeModuleViews(settings.theme).team
  if (View) {
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View members={members} content={content} tenantName={tenant.name} />
  }

  // BRANSCH-REGELN: verbet kommer ur bransch-lagret ("Boka tid hos" / "Boka besök hos" /
  // "Boka konsultation hos"), aldrig hårdkodat.
  const bokning = branschBokning(tenant.vertical_id)
  return <TeamSection members={members} ctaLabel={bokning.hosPrefix} pageHero />
}
