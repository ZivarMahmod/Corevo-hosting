'use client'

import { useActionState } from 'react'
import { addTimeOff, deleteTimeOff, type ActionState } from '@/lib/personal/actions'
import { fmtDateTime } from '@/lib/personal/format'
import type { TimeOffRow } from '@/lib/personal/schedule'
import { DeleteRowButton } from './DeleteRowButton'
import styles from './personal.module.css'

export function TimeOffManager({ rows, timeZone }: { rows: TimeOffRow[]; timeZone: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addTimeOff, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <label className={styles.field}>
          <span>Från</span>
          <input name="start" type="datetime-local" required />
        </label>
        <label className={styles.field}>
          <span>Till</span>
          <input name="end" type="datetime-local" required />
        </label>
        <label className={styles.field}>
          <span>Orsak (valfritt)</span>
          <input name="reason" type="text" />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Lägg till'}
        </button>
      </form>
      <p className={styles.muted}>Tider anges i salongens tidszon ({timeZone}).</p>
      {state.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.feedback} role="status">
          {state.success}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className={styles.muted}>Ingen frånvaro registrerad.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.id} className={styles.row}>
              <div className={styles.rowHead}>
                <span>
                  {fmtDateTime(r.startTs, timeZone)} – {fmtDateTime(r.endTs, timeZone)}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
                <DeleteRowButton id={r.id} action={deleteTimeOff} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
