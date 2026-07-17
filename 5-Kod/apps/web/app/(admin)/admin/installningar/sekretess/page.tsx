import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow } from '@/lib/admin/data'
import { settingsCategories } from '@/lib/admin/settings-map'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead, Card, Callout, Icon } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sekretess och GDPR · Adminpanel' }

export default async function PrivacySettingsPage() {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="sekretess" title="Sekretess och GDPR" />
  }

  const settings = await getSettingsRow(tenant.id)
  const values = (settings?.settings ?? {}) as { cookie_banner_enabled?: boolean }

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="sekretess">
      <section className="portal-section" style={{ maxWidth: '640px' }}>
        <PageHead
          eyebrow="Inställningar"
          title="Sekretess och GDPR"
          lede="Hantera samtyckesytan och gå vidare till kundernas export och anonymisering."
        />
        <Callout tone="warning" icon="alert">
          Juridiska texter och biträdesavtal kräver separat juridisk granskning före kundlansering.
        </Callout>
        <SettingsForm
          scope="privacy"
          name={tenant.name}
          paymentMode={settings?.payment_mode ?? 'on_site'}
          cancellationHours={24}
          timezone={tenant.timeZone}
          locationName={tenant.name}
          address=""
          contactEmail=""
          contactPhone=""
          customerAccountsEnabled={false}
          cookieBannerEnabled={values.cookie_banner_enabled !== false}
        />
        <Card style={{ marginTop: '1rem' }}>
          <h2 className="h2">Kunddata</h2>
          <p className="body">Export och anonymisering görs på respektive kund för att minska risken att fel person ändras.</p>
          <Link href="/admin/kunder" className="btn-secondary">
            Öppna kundregistret <Icon name="chevronRight" size={14} />
          </Link>
        </Card>
      </section>
    </SettingsWorkspace>
  )
}
