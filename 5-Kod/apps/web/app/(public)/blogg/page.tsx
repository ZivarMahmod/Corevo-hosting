import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { BloggSection } from '@/components/storefront/BloggSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('blogg')
}

/** Bloggens EGEN sida — alla inlägg. Startsidan visar bara de 3 senaste. */
export default async function BloggPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'blogg')
  if (!isModuleLive(states, 'blogg') && !paused) notFound()

  // VEKTOR-REGELN (goal-59): modulen äger funktionen (gate + data), mallen formen.
  const View = themeModuleViews(settings.theme).blogg
  if (View) {
    const data = await loadBloggData(tenant.id, tenant.slug)
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View posts={data?.posts ?? []} content={content} tenantName={tenant.name} />
  }

  return <BloggSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
}
