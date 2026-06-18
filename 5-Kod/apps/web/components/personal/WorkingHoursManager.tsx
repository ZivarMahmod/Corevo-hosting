import { WEEKDAYS_SV } from '@/lib/personal/format'
import type { WorkingHoursRow } from '@/lib/personal/schedule'
import styles from './personal.module.css'

/**
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Ersatt av
 * ScheduleGrid (app/(personal)/personal/arbetstider/ScheduleGrid.tsx) — samma
 * working_hours-baseline som streckade fönsterceller. Behålls (build-once),
 * ej raderad.
 *
 * Read-only view of the staff member's bookable baseline (M5 §2.1). The baseline is
 * OWNER authority (M6) — the frisör no longer self-edits it. Operative changes
 * (sick day / vacation) live on /personal/franvaro; per-booking changes (rebook /
 * cancel / walk-in) live in the calendar.
 */
export function WorkingHoursManager({ rows }: { rows: WorkingHoursRow[] }) {
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Inga arbetstider satta än</p>
        <p className={styles.emptyHint}>
          Din salongsadmin sätter dina bokningsbara tider. Hör av dig till salongen om något ska
          ändras — vid sjukdom eller ledighet registrerar du frånvaro under Frånvaro.
        </p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {rows.map((r) => (
        <li key={r.id} className={styles.row}>
          <div className={styles.rowHead}>
            <span>
              {WEEKDAYS_SV[r.weekday]} {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}
            </span>
            <span className={styles.readonlyHint}>Satt av salongen</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
