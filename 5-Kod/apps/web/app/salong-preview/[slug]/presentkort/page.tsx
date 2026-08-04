import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { loadPresentkortData } from '@/lib/storefront/presentkort/load-presentkort'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

// goal-64 (regression, preview-parity): presentkortets preview-tvilling anropade den
// delade sektionen direkt — samma dispatch-gap som offerten. Nu SAMMA themeModuleViews-
// dispatch som app/(public)/presentkort/page.tsx, mot PREVIEW-temat.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Förhandsvisning · Presentkort',
  robots: { index: false },
}

export default async function PreviewPresentkortPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const checkoutLive = isModuleLive(states, 'shop') && commerceReleaseGate(tenant.id).shop
  const off = !isModuleLive(states, 'presentkort')
  const View = themeModuleViews(theme).presentkort
  const data = View && !off ? await loadPresentkortData(tenant.id, tenant.slug) : null

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {off ? (
        <PreviewModuleOff moduleLabel="Presentkort" />
      ) : View && data ? (
        <View config={data.config} purchaseClosed={!checkoutLive} tenantName={tenant.name} />
      ) : (
        <PresentkortSection tenantId={tenant.id} slug={tenant.slug} checkoutLive={checkoutLive} />
      )}
    </StorefrontShell>
  )
}
