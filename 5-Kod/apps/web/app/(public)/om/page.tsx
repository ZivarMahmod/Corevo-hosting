import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { AboutSplit, StylistSpotlights, AccentPhrase, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { pageMetadata } from '@/components/storefront/seo'
import { themePages } from '@/components/storefront/layouts/florist/layouts'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('om')
}

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)

  // goal-59 TEMA-PAKET: äger mallen sin Om-sida renderar VI den. Undersidorna var
  // identiska för alla 20 mallar — samma AboutSplit, samma team-rad, samma closing —
  // vilket gjorde att varje mall föll tillbaka i samma sida så fort man lämnade hemmet.
  const Page = themePages(settings.theme).om
  if (Page) {
    const services = await getServices(tenant.id, tenant.slug)
    return (
      <Page
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        content={content}
        services={services}
        location={location}
        contact={settings.contact}
      />
    )
  }

  return (
    <>
      <AboutSplit salonName={tenant.name} content={content} />
      <AccentPhrase text={content.italic} />
      <StylistSpotlights salonName={tenant.name} content={content} />
      <ClosingCta content={content} />
    </>
  )
}
