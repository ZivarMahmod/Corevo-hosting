import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, brandingOf } from '@/lib/admin/data'
import { BrandingForm } from '@/components/admin/BrandingForm'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Varumärke · Salongsadmin' }

export default async function BrandingPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Varumärke</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const settings = await getSettingsRow(tenant.id)
  const branding = brandingOf(settings)

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Varumärke" />
      <p className="prose">
        Logotyp, färger och typsnitt för din publika webbplats. Förhandsvisningen till höger
        uppdateras direkt — och när du sparar slår ändringarna igenom på den publika sajten.
      </p>
      <BrandingForm branding={branding} />
    </section>
  )
}
