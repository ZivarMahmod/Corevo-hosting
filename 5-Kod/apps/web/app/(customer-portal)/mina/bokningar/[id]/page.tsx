import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PortalShell } from '@/components/customer-portal/PortalShell'
import { BookingDetail, PortalErrorState } from '@/components/customer-portal/PortalViews'
import { getPortalBooking, getPortalSessionSnapshot } from '@/lib/customer-portal/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSessionSnapshot()
  return {
    title: session.outcome === 'ok' ? `Bokning – ${session.snapshot.tenantName}` : 'Bokning – Corevo',
    robots: { index: false, follow: false },
  }
}

export default async function CustomerPortalBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string | string[] }>
}) {
  const session = await getPortalSessionSnapshot()
  if (session.outcome === 'expired' && session.recoveryTenantSlug) {
    redirect(`/aterhamta/${session.recoveryTenantSlug}?session=expired`)
  }
  if (session.outcome !== 'ok') {
    return <PortalShell active="bookings" detailBackTarget="/mina"><PortalErrorState variant="server" /></PortalShell>
  }

  const { id } = await params
  const query = await searchParams
  const backTarget = query?.from === 'history' ? '/mina/historik' : '/mina'
  const detail = await getPortalBooking(id)
  if (detail.outcome === 'expired') redirect(`/aterhamta/${session.snapshot.tenantSlug}?session=expired`)
  if (detail.outcome === 'not_found') {
    return <PortalShell active="bookings" customerName={session.snapshot.customerName} tenantSlug={session.snapshot.tenantSlug} detailBackTarget="/mina"><PortalErrorState variant="not-found" /></PortalShell>
  }
  if (detail.outcome !== 'ok') {
    return <PortalShell active="bookings" customerName={session.snapshot.customerName} tenantSlug={session.snapshot.tenantSlug} detailBackTarget="/mina"><PortalErrorState variant="fetch-detail" /></PortalShell>
  }

  return (
    <PortalShell active="bookings" customerName={session.snapshot.customerName} tenantSlug={session.snapshot.tenantSlug} detailBackTarget={backTarget}>
      <BookingDetail snapshot={session.snapshot} booking={detail.booking} backTarget={backTarget} />
    </PortalShell>
  )
}
