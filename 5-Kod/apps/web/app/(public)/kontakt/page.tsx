import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kontakt' }

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <>
      {/* Graceful placeholders: the public data layer doesn't expose address /
          phone / opening hours yet (crossModuleGaps). LocationHours shows
          "Visas snart" + a neutral map until the salon fills in its profile. */}
      <LocationHours salonName={tenant.name} />
      <ClosingCta />
    </>
  )
}
