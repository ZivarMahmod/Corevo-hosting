import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { loadPartnerSummaries } from '@/lib/platform/partners'
import { PartnerListClient } from '@/components/platform/partners/PartnerListClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Partners' }

export default async function PartnersPage() {
  await requirePlatformAdmin()
  const partners = await loadPartnerSummaries()
  return <section className="portal-section"><PartnerListClient partners={partners} /></section>
}
