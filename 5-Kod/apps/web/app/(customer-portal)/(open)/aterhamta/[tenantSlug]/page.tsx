import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { RecoveryForm } from '@/components/customer-portal/RecoveryForm'
import { getPortalPublicTenant } from '@/lib/customer-portal/public-tenant'

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function resolveTenant(params: Promise<{ tenantSlug: string }>) {
  const { tenantSlug } = await params
  if (!TENANT_SLUG_PATTERN.test(tenantSlug)) notFound()
  const tenant = await getPortalPublicTenant(tenantSlug)
  if (!tenant) notFound()
  return { tenantSlug, tenant }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  noStore()
  const { tenant } = await resolveTenant(params)
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
  const { tenantSlug, tenant } = await resolveTenant(params)
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
