import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyWorkingHours } from '@/lib/personal/schedule'
import { WorkingHoursManager } from '@/components/personal/WorkingHoursManager'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Arbetstider' }

export default async function ArbetstiderPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <h1>Arbetstider</h1>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Kontakta salongsadmin för att kopplas till en personalrad — sedan kan du lägga till dina
            arbetstider här.
          </p>
        </div>
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
