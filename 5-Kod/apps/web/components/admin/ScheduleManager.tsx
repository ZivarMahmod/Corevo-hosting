'use client'

import { useActionState } from 'react'
import type { WorkingHourRow, LocationRow } from '@/lib/admin/data'
import { addStaffWorkingHours, deleteStaffWorkingHours, type ActionState } from '@/lib/admin/actions'
import { WEEKDAYS_SV } from '@/lib/admin/format'
import { LocationSelect } from './LocationSelect'
import styles from './admin.module.css'

/**
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Ersatt av
 * SlotManager.tsx (WorkingHoursEditor på /admin/scheman — identiska
 * addStaffWorkingHours/deleteStaffWorkingHours, samma working_hours-tabell).
 * Behålls (build-once-never-delete), ej raderad.
 */
export function ScheduleManager({
  staffId,
  rows,
  locations,
  defaultLocationId,
}: {
  staffId: string
  rows: WorkingHourRow[]
  locations: LocationRow[]
  defaultLocationId: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addStaffWorkingHours, {})

  return (
    <div>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="staff_id" value={staffId} />
        <LocationSelect locations={locations} defaultLocationId={defaultLocationId} />
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
      </form>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <strong>Inga arbetstider för denna medarbetare.</strong>
          Lägg till veckovisa tider ovan — bokningsmotorn erbjuder bara tider inom dessa intervall.
        </div>
      ) : (
        <ul className={styles.list}>
          {rows.map((r) => (
            <li key={r.id} className={styles.row}>
              <span className={styles.rowTitle}>
                {WEEKDAYS_SV[r.weekday]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
              </span>
              <DeleteRow id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DeleteRow({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteStaffWorkingHours,
    {},
  )
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`${styles.btn} ${styles.btnDanger}`} disabled={pending}>
        {pending ? '…' : 'Ta bort'}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
