import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isBookingActivated } from '@/lib/admin/modules'
import { listTenantEvents, listEventRegistrations } from '@/lib/admin/events/data'
import { KursAdmin } from '@/components/admin/KursAdmin'
import { Callout, PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kurser & event · Salongsadmin' }

export default async function KurserPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  // Kurser & event hänger på booking-modulen. Booking är default-live utan rad
  // (isBookingActivated) — sidan gömmer sig bara vid en EXPLICIT off-rad.
  const states = await getAdminModuleStates(tenant.id)
  if (!isBookingActivated(states)) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Kurser & event" />
        <Callout tone="info" icon="info">
          Bokning är inte aktiverad för din salong. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const [events, registrations] = await Promise.all([
    listTenantEvents(tenant.id),
    listEventRegistrations(tenant.id),
  ])

  return (
    <section className="portal-section">
      <KursAdmin events={events} registrations={registrations} tenantName={tenant.name} />
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Salongsadmin" title="Kurser & event" />
      <p className="prose">Ingen salong är kopplad till ditt konto.</p>
    </section>
  )
}
