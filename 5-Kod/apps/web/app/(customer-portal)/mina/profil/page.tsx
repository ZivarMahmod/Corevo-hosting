import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  CustomerProfileCard,
  CustomerProfileUnavailable,
} from '@/components/customer-portal/CustomerProfileCard'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { getPortalProfileSnapshot } from '@/lib/customer-portal/profile'
import { getPortalSessionSnapshot } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const result = await getPortalProfileSnapshot()
  return {
    title: result.outcome === 'ok' ? `Profil – ${result.profile.tenantName}` : 'Profil – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalProfilePage() {
  const result = await getPortalProfileSnapshot()
  if (result.outcome === 'expired' && result.recoveryTenantSlug) {
    redirect(`/aterhamta/${result.recoveryTenantSlug}?session=expired`)
  }
  if (result.outcome !== 'ok') {
    const session = await getPortalSessionSnapshot()
    if (session.outcome === 'expired' && session.recoveryTenantSlug) {
      redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
    }
    if (session.outcome === 'ok') {
      return (
        <PortalShell
          active="profile"
          customerName={session.snapshot.customerName}
          tenantSlug={session.snapshot.tenantSlug}
        >
          <CustomerProfileUnavailable logoutAvailable />
        </PortalShell>
      )
    }
    return (
      <PortalShell active="profile">
        <CustomerProfileUnavailable logoutAvailable={false} />
      </PortalShell>
    )
  }

  return (
    <PortalShell
      active="profile"
      customerName={result.profile.customerName}
      tenantSlug={result.profile.tenantSlug}
    >
      <CustomerProfileCard
        tenantName={result.profile.tenantName}
        customerName={result.profile.customerName}
        verifiedContact={result.profile.verifiedContact}
        secondaryContact={result.profile.secondaryContact}
      />
    </PortalShell>
  )
}
