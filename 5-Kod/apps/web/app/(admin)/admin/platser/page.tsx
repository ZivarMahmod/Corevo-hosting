import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listLocations } from '@/lib/admin/data'
import { LocationsManager } from '@/components/admin/LocationsManager'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Platser · Adminpanel' }

export default async function LocationsPage() {
  const user = await requireOrganizationOwner('platser')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <SettingsWorkspaceEmpty currentCategory="platser" title="Platser" />

  const locations = await listLocations(tenant.id)

  // Headern (PageHead + "Ny plats"-CTA) bor inne i klient-managern — CTA:n öppnar
  // skapa-Drawern (kräver onClick) och kan inte korsa server→klient-gränsen härifrån.
  // Samma mönster som tjanster/page.tsx.
  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="platser">
      <section className="portal-section">
        <LocationsManager locations={locations} tenantName={tenant.name} />
      </section>
    </SettingsWorkspace>
  )
}
