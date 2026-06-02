import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listStaff, listWorkingHours } from '@/lib/admin/data'
import { StaffPicker } from '@/components/admin/StaffPicker'
import { ScheduleManager } from '@/components/admin/ScheduleManager'
import { PageHead } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Scheman · Salongsadmin' }

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Scheman" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const staff = await listStaff(tenant.id)
  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Scheman" />
        <p className="prose">Lägg till personal först under Personal.</p>
      </section>
    )
  }

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const rows = await listWorkingHours(tenant.id, selected.id)

  return (
    <section className="portal-section">
      <PageHead eyebrow={`${tenant.name} · Scheman & öppettider`} title="Scheman" />
      <p className="prose">
        Veckovisa arbetstider per medarbetare (tidszon {tenant.timeZone}). Bokningsmotorn erbjuder
        bara tider inom dessa intervall.
      </p>
      <StaffPicker staff={staff} selectedId={selected.id} basePath="/admin/scheman" />
      <div style={{ marginTop: '1rem' }}>
        <ScheduleManager staffId={selected.id} rows={rows} />
      </div>
    </section>
  )
}
