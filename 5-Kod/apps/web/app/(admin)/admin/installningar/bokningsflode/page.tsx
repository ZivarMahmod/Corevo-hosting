import type { Metadata } from 'next'
import Link from 'next/link'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { Card, PageHead } from '@/components/portal/ui'
import { getAdminTenant } from '@/lib/admin/tenant'
import { settingsCategories } from '@/lib/admin/settings-map'
import { requireAdminArea } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsflöde · Inställningar' }

export default async function BookingFlowSettingsPage() {
  const user = await requireAdminArea('sida')
  const tenant = await getAdminTenant(user)
  const categories = settingsCategories(tenant?.terminology)

  return (
    <SettingsWorkspace categories={categories} currentCategory="bokningsflode">
      <section className="portal-section">
        <PageHead
          eyebrow={tenant?.name ?? 'Inställningar'}
          title="Bokningsflöde"
          lede="Hur bokningen ser ut för kunden — presentation, datumväljare och personalbilder."
        />
        <Card>
          <h2 className="h2" style={{ marginTop: 0 }}>Redigera med live-förhandsvisning</h2>
          <p className="body">
            Bokningsflödet delar förhandsvisning och publicering med Redigera sidan, så ändringen
            görs på dess enda ägande yta.
          </p>
          <Link className="btn-primary" href="/admin/sida?flik=bokning">
            Öppna bokningsflödet
          </Link>
        </Card>
      </section>
    </SettingsWorkspace>
  )
}
