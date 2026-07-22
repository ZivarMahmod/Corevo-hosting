import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import { PinVerificationForm } from '@/components/customer-portal/PinVerificationForm'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { getPortalPublicTenant } from '@/lib/customer-portal/public-tenant'
import { getRecoveryStateAction } from './actions'

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
  const { tenantSlug } = await resolveTenant(params)
  const state = await getRecoveryStateAction(tenantSlug)

  return (
    <PortalShell variant="recovery">
      <PinVerificationForm mode="recovery" tenantSlug={tenantSlug} initialState={state} />
    </PortalShell>
  )
}
