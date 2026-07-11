import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/florist/layouts'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('shop')
}

/** Webshoppens EGEN sida ("modulerna ska ha en riktig plats", Zivar 2026-07-11).
 *  Startsidan visar bara en teaser; hela sortimentet bor här. Gate: live/paused
 *  renderar (paused = stängd katalog), draft/off → 404. */
export default async function ShopPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'shop')
  if (!isModuleLive(states, 'shop') && !paused) notFound()

  // VEKTOR-REGELN (goal-59): modulen äger FUNKTIONEN — gaten ovan, datan nedan,
  // varukorgen och kassan. Mallen äger FORMEN: har den en butiksvy renderas samma
  // data i mallens formspråk, så besökaren aldrig lämnar mallens vektor när hen
  // klickar in i butiken. Ingen vy → modulens delade sektion, exakt som förr.
  const View = themeModuleViews(settings.theme).shop
  if (View) {
    const data = await loadShopData(tenant.id, tenant.slug)
    if (!data) notFound()
    const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View data={data} paused={paused} content={content} tenantName={tenant.name} />
  }

  return <ShopSection tenantId={tenant.id} slug={tenant.slug} paused={paused} pageHero />
}
