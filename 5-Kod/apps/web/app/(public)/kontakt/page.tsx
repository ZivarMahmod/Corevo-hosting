import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { pageMetadata } from '@/components/storefront/seo'
import { themePages } from '@/components/storefront/layouts/florist/layouts'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('kontakt')
}

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)

  // goal-59 TEMA-PAKET: mallens egen kontaktsida när den äger den (se om/page.tsx).
  const Page = themePages(settings.theme).kontakt
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
      {/* LocationHours renders the salon's REAL address + opening hours + contact
          (email/phone) from its saved settings/location, plus a map link to the
          real address. Each field degrades gracefully — an honest "Visas snart"
          placeholder (and the map is omitted) until that field is filled in. */}
      <LocationHours salonName={tenant.name} content={content} />
      <ClosingCta content={content} />
    </>
  )
}
