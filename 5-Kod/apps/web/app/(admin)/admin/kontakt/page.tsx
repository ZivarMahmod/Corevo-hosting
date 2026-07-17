import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listContactMessages } from '@/lib/admin/kontakt/data'
import { ContactInboxCard } from '@/components/platform/ContactInboxCard'
import { PageHead } from '@/components/portal/ui'

// ÄGARENS KONTAKTINKORG (plan 007). Kontaktformuläret finns på varje storefront-mall
// och skriver rader i contact_messages — men inkorgen fanns bara i plattformsytan, så
// kunder skrev och ägaren såg aldrig. Samma läsväg (lib/admin/kontakt/data, RLS +
// explicit tenant-fence) och samma kort (ContactInboxCard — tenant-agnostiskt: en
// salongsadmin får sitt tenant ur JWT, servern ignorerar klientens fält).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Meddelanden · Adminpanel' }

export default async function KontaktPage() {
  const user = await requireAdminArea('kontakt')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Meddelanden" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const messages = await listContactMessages(tenant.id)

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Meddelanden" />
      <ContactInboxCard tenantId={tenant.id} messages={messages} />
    </section>
  )
}
