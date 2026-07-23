import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { GalleriSection } from '@/components/storefront/galleri/GalleriSection'
import { loadGalleriData } from '@/lib/storefront/galleri/load-galleri'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Galleri', robots: { index: false } }

export default async function PreviewGalleriPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string; copy?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam, copy: copyParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const copyMode = resolvePreviewCopyMode(copyParam)
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'galleri')
  const off = !isModuleLive(states, 'galleri') && !paused
  const View = themeModuleViews(theme).galleri

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Galleri" />
  } else if (View) {
    const data = await loadGalleriData(tenant.id, tenant.slug)
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = <View items={data?.items ?? []} content={content} tenantName={tenant.name} />
  } else {
    body = <GalleriSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
  }

  return <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>{body}</PreviewShell>
}
