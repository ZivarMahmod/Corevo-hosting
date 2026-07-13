import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { GalleriSection } from '@/components/storefront/galleri/GalleriSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('galleri')
}

/**
 * Galleriets EGEN sida (goal-64). Alla 12 Claude Design-paket har `/galleri` i sitt
 * manifest — Ateljé Vinters nav länkade redan dit, och sidan fanns inte (404).
 *
 * MODUL-GATEN ÄR HELIG: galleri är en EGEN modul (0057), och en modul som inte är
 * live/paused ger NOLL sida. Layoutens nav-länk är gatad på samma villkor, så en
 * avstängd modul aldrig kan lämna en länk som pekar i tomma luften.
 */
export default async function GalleriPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'galleri')
  if (!isModuleLive(states, 'galleri') && !paused) notFound()

  // VEKTOR-REGELN (goal-59): modulen äger funktionen (gate + data), mallen formen.
  const View = themeModuleViews(settings.theme).galleri
  if (View) {
    const data = await loadGalleriData(tenant.id, tenant.slug)
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View items={data?.items ?? []} content={content} tenantName={tenant.name} />
  }

  return <GalleriSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
}
