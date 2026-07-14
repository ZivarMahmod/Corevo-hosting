import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, moduleAdminState } from '@/lib/admin/modules'
import { bookingModeFromState } from '@/lib/admin/booking-mode'
import { BookingModeCard } from '@/components/admin/BookingModeCard'
import { PageHead, Button } from '@/components/portal/ui'

/** L3 C-03 — bokningsregler som lägen. Läget ÄR tenant_modules.state för `booking`
 *  (samma mekanism som storefronten läser), aldrig en ny flagga. */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsregler · Adminpanel' }

export default async function BokningsreglerPage() {
  const user = await requireAdminArea('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Inställningar" title="Bokningsregler" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)
  const current = bookingModeFromState(
    'booking' in states ? moduleAdminState(states, 'booking') : undefined,
  )

  return (
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <PageHead
        eyebrow="Inställningar"
        title="Bokningsregler"
        lede="Ett val: tar du emot bokningar just nu?"
      />
      <p style={{ margin: '0 0 1rem' }}>
        <Button href="/admin/installningar" variant="ghost" icon="arrowLeft" size="sm">
          Alla inställningar
        </Button>
      </p>

      <BookingModeCard current={current} />

      <p className="body" style={{ marginTop: '1.25rem', color: 'var(--c-ink-2)' }}>
        Avbokningsregeln (hur nära inpå kunden får avboka) ligger under{' '}
        <a href="/admin/installningar/foretag">Företag och profil</a>.
      </p>
    </section>
  )
}
