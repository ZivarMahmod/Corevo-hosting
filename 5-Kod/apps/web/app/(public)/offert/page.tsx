import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { OffertSection } from '@/components/storefront/OffertSection'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('offert')
}

/** Offertens EGEN sida — hela formuläret. Startsidan visar bara en kompakt CTA. */
export default async function OffertPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'offert')
  if (!isModuleLive(states, 'offert') && !paused) notFound()

  // goal-64 (regression): har mallen en egen beställningsverk-vy renderar vi datan i
  // MALLENS form (filens hårlinjefält + svarta knapp). Modulen äger fortfarande datan
  // (loadOffertData) och submiten (submitOffertRequest); bara looken är mallens.
  // Ingen vy → OffertSection, byte-identiskt för de teman som saknar en.
  const View = themeModuleViews(settings.theme).offert
  if (View) {
    const data = await loadOffertData(tenant.id, tenant.slug)
    if (!data) notFound()
    return <View config={data.config} paused={paused} />
  }

  return <OffertSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
}
