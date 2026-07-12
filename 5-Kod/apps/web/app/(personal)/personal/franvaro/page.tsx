import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyTimeOff } from '@/lib/personal/schedule'
import { fmtDateTime } from '@/lib/personal/format'
import { PageHead } from '@/components/portal/ui'
import { AbsencePanel } from './AbsencePanel'
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
            Kontakta din administratör för att kopplas till en personalrad — sedan kan du registrera
            din frånvaro här.
          </p>
        </div>
      </section>
    )
  }

  const timeZone = staff[0]?.timeZone ?? 'Europe/Stockholm'
  const rows = await getMyTimeOff(staff.map((s) => s.id))

  // "Kommande frånvaro" = real time_off whose period has not ended yet. The
  // active flag (period covers now) is genuine derived state — NOT an approval
  // status (no workflow exists in the model). Sorted soonest-first.
  const now = Date.now()
  const upcoming = rows
    .filter((r) => new Date(r.endTs).getTime() >= now)
    .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))
    .map((row) => {
      const start = new Date(row.startTs).getTime()
      const end = new Date(row.endTs).getTime()
      return {
        row,
        when: `${fmtDateTime(row.startTs, timeZone)} – ${fmtDateTime(row.endTs, timeZone)}`,
        kind: row.reason ?? 'Frånvaro',
        active: start <= now && now < end,
      }
    })

  return (
    <section className="portal-section">
      <div style={{ maxWidth: 560 }}>
        <PageHead eyebrow="Personal" title="Frånvaro" />
        <AbsencePanel upcoming={upcoming} timeZone={timeZone} />
      </div>
    </section>
  )
}
