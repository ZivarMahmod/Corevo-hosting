import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { loadPartnerAdminDetail } from '@/lib/platform/partners'
import { PartnerDetailClient } from '@/components/platform/partners/PartnerDetailClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Partner' }

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin()
  const { id } = await params
  const detail = await loadPartnerAdminDetail(id)
  if (!detail.summary) notFound()
  return (
    <section className="portal-section">
      <PartnerDetailClient
        partner={detail.summary}
        tenants={detail.tenants}
        history={detail.history}
        smsSender={detail.smsSender}
      />
    </section>
  )
}
