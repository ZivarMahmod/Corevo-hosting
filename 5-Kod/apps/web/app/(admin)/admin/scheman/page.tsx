import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listStaff, listWorkingHours, listWorkingHourSlots } from '@/lib/admin/data'
import { StaffPicker } from '@/components/admin/StaffPicker'
import { ScheduleManager } from '@/components/admin/ScheduleManager'
import { SlotManager } from '@/components/admin/SlotManager'
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
  const [rows, slots] = await Promise.all([
    listWorkingHours(tenant.id, selected.id),
    listWorkingHourSlots(tenant.id, selected.id),
  ])

  return (
    <section className="portal-section">
      <PageHead eyebrow={`${tenant.name} · Scheman & öppettider`} title="Scheman" />
      <p className="prose">
        Du sätter medarbetarens baseline-schema här (tidszon {tenant.timeZone}). Medarbetaren ändrar
        den inte själv — personalvyn speglar bara den.
      </p>
      <StaffPicker staff={staff} selectedId={selected.id} basePath="/admin/scheman" />

      <div style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Arbetstider (öppet–stängt)</h2>
        <p className="prose" style={{ fontSize: 13, marginTop: 0 }}>
          Veckovisa intervall — styr salongens öppettider på den publika sajten och är grunden de
          bokbara tiderna genereras ur.
        </p>
        <ScheduleManager staffId={selected.id} rows={rows} />
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Bokbara starttider</h2>
        <p className="prose" style={{ fontSize: 13, marginTop: 0 }}>
          Exakta tider du vill göra bokbara — ojämna intervaller tillåtna. Tjänstens längd styr
          passet. Tiderna sparas nu och börjar styra bokningen när bokningsmotorn slår på explicita
          tider; tills dess erbjuder bokningen tider ur arbetstids-rastret.
        </p>
        <SlotManager staffId={selected.id} rows={slots} />
      </div>
    </section>
  )
}
