import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-64 (regression, preview-parity): presentkortets preview-tvilling anropade den
// delade sektionen direkt — samma dispatch-gap som offerten. Nu SAMMA themeModuleViews-
// dispatch som app/(public)/presentkort/page.tsx, mot PREVIEW-temat.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Presentkort', robots: { index: false } }

export default async function PreviewPresentkortPage({
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
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'presentkort')
  const off = !isModuleLive(states, 'presentkort') && !paused

  const View = themeModuleViews(theme).presentkort
  const data = View && !off ? await loadPresentkortData(tenant.id, tenant.slug) : null

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {off ? (
        <PreviewModuleOff moduleLabel="Presentkort" />
      ) : View && data ? (
        <View config={data.config} paused={paused} tenantName={tenant.name} />
      ) : (
        <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
      )}
    </PreviewShell>
  )
}
