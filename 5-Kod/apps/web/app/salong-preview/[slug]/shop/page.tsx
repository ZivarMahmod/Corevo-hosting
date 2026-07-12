import type { Metadata } from 'next'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { ShopSection } from '@/components/storefront/ShopSection'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell, PreviewModuleOff } from '../preview-shell'

// goal-61 preview-parity: butikens preview-tvilling. Zivar redigerade tidigare en butik
// han inte kunde SE — modulsidorna saknade tvillingar under /salong-preview. Samma
// dispatch som app/(public)/shop/page.tsx, men mot PREVIEW-temat (?theme=) så ett
// mall-byte i editorn följer med hela vägen in i butiken. Modul AV → ärligt besked,
// inte 404 (editorn ska förklara, inte krascha).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Butik', robots: { index: false } }

export default async function PreviewShopPage({
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
  const { tenant, settings } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'shop')
  const off = !isModuleLive(states, 'shop') && !paused

  let body
  if (off) {
    body = <PreviewModuleOff moduleLabel="Webshop" />
  } else {
    const View = themeModuleViews(theme).shop
    const data = View ? await loadShopData(tenant.id, tenant.slug) : null
    if (View && data) {
      const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
      const content = resolveThemeContent(theme, settings.branding, copy)
      body = <View data={data} paused={paused} content={content} tenantName={tenant.name} />
    } else {
      body = <ShopSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
    }
  }

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      {body}
    </PreviewShell>
  )
}
