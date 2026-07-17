import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow } from '@/lib/admin/data'
import { settingsCategories } from '@/lib/admin/settings-map'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Integrationer · Adminpanel' }

export default async function IntegrationSettingsPage() {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="integrationer" title="Integrationer" />
  }

  const settings = await getSettingsRow(tenant.id)
  const values = (settings?.settings ?? {}) as { google_review_url?: string | null }

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="integrationer">
      <section className="portal-section" style={{ maxWidth: '640px' }}>
        <PageHead
          eyebrow="Inställningar"
          title="Integrationer"
          lede="Koppla externa tjänster som redan stöds av Corevo."
        />
        <Callout tone="info" icon="info">
          Endast Google-recensioner är aktiverbara här just nu. Övriga integrationer visas först när de har en fungerande transport.
        </Callout>
        <SettingsForm
          scope="integrations"
          name={tenant.name}
          paymentMode={settings?.payment_mode ?? 'on_site'}
          cancellationHours={24}
          timezone={tenant.timeZone}
          locationName={tenant.name}
          address=""
          contactEmail=""
          contactPhone=""
          customerAccountsEnabled={false}
          googleReviewUrl={values.google_review_url ?? ''}
        />
      </section>
    </SettingsWorkspace>
  )
}
