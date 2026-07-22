import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import {
  NextBookingCard,
  PortalErrorState,
  TenantIdentityCard,
} from '@/components/customer-portal/PortalViews'
import { getPortalSessionSnapshot, listPortalBookings } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSessionSnapshot()
  return {
    title: session.outcome === 'ok' ? `Bokningar – ${session.snapshot.tenantName}` : 'Bokningar – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalHomePage() {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return <PortalShell active="bookings"><PortalErrorState variant="server" /></PortalShell>
  }

  const upcoming = await listPortalBookings({ scope: 'upcoming', pageSize: 20 })
  if (upcoming.outcome === 'expired') redirect(`/aterhamta/${session.snapshot.tenantSlug}?session=expired`)
  if (upcoming.outcome !== 'ok') {
    return (
      <PortalShell active="bookings" customerName={session.snapshot.customerName}>
        <TenantIdentityCard snapshot={session.snapshot} />
        <PortalErrorState variant="fetch-bookings" headingLevel="h3" />
      </PortalShell>
    )
  }

  let hasHistory = true
  if (upcoming.items.length === 0) {
    const history = await listPortalBookings({ scope: 'history', pageSize: 1 })
    if (history.outcome === 'expired') redirect(`/aterhamta/${session.snapshot.tenantSlug}?session=expired`)
    if (history.outcome !== 'ok') {
      return (
        <PortalShell active="bookings" customerName={session.snapshot.customerName}>
          <TenantIdentityCard snapshot={session.snapshot} />
          <PortalErrorState variant="fetch-bookings" headingLevel="h3" />
        </PortalShell>
      )
    }
    hasHistory = history.items.length > 0
  }

  return (
    <PortalShell active="bookings" customerName={session.snapshot.customerName}>
      <TenantIdentityCard snapshot={session.snapshot} />
      <NextBookingCard
        snapshot={session.snapshot}
        items={upcoming.items}
        hasHistory={hasHistory}
      />
    </PortalShell>
  )
}
