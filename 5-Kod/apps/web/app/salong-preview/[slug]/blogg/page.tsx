import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadBloggData } from '@/lib/storefront/blogg/load-blogg'
import { BloggSection } from '@/components/storefront/BloggSection'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: bloggens preview-tvilling — samma dispatch som
// app/(public)/blogg/page.tsx men mot PREVIEW-temat. Modul AV → ärligt besked.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Blogg', robots: { index: false } }

export default async function PreviewBloggPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const { tenant, settings } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'blogg')
  const off = !isModuleLive(states, 'blogg') && !paused

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Blogg" />
  } else {
    const View = themeModuleViews(theme).blogg
    if (View) {
      const data = await loadBloggData(tenant.id, tenant.slug)
      const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme)
      const content = resolveThemeContent(theme, settings.branding, copy)
      body = <View posts={data?.posts ?? []} content={content} tenantName={tenant.name} />
    } else {
      body = <BloggSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
    }
  }

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {body}
    </PreviewShell>
  )
}
