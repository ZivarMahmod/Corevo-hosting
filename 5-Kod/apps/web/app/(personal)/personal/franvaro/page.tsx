import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyTimeOff } from '@/lib/personal/schedule'
import { TimeOffManager } from '@/components/personal/TimeOffManager'
import { PageHead } from '@/components/portal/ui'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Frånvaro' }

export default async function FranvaroPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Personal" title="Frånvaro" />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Kontakta salongsadmin för att kopplas till en personalrad — sedan kan du registrera din
            frånvaro här.
          </p>
        </div>
      </section>
    )
  }

  const rows = await getMyTimeOff(staff.map((s) => s.id))

  return (
    <section className="portal-section">
      <PageHead eyebrow="Personal" title="Frånvaro" />
      <p className="prose">
        Registrerad frånvaro blockerar bokningsbara tider direkt i boka-flödet (M3).
      </p>
      <TimeOffManager rows={rows} timeZone={staff[0]?.timeZone ?? 'Europe/Stockholm'} />
    </section>
  )
}
