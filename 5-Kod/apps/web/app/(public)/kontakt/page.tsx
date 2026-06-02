import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kontakt' }

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const content = resolveThemeContent(settings.theme, settings.branding)

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
