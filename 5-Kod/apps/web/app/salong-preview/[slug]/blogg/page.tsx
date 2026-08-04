import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { BloggSection } from '@/components/storefront/BloggSection'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { BloggPagination } from '@/components/storefront/blogg/BloggPagination'
import { parseBloggPage } from '@/lib/storefront/blogg/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: bloggens preview-tvilling — samma dispatch som
// app/(public)/blogg/page.tsx men mot PREVIEW-temat. Modul AV → ärligt besked.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Blogg', robots: { index: false } }

export default async function PreviewBloggPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string; copy?: string; page?: string | string[] }>
}) {
  const {
    searchParams: { page: pageParam },
    bundle,
    theme,
    copyMode,
  } = await loadPreviewPage(props)
  const page = parseBloggPage(pageParam)
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
      const copy = await getTenantCopy(bundle, theme, copyMode)
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
        <BloggSection tenantId={tenant.id} slug={tenant.slug} pageHero page={page} data={data} />
      )
    }
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
