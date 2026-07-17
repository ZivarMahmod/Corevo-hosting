import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listServices } from '@/lib/admin/data'
import { ServicesManager } from '@/components/admin/ServicesManager'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tjänster · Adminpanel' }

export default async function ServicesPage() {
  const user = await requireAdminArea('tjanster')
  const tenant = await getAdminTenant(user)
  if (!tenant) return <SettingsWorkspaceEmpty currentCategory="tjanster" title="Tjänster" />

  const services = await listServices(tenant.id)

  // The header (PageHead + "Ny tjänst" CTA) lives inside the client manager: the
  // CTA opens the create drawer (needs an onClick), which can't cross the
  // server→client boundary from here. The server page just fetches + passes.
  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="tjanster">
      <section className="portal-section">
        <ServicesManager services={services} tenantName={tenant.name} />
      </section>
    </SettingsWorkspace>
  )
}
