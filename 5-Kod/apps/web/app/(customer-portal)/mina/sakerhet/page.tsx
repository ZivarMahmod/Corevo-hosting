import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { SecurityDevicesPanel } from '@/components/customer-portal/SecurityDevicesPanel'
import { getPortalSessionSnapshot } from '@/lib/customer-portal/data'
import { getPortalSecuritySnapshot } from '@/lib/customer-portal/security-devices'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Säkerhet och enheter – Corevo',
  robots: { index: false, follow: false },
}

export default async function CustomerPortalSecurityPage() {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return (
      <PortalShell active="profile">
        <section className="cp-card cp-error"><h1>Säkerheten kunde inte visas</h1></section>
      </PortalShell>
    )
  }

  const security = await getPortalSecuritySnapshot()
  if (security.outcome === 'expired') {
    redirect(`/aterhamta/${session.snapshot.tenantSlug}?session=expired`)
  }

  return (
    <PortalShell
      active="profile"
      customerName={session.snapshot.customerName}
      tenantName={session.snapshot.tenantName}
      tenantSlug={session.snapshot.tenantSlug}
    >
      {security.outcome === 'ok' ? (
        <SecurityDevicesPanel
          locale={session.snapshot.locale}
          timezone={session.snapshot.timezone}
          sessions={security.sessions}
          bookingTrusts={security.bookingTrusts}
        />
      ) : (
        <section className="cp-card cp-error">
          <h1>Säkerheten kunde inte visas</h1>
          <a className="cp-btn" href="">Försök igen</a>
        </section>
      )}
    </PortalShell>
  )
}
