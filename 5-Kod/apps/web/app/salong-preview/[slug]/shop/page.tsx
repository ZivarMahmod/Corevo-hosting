import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { ShopSection } from '@/components/storefront/ShopSection'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, PreviewModuleOff, type PreviewPageProps } from '../preview-shell'

// goal-61 preview-parity: butikens preview-tvilling. Zivar redigerade tidigare en butik
// han inte kunde SE — modulsidorna saknade tvillingar under /salong-preview. Samma
// dispatch som app/(public)/shop/page.tsx, men mot PREVIEW-temat (?theme=) så ett
// mall-byte i editorn följer med hela vägen in i butiken. Modul AV → ärligt besked,
// inte 404 (editorn ska förklara, inte krascha).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Butik', robots: { index: false } }

export default async function PreviewShopPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const off = !isModuleLive(states, 'shop')

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Webshop" />
  } else {
    const View = themeModuleViews(theme).shop
    const data = View ? await loadShopData(tenant.id, tenant.slug) : null
    if (View && data) {
      const copy = await getTenantCopy(bundle, theme, copyMode)
      const content = resolveThemeContent(theme, settings.branding, copy)
      body = <View data={data} content={content} tenantName={tenant.name} />
    } else {
      body = <ShopSection tenantId={tenant.id} slug={tenant.slug} pageHero />
    }
  }

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      {body}
    </StorefrontShell>
  )
}
