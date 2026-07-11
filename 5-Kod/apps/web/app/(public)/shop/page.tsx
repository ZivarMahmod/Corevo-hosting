import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('shop')
}

/** Webshoppens EGEN sida ("modulerna ska ha en riktig plats", Zivar 2026-07-11).
 *  Startsidan visar bara en teaser; hela sortimentet bor här. Gate: live/paused
 *  renderar (paused = stängd katalog), draft/off → 404. */
export default async function ShopPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'shop')
  if (!isModuleLive(states, 'shop') && !paused) notFound()

  return <ShopSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
}
