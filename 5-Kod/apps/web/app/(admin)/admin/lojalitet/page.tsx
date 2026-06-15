import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listLoyaltyMembers, recentLoyaltyActivity } from '@/lib/admin/lojalitet/data'
import { parseLoyaltyConfig } from '@/lib/admin/lojalitet/types'
import { LojalitetAdmin } from '@/components/admin/LojalitetAdmin'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lojalitet · Salongsadmin' }

export default async function LojalitetPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Lojalitet" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'lojalitet')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Lojalitet" />
        <Callout tone="info" icon="info">
          Lojalitet är inte aktiverad för din salong. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const [members, activity] = await Promise.all([
    listLoyaltyMembers(tenant.id),
    recentLoyaltyActivity(tenant.id),
  ])
  const config = parseLoyaltyConfig(moduleAdminConfig(states, 'lojalitet'))

  return (
    <section className="portal-section">
      <LojalitetAdmin
        config={config}
        members={members}
        activity={activity}
        tenantName={tenant.name}
      />
    </section>
  )
}
