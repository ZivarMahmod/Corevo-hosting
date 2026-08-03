import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'
import { pageMetadata } from '@/components/storefront/seo'
import { commerceReleaseGate } from '@/lib/release/commerce'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('presentkort')
}

/** Presentkortens EGEN sida. */
export default async function PresentkortPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const commerce = commerceReleaseGate(tenant.id)
  if (!commerce.presentkort) notFound()
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const checkoutLive = isModuleLive(states, 'shop') && commerce.shop
  if (!isModuleLive(states, 'presentkort')) notFound()

  // goal-64 (regression): mallens egen gåvobrev-vy när den finns (filens kort + chips +
  // svarta knapp). Modulen äger datan (loadPresentkortData) + korg-rälsen; formen är mallens.
  const View = themeModuleViews(settings.theme).presentkort
  if (View) {
    const data = await loadPresentkortData(tenant.id, tenant.slug)
    if (!data) notFound()
    return <View config={data.config} paused={!checkoutLive} tenantName={tenant.name} />
  }

  return <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={false} checkoutLive={checkoutLive} />
}
