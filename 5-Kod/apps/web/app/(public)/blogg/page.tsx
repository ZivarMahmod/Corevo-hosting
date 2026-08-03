import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { BloggSection } from '@/components/storefront/BloggSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { BloggPagination } from '@/components/storefront/blogg/BloggPagination'
import { parseBloggPage } from '@/lib/storefront/blogg/types'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('blogg')
}

/** Bloggens EGEN sida — alla inlägg. Startsidan visar bara de 3 senaste. */
export default async function BloggPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const page = parseBloggPage((await searchParams).page)
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'blogg')) notFound()

  const data = await loadBloggData(tenant.id, tenant.slug, page)
  if (data && page > data.pagination.totalPages) notFound()

  // VEKTOR-REGELN (goal-59): modulen äger funktionen (gate + data), mallen formen.
  const View = themeModuleViews(settings.theme).blogg
  if (View) {
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return (
      <>
        <View posts={data?.posts ?? []} content={content} tenantName={tenant.name} />
        {data ? (
          <BloggPagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
        ) : null}
      </>
    )
  }

  return (
    <BloggSection
      tenantId={tenant.id}
      slug={tenant.slug}
      paused={false}
      pageHero
      page={page}
      data={data}
    />
  )
}
