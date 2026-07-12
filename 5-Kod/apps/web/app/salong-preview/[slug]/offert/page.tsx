import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { OffertSection } from '@/components/storefront/OffertSection'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: offertens preview-tvilling (delad sektion, ingen tema-dispatch).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Offert', robots: { index: false } }

export default async function PreviewOffertPage({
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
  const paused = isModulePaused(states, 'offert')
  const off = !isModuleLive(states, 'offert') && !paused

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {off ? (
        <PreviewModuleOff moduleLabel="Offert" />
      ) : (
        <OffertSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
      )}
    </PreviewShell>
  )
}
