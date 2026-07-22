import { PortalShell } from '@/components/customer-portal/PortalShell'
import { BookingDetail, PortalErrorState } from '@/components/customer-portal/PortalViews'
import { getPortalBooking, getPortalSessionSnapshot } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function CustomerPortalBookingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getPortalSessionSnapshot()
  if (session.outcome !== 'ok') {
    return <PortalShell active="bookings" detailBackTarget="/mina"><PortalErrorState variant="server" /></PortalShell>
  }

  const { id } = await params
  const detail = await getPortalBooking(id)
  if (detail.outcome === 'not_found') {
    return <PortalShell active="bookings" customerName={session.snapshot.customerName} detailBackTarget="/mina"><PortalErrorState variant="not-found" /></PortalShell>
  }
  if (detail.outcome !== 'ok') {
    return <PortalShell active="bookings" customerName={session.snapshot.customerName} detailBackTarget="/mina"><PortalErrorState variant="fetch-detail" /></PortalShell>
  }

  return (
    <PortalShell active="bookings" customerName={session.snapshot.customerName} detailBackTarget="/mina">
      <BookingDetail snapshot={session.snapshot} booking={detail.booking} />
    </PortalShell>
  )
}
