import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listServices } from '@/lib/admin/data'
import { ServicesManager } from '@/components/admin/ServicesManager'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tjänster · Salongsadmin' }

export default async function ServicesPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  const services = await listServices(tenant.id)

  // The header (PageHead + "Ny tjänst" CTA) lives inside the client manager: the
  // CTA opens the create drawer (needs an onClick), which can't cross the
  // server→client boundary from here. The server page just fetches + passes.
  return (
    <section className="portal-section">
      <ServicesManager services={services} tenantName={tenant.name} />
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Salong-admin" title="Tjänster" />
      <p className="prose">Ingen salong är kopplad till ditt konto.</p>
    </section>
  )
}
