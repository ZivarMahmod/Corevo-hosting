import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listServices } from '@/lib/admin/data'
import { ServicesManager } from '@/components/admin/ServicesManager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tjänster · Salongsadmin' }

export default async function ServicesPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  const services = await listServices(tenant.id)

  return (
    <section className="portal-section">
      <h1>Tjänster</h1>
      <p className="prose">
        Priser och varaktighet styr den publika bokningen direkt. Inaktiverade tjänster döljs på
        webbplatsen men behåller sin bokningshistorik.
      </p>
      <ServicesManager services={services} />
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <h1>Tjänster</h1>
      <p className="prose">Ingen salong är kopplad till ditt konto.</p>
    </section>
  )
}
