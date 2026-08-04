import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { LojalitetPage } from '@/components/storefront/lojalitet/LojalitetPage'
import { pageMetadata } from '@/components/storefront/seo'
import { loadLojalitetData } from '@/lib/storefront/lojalitet/load-lojalitet'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('klubb')
}

/**
 * KLUBBEN (/klubb) — lojalitet-modulens EGNA sida (goal-64).
 *
 * Sidan är modul-gatad: av → notFound. När modulen är live vinner mallens egen vy
 * över den delade sektionen; modulen äger funktionen och datan, mallen formen.
 *
 * Gaten är HELIG åt båda hållen: den här sidan 404:ar när modulen är av, och därför får
 * INGEN mall länka hit när den är av (se lojalitetReachable i layouts/types.ts).
 */
export default async function KlubbPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'lojalitet')) notFound()

  const data = await loadLojalitetData(tenant.id, tenant.slug)
  // Modulen är live men har ingen config-rad → ingenting att visa. 404 hellre än en
  // rubrik utan innehåll.
  if (!data) notFound()

  const View = themeModuleViews(settings.theme).lojalitet
  if (View) {
    const copy = await getTenantCopy(bundle)
    const content = resolveThemeContent(settings.theme, settings.branding, copy)
    return (
      <View
        config={data.config}
        plans={data.plans}
        content={content}
        tenantName={tenant.name}
      />
    )
  }

  return <LojalitetPage config={data.config} plans={data.plans} />
}
