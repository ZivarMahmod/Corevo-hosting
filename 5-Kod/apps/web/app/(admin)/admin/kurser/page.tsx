import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { listTenantEvents, listEventRegistrations } from '@/lib/admin/events/data'
import { KursAdmin } from '@/components/admin/KursAdmin'
import { Callout, PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kurser & event · Adminpanel' }

export default async function KurserPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  // Kurser & event är en EGEN modul (0056) — opt-in per kund, rad krävs.
  const states = await getAdminModuleStates(tenant.id)
  if (!isModuleActivated(states, 'kurser')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Kurser & event" />
        <Callout tone="info" icon="info">
          Kurser &amp; event är inte aktiverad för ditt företag. Be plattformsadmin aktivera modulen.
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
      <PageHead eyebrow="Adminpanel" title="Kurser & event" />
      <p className="prose">Inget företag är kopplat till ditt konto.</p>
    </section>
  )
}
