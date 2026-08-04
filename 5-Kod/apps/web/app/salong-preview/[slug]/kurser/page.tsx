import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadUpcomingEvents, loadKurserConfig } from '@/lib/storefront/kurser/load-kurser'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { KurserSection } from '@/components/storefront/kurser/KurserSection'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

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

export default async function PreviewKurserPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const checkoutLive = isModuleLive(states, 'shop') && commerceReleaseGate(tenant.id).shop
  const off = !isModuleLive(states, 'kurser')

  const View = themeModuleViews(theme).kurser
  const data =
    View && !off
      ? await Promise.all([
          loadUpcomingEvents(tenant.id, tenant.slug),
          loadKurserConfig(tenant.id, tenant.slug),
        ])
      : null

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {off ? (
        <PreviewModuleOff moduleLabel="Kurser & event" />
      ) : View && data ? (
        <View events={data[0]} config={data[1]} checkoutLive={checkoutLive} />
      ) : (
        <KurserSection
          tenantId={tenant.id}
          slug={tenant.slug}
          checkoutLive={checkoutLive}
          pageHero
        />
      )}
    </StorefrontShell>
  )
}
