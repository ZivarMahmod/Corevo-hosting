import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listServices, listStaff } from '@/lib/admin/data'
import { StaffManager } from '@/components/admin/StaffManager'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal · Salongsadmin' }

export default async function StaffPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Personal" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const [staff, services] = await Promise.all([listStaff(tenant.id), listServices(tenant.id)])

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Personal" />
      <p className="prose">
        Lägg till medarbetare och koppla vilka tjänster de utför. Endast aktiv personal med minst en
        kopplad tjänst går att boka på den publika webbplatsen.
      </p>
      <StaffManager staff={staff} services={services} />
    </section>
  )
}
