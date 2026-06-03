import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listLocations } from '@/lib/admin/data'
import { LocationsManager } from '@/components/admin/LocationsManager'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Platser · Salongsadmin' }

export default async function LocationsPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <NoTenant />

  const locations = await listLocations(tenant.id)

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Platser" />
      <p className="prose">
        Salongens platser (filialer). Den <strong>primära</strong> platsen är den bokningar och den
        publika sajten utgår från — varje salong har exakt en. Lägg till fler platser, byt vilken som
        är primär, och inaktivera dem du inte längre använder. En plats tas aldrig bort helt (den har
        bokningshistorik och scheman) — inaktivera den i stället. Personalens scheman kopplas till en
        plats under Scheman.
      </p>
      <LocationsManager locations={locations} />
    </section>
  )
}

function NoTenant() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Salong-admin" title="Platser" />
      <p className="prose">Ingen salong är kopplad till ditt konto.</p>
    </section>
  )
}
