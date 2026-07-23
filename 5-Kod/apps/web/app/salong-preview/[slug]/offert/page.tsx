import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { OffertSection } from '@/components/storefront/OffertSection'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-64 (regression, preview-parity): offertens preview-tvilling ANROPADE den
// delade sektionen direkt — en super-admin som förhandsvisade en mall med egen
// offert-vy (?theme=ateljevinter) såg ändå det generiska bandet, medan den skarpa
// sidan visade mallens egen. Nu SAMMA themeModuleViews-dispatch som app/(public)/
// offert/page.tsx, mot PREVIEW-temat (theme, inte settings.theme) så ett obesparat
// mall-byte i editorn följer med hit också.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Offert', robots: { index: false } }

export default async function PreviewOffertPage({
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
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'offert')
  const off = !isModuleLive(states, 'offert') && !paused

  const View = themeModuleViews(theme).offert
  const data = View && !off ? await loadOffertData(tenant.id, tenant.slug) : null

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      {off ? (
        <PreviewModuleOff moduleLabel="Offert" />
      ) : View && data ? (
        <View config={data.config} paused={paused} />
      ) : (
        <OffertSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
      )}
    </PreviewShell>
  )
}
