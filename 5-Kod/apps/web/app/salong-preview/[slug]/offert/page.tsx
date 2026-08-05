import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { OffertSection } from '@/components/storefront/OffertSection'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { loadOffertData } from '@/lib/storefront/offert/load-offert'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

// goal-64 (regression, preview-parity): offertens preview-tvilling ANROPADE den
// delade sektionen direkt — en super-admin som förhandsvisade en mall med egen
// offert-vy (?theme=ateljevinter) såg ändå det generiska bandet, medan den skarpa
// sidan visade mallens egen. Nu SAMMA themeModuleViews-dispatch som app/(public)/
// offert/page.tsx, mot PREVIEW-temat (theme, inte settings.theme) så ett obesparat
// mall-byte i editorn följer med hit också.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Offert', robots: { index: false } }

export default async function PreviewOffertPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'offert')

  const View = themeModuleViews(theme).offert
  const data = View && !off ? await loadOffertData(tenant.id, tenant.slug) : null

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {off ? (
        <PreviewModuleOff moduleLabel="Offert" />
      ) : View && data ? (
        <View config={data.config} />
      ) : (
        <OffertSection tenantId={tenant.id} slug={tenant.slug} pageHero />
      )}
    </StorefrontShell>
  )
}
