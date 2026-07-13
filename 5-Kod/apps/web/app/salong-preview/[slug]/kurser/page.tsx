import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import KurserPage from '@/app/(public)/kurser/page'
import { loadUpcomingEvents, loadKurserConfig } from '@/lib/storefront/kurser/load-kurser'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity, uppdaterad goal-64 (regression): kurssidan HAR numera
// tema-dispatch (themeModuleViews(...).kurser) — men denna tvilling återanvände
// bara <KurserPage /> rakt av, som läser tenantens SPARADE tema via currentTenant().
// En operatör som förhandsvisade ett OBESPARAT mall-byte (?theme=ateljevinter) såg
// därför fortfarande den delade kurs-listan. Nu läser tvillingen samma dispatch mot
// PREVIEW-temat (theme, override-medveten); saknar mallen en egen vy faller den
// tillbaka på <KurserPage /> precis som förut — byte-identiskt för de 11 mallar
// som inte äger sina seminarier.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Kurser', robots: { index: false } }

export default async function PreviewKurserPage({
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
  const paused = isModulePaused(states, 'kurser')
  const off = !isModuleLive(states, 'kurser') && !paused

  const View = themeModuleViews(theme).kurser
  const data =
    View && !off
      ? await Promise.all([loadUpcomingEvents(tenant.id, tenant.slug), loadKurserConfig(tenant.id, tenant.slug)])
      : null

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {off ? (
        <PreviewModuleOff moduleLabel="Kurser & event" />
      ) : View && data ? (
        <View events={data[0]} config={data[1]} paused={paused} />
      ) : (
        <KurserPage />
      )}
    </PreviewShell>
  )
}
