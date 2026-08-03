import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { BloggSection } from '@/components/storefront/BloggSection'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { BloggPagination } from '@/components/storefront/blogg/BloggPagination'
import { parseBloggPage } from '@/lib/storefront/blogg/types'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: bloggens preview-tvilling — samma dispatch som
// app/(public)/blogg/page.tsx men mot PREVIEW-temat. Modul AV → ärligt besked.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Blogg', robots: { index: false } }

export default async function PreviewBloggPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string; copy?: string; page?: string | string[] }>
}) {
  const { slug } = await params
  const { theme: themeParam, copy: copyParam, page: pageParam } = await searchParams
  const page = parseBloggPage(pageParam)
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const copyMode = resolvePreviewCopyMode(copyParam)
  const { tenant, settings } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'blogg')

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Blogg" />
  } else {
    const data = await loadBloggData(tenant.id, tenant.slug, page)
    const View = themeModuleViews(theme).blogg
    if (View) {
      const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
      const content = resolveThemeContent(theme, settings.branding, copy)
      body = (
      <>
        <View posts={data?.posts ?? []} content={content} tenantName={tenant.name} />
          {data ? (
            <BloggPagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
          ) : null}
        </>
      )
    } else {
      body = (
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
  }

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      {body}
    </PreviewShell>
  )
}
