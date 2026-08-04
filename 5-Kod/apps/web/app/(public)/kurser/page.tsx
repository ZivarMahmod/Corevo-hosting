import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadUpcomingEvents, loadKurserConfig } from '@/lib/storefront/kurser/load-kurser'
import { KurserSection } from '@/components/storefront/kurser/KurserSection'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { pageMetadata } from '@/components/storefront/seo'
import { commerceReleaseGate } from '@/lib/release/commerce'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('kurser')
}

/** Upcoming events; the route exists only while kurser is live. */
export default async function KurserPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const checkoutLive = isModuleLive(states, 'shop') && commerceReleaseGate(tenant.id).shop
  if (!isModuleLive(states, 'kurser')) notFound()

  const View = themeModuleViews(settings.theme).kurser
  if (View) {
    const [events, config] = await Promise.all([
      loadUpcomingEvents(tenant.id, tenant.slug),
      loadKurserConfig(tenant.id, tenant.slug),
    ])
    return <View events={events} config={config} checkoutLive={checkoutLive} />
  }

  return (
    <KurserSection
      tenantId={tenant.id}
      slug={tenant.slug}
      checkoutLive={checkoutLive}
      pageHero
    />
  )
}
