import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow } from '@/lib/admin/data'
import { settingsCategories } from '@/lib/admin/settings-map'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Påminnelser och utskick · Adminpanel' }

export default async function NotificationSettingsPage() {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="paminnelser" title="Påminnelser och utskick" />
  }

  const settings = await getSettingsRow(tenant.id)
  const values = (settings?.settings ?? {}) as {
    notifications?: { confirmation?: boolean; reminder?: boolean; review?: boolean }
  }

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="paminnelser">
      <section className="portal-section" style={{ maxWidth: '640px' }}>
        <PageHead
          eyebrow="Inställningar"
          title="Påminnelser och utskick"
          lede="Välj vilka e-postmeddelanden som skickas automatiskt. SMS är inte aktiverat."
        />
        <SettingsForm
          scope="notifications"
          name={tenant.name}
          paymentMode={settings?.payment_mode ?? 'on_site'}
          cancellationHours={24}
          timezone={tenant.timeZone}
          locationName={tenant.name}
          address=""
          contactEmail=""
          contactPhone=""
          customerAccountsEnabled={false}
          notifications={{
            confirmation: values.notifications?.confirmation !== false,
            reminder: values.notifications?.reminder !== false,
            review: values.notifications?.review !== false,
          }}
        />
      </section>
    </SettingsWorkspace>
  )
}
