import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { LojalitetPage } from '@/components/storefront/lojalitet/LojalitetPage'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Klubben', robots: { index: false } }

export default async function PreviewKlubbPage({
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
  const paused = isModulePaused(states, 'lojalitet')
  const off = !isModuleLive(states, 'lojalitet') && !paused
  const data = off ? null : await loadLojalitetData(tenant.id, tenant.slug)
  const View = themeModuleViews(theme).lojalitet

  let body
  if (off || !data) {
    body = <PreviewModuleOff moduleLabel="Klubben" />
  } else if (View) {
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
    const content = resolveThemeContent(theme, settings.branding, copy)
    body = <View config={data.config} plans={data.plans} content={content} tenantName={tenant.name} />
  } else {
    body = <LojalitetPage config={data.config} plans={data.plans} paused={paused} />
  }

  return <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>{body}</PreviewShell>
}
