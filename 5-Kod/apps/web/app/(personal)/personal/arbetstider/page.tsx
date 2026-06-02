import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyWorkingHours } from '@/lib/personal/schedule'
import { WorkingHoursManager } from '@/components/personal/WorkingHoursManager'
import { PageHead } from '@/components/portal/ui'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Arbetstider' }

export default async function ArbetstiderPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Personal" title="Arbetstider" />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Kontakta salongsadmin för att kopplas till en personalrad — sedan visas dina arbetstider
            här.
          </p>
        </div>
      </section>
    )
  }

  const rows = await getMyWorkingHours(staff.map((s) => s.id))

  return (
    <section className="portal-section">
      <PageHead eyebrow="Personal" title="Arbetstider" />
      <p className="prose">
        Dina veckovisa arbetstider sätts av salongen och styr vilka tider kunder kan boka (M3). De
        visas här så du har koll på ditt schema. Vid sjukdom eller ledighet registrerar du frånvaro
        under Frånvaro — vill du ändra själva grundschemat, hör av dig till salongsadmin.
      </p>
      <WorkingHoursManager rows={rows} />
    </section>
  )
}
