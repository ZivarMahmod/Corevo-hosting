import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { RecoveryForm } from '@/components/customer-portal/RecoveryForm'
import { requirePortalPublicTenant } from '@/lib/customer-portal/public-tenant'

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
    title: `Kom åt dina bokningar – ${tenant.tenantName}`,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  }
}

export default async function RecoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>
  searchParams?: Promise<{ session?: string | string[] }>
}) {
  noStore()
  const { tenantSlug, tenant } = await requirePortalPublicTenant(params)
  const query = await searchParams

  return (
    <PortalShell variant="recovery">
      <RecoveryForm
        tenantSlug={tenantSlug}
        tenantName={tenant.tenantName}
        sessionExpired={query?.session === 'expired'}
      />
    </PortalShell>
  )
}
