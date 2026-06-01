'use client'

import { useActionState } from 'react'
import { addWorkingHours, deleteWorkingHours, type ActionState } from '@/lib/personal/actions'
import { WEEKDAYS_SV } from '@/lib/personal/format'
import type { WorkingHoursRow } from '@/lib/personal/schedule'
import { DeleteRowButton } from './DeleteRowButton'
import styles from './personal.module.css'

export function WorkingHoursManager({ rows }: { rows: WorkingHoursRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addWorkingHours, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <label className={styles.field}>
          <span>Veckodag</span>
          <select name="weekday" defaultValue="1">
            {WEEKDAYS_SV.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Från</span>
          <input name="start_time" type="time" defaultValue="09:00" required />
        </label>
        <label className={styles.field}>
          <span>Till</span>
          <input name="end_time" type="time" defaultValue="17:00" required />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Lägg till'}
        </button>
      </form>
      {state.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {state.success}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Inga arbetstider tillagda</p>
          <p className={styles.emptyHint}>
            Lägg till din första veckodag ovan så blir du bokningsbar för kunder.
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.id} className={styles.row}>
              <div className={styles.rowHead}>
                <span>
                  {WEEKDAYS_SV[r.weekday]} {r.startTime.slice(0, 5)}–{r.endTime.slice(0, 5)}
                </span>
                <DeleteRowButton id={r.id} action={deleteWorkingHours} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
