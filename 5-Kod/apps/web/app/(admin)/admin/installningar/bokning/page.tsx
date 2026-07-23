import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, moduleAdminState } from '@/lib/admin/modules'
import { getSettingsRow } from '@/lib/admin/data'
import { bookingModeFromState } from '@/lib/admin/booking-mode'
import { BookingModeCard } from '@/components/admin/BookingModeCard'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead } from '@/components/portal/ui'
import { settingsCategories } from '@/lib/admin/settings-map'

/** L3 C-03 — bokningsregler som lägen. Läget ÄR tenant_modules.state för `booking`
 *  (samma mekanism som storefronten läser), aldrig en ny flagga. */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsregler · Adminpanel' }

export default async function BokningsreglerPage() {
  const user = await requireAdminArea('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="bokningsregler" title="Bokningsregler" />
  }

  const [states, settings] = await Promise.all([
    getAdminModuleStates(tenant.id),
    getSettingsRow(tenant.id),
  ])
  const current = bookingModeFromState(
    'booking' in states ? moduleAdminState(states, 'booking') : undefined,
  )
  const values = (settings?.settings ?? {}) as {
    cancellation_cutoff_hours?: number
    customer_accounts_enabled?: boolean
    booking?: { external_url?: string }
  }

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="bokningsregler">
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <PageHead
        eyebrow="Inställningar"
        title="Bokningsregler"
        lede="Ett val: tar du emot bokningar just nu?"
      />
      <BookingModeCard current={current} />
      <SettingsForm
        scope="booking"
        name={tenant.name}
        paymentMode={settings?.payment_mode ?? 'on_site'}
        cancellationHours={
          typeof values.cancellation_cutoff_hours === 'number'
            ? values.cancellation_cutoff_hours
            : 24
        }
        timezone={tenant.timeZone}
        locationName={tenant.name}
        address=""
        contactEmail=""
        contactPhone=""
        customerAccountsEnabled={values.customer_accounts_enabled === true}
        bookingExternalUrl={
          typeof values.booking?.external_url === 'string' ? values.booking.external_url : ''
        }
      />
    </section>
    </SettingsWorkspace>
  )
}
