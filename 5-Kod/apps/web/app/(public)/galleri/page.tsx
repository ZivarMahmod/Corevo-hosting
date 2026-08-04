import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { GalleriSection } from '@/components/storefront/galleri/GalleriSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('galleri')
}

/** Gallery route; unavailable while the module is off. */
export default async function GalleriPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'galleri')) notFound()

  // VEKTOR-REGELN (goal-59): modulen äger funktionen (gate + data), mallen formen.
  const View = themeModuleViews(settings.theme).galleri
  if (View) {
    const data = await loadGalleriData(tenant.id, tenant.slug)
    const copy = await getTenantCopy(bundle)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View items={data?.items ?? []} content={content} tenantName={tenant.name} />
  }

  return <GalleriSection tenantId={tenant.id} slug={tenant.slug} pageHero />
}
