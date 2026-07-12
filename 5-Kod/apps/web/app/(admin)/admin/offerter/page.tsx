import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated } from '@/lib/admin/modules'
import { listOffertRequests } from '@/lib/admin/offert/data'
import { OffertInbox } from '@/components/admin/OffertInbox'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Offertförfrågningar · Adminpanel' }

export default async function OfferterPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Offertförfrågningar" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'offert')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Offertförfrågningar" />
        <Callout tone="info" icon="info">
          Offert är inte aktiverad för ditt företag. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const requests = await listOffertRequests(tenant.id)

  return (
    <section className="portal-section">
      <OffertInbox requests={requests} tenantName={tenant.name} />
    </section>
  )
}
