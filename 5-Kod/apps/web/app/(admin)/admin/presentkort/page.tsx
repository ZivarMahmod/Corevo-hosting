import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listGiftCards } from '@/lib/admin/presentkort/data'
import { PresentkortAdmin } from '@/components/admin/PresentkortAdmin'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Presentkort · Salongsadmin' }

export default async function PresentkortPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salongsadmin" title="Presentkort" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'presentkort')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Presentkort" />
        <Callout tone="info" icon="info">
          Presentkort är inte aktiverat för din salong. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const cards = await listGiftCards(tenant.id)

  const config = moduleAdminConfig(states, 'presentkort')
  const currency = typeof config.currency === 'string' ? config.currency : 'SEK'
  const fulfilment = typeof config.fulfilment === 'string' ? config.fulfilment : 'digital'

  return (
    <section className="portal-section">
      <PresentkortAdmin
        cards={cards}
        currency={currency}
        fulfilment={fulfilment}
        tenantName={tenant.name}
      />
    </section>
  )
}
