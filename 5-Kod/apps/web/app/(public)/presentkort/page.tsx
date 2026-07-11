import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('presentkort')
}

/** Presentkortens EGEN sida. */
export default async function PresentkortPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'presentkort')
  if (!isModuleLive(states, 'presentkort') && !paused) notFound()

  return <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
}
