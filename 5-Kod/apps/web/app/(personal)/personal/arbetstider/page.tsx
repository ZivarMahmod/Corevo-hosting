import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyWorkingHours } from '@/lib/personal/schedule'
import { WorkingHoursManager } from '@/components/personal/WorkingHoursManager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Arbetstider' }

export default async function ArbetstiderPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <h1>Arbetstider</h1>
        <p className="prose">Ingen personalprofil är kopplad till ditt konto.</p>
      </section>
    )
  }

  const rows = await getMyWorkingHours(staff.map((s) => s.id))

  return (
    <section className="portal-section">
      <h1>Arbetstider</h1>
      <p className="prose">
        Dina veckovisa arbetstider styr vilka tider kunder kan boka (M3). Ändringar slår igenom
        direkt.
      </p>
      <WorkingHoursManager rows={rows} />
    </section>
  )
}
