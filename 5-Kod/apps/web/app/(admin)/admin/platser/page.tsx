import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listLocations } from '@/lib/admin/data'
import { LocationsManager } from '@/components/admin/LocationsManager'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Platser · Adminpanel' }

export default async function LocationsPage() {
  const user = await requireAdminArea('platser')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  const locations = await listLocations(tenant.id)

  // Headern (PageHead + "Ny plats"-CTA) bor inne i klient-managern — CTA:n öppnar
  // skapa-Drawern (kräver onClick) och kan inte korsa server→klient-gränsen härifrån.
  // Samma mönster som tjanster/page.tsx.
  return (
    <section className="portal-section">
      <LocationsManager locations={locations} tenantName={tenant.name} />
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Adminpanel" title="Platser" />
      <p className="prose">Inget företag är kopplat till ditt konto.</p>
    </section>
  )
}
