import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { PinVerificationForm } from '@/components/customer-portal/PinVerificationForm'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { requirePortalPublicTenant } from '@/lib/customer-portal/public-tenant'
import { getRecoveryStateAction } from '@/lib/customer-portal/recovery-actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  noStore()
  const { tenant } = await requirePortalPublicTenant(params)
  return {
    title: `Ange koden – ${tenant.tenantName}`,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  }
}

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  noStore()
  const { tenantSlug } = await requirePortalPublicTenant(params)
  const state = await getRecoveryStateAction(tenantSlug)

  return (
    <PortalShell variant="recovery">
      <PinVerificationForm tenantSlug={tenantSlug} initialState={state} />
    </PortalShell>
  )
}
