import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('kontakt')
}

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)

  return (
    <>
      {/* LocationHours renders the salon's REAL address + opening hours + contact
          (email/phone) from its saved settings/location, plus a map link to the
          real address. Each field degrades gracefully — an honest "Visas snart"
          placeholder (and the map is omitted) until that field is filled in. */}
      <LocationHours salonName={tenant.name} />
      <ClosingCta content={content} />
    </>
  )
}
