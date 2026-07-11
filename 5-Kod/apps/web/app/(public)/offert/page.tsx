import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { OffertSection } from '@/components/storefront/OffertSection'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('offert')
}

/** Offertens EGEN sida — hela formuläret. Startsidan visar bara en kompakt CTA. */
export default async function OffertPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'offert')
  if (!isModuleLive(states, 'offert') && !paused) notFound()

  return <OffertSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
}
