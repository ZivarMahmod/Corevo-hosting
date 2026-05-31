import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyTimeOff } from '@/lib/personal/schedule'
import { TimeOffManager } from '@/components/personal/TimeOffManager'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Frånvaro' }

export default async function FranvaroPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <h1>Frånvaro</h1>
        <p className="prose">Ingen personalprofil är kopplad till ditt konto.</p>
      </section>
    )
  }

  const rows = await getMyTimeOff(staff.map((s) => s.id))

  return (
    <section className="portal-section">
      <h1>Frånvaro</h1>
      <p className="prose">
        Registrerad frånvaro blockerar bokningsbara tider direkt i boka-flödet (M3).
      </p>
      <TimeOffManager rows={rows} timeZone={staff[0]?.timeZone ?? 'Europe/Stockholm'} />
    </section>
  )
}
