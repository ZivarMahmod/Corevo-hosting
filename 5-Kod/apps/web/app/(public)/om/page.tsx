import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { AboutSplit, StylistSpotlights, AccentPhrase, ClosingCta } from '@/components/storefront/sections'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Om oss' }

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <>
      <AboutSplit salonName={tenant.name} />
      <AccentPhrase text="Varje stol är en stund för sig själv." />
      <StylistSpotlights salonName={tenant.name} />
      <ClosingCta />
    </>
  )
}
