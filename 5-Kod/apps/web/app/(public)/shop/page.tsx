import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { pageMetadata } from '@/components/storefront/seo'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import { commerceReleaseGate } from '@/lib/release/commerce'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('shop')
}

/** Full catalog; the route exists only while shop is live. */
export default async function ShopPage({
  searchParams,
}: {
  // goal-64: butikens filterchips är <Link>-taggar (`/shop?kategori=Rosor`), inte klient-state.
  // Filtret läses HÄR och filtreras server-side i loadern → chipsen fungerar utan JS, kan
  // indexeras av sök, och en delad länk visar samma urval för mottagaren.
  searchParams?: Promise<{ kategori?: string | string[] }>
}) {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  if (!commerceReleaseGate(tenant.id).shop) notFound()
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) notFound()

  const sp = (await searchParams) ?? {}
  const rawCat = Array.isArray(sp.kategori) ? sp.kategori[0] : sp.kategori
  const category = rawCat?.trim() || null

  // VEKTOR-REGELN (goal-59): modulen äger FUNKTIONEN — gaten ovan, datan nedan,
  // varukorgen och kassan. Mallen äger FORMEN: har den en butiksvy renderas samma
  // data i mallens formspråk, så besökaren aldrig lämnar mallens vektor när hen
  // klickar in i butiken. Ingen vy → modulens delade sektion, exakt som förr.
  const View = themeModuleViews(settings.theme).shop
  if (View) {
    const data = await loadShopData(tenant.id, tenant.slug, category)
    if (!data) notFound()
    const copy = await getTenantCopy(bundle)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return <View data={data} content={content} tenantName={tenant.name} />
  }

  return <ShopSection tenantId={tenant.id} slug={tenant.slug} pageHero />
}
