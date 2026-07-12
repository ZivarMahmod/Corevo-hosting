import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: presentkortens preview-tvilling (delad sektion).
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

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {off ? (
        <PreviewModuleOff moduleLabel="Presentkort" />
      ) : (
        <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
      )}
    </PreviewShell>
  )
}
