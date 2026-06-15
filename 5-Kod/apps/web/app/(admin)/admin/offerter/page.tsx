import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listOffertRequests } from '@/lib/admin/offert/data'
import { OffertInbox } from '@/components/admin/OffertInbox'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Offertförfrågningar · Salongsadmin' }

export default async function OfferterPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Offertförfrågningar" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'offert')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Offertförfrågningar" />
        <Callout tone="info" icon="info">
          Offert är inte aktiverad för din salong. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const requests = await listOffertRequests(tenant.id)
  const config = moduleAdminConfig(states, 'offert')
  const variant = typeof config.variant === 'string' ? config.variant : null

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Offertförfrågningar">
        {variant && (
          <span className="eyebrow" style={{ color: 'var(--c-ink-3)', fontWeight: 500 }}>
            Variant: {variant}
          </span>
        )}
      </PageHead>
      <OffertInbox requests={requests} />
    </section>
  )
}
