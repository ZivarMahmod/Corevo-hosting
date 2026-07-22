import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { PortalErrorState } from '@/components/customer-portal/PortalViews'
import { BookingHistoryListClient } from '@/components/customer-portal/BookingHistoryListClient'
import { listPortalBookings, getPortalSessionSnapshot } from '@/lib/customer-portal/data'
import { loadMorePortalHistory } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSessionSnapshot()
  return {
    title: session.outcome === 'ok' ? `Historik – ${session.snapshot.tenantName}` : 'Historik – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalHistoryPage() {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return <PortalShell active="history"><PortalErrorState variant="server" /></PortalShell>
  }

  const history = await listPortalBookings({ scope: 'history', pageSize: 20 })
  if (history.outcome === 'expired') redirect(`/aterhamta/${session.snapshot.tenantSlug}?session=expired`)
  if (history.outcome !== 'ok') {
    return <PortalShell active="history" customerName={session.snapshot.customerName}><h1>Historik</h1><PortalErrorState variant="fetch-history" headingLevel="h3" /></PortalShell>
  }

  return (
    <PortalShell active="history" customerName={session.snapshot.customerName}>
      <BookingHistoryListClient
        snapshot={session.snapshot}
        initialItems={history.items}
        initialCursor={history.hasMore ? history.nextCursor : null}
        loadMore={loadMorePortalHistory}
      />
    </PortalShell>
  )
}
