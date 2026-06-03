'use client'

import { useActionState } from 'react'
import type { SlotRow, LocationRow } from '@/lib/admin/data'
import { addStaffSlots, deleteStaffSlot, seedStaffSlots, type ActionState } from '@/lib/admin/actions'
import { WEEKDAYS_SV } from '@/lib/admin/format'
import { LocationSelect } from './LocationSelect'
import styles from './admin.module.css'

/**
 * Explicit bookable-slot editor (M6 §5). The owner defines the exact start times
 * per weekday per staff — uneven cadences allowed (09:00, 09:30, 11:45 …). The
 * service length drives each pass; the list is the cadence. Complements (does NOT
 * replace) the working_hours envelope above it.
 */
export function SlotManager({
  staffId,
  rows,
  locations,
  defaultLocationId,
}: {
  staffId: string
  rows: SlotRow[]
  locations: LocationRow[]
  defaultLocationId: string
}) {
  const [addState, addAction, addPending] = useActionState<ActionState, FormData>(addStaffSlots, {})
  const [seedState, seedAction, seedPending] = useActionState<ActionState, FormData>(
    seedStaffSlots,
    {},
  )

  // Group active slots by weekday for a per-day chip row (Mon→Sun order).
  const byDay = new Map<number, SlotRow[]>()
  for (const r of rows) {
    const arr = byDay.get(r.weekday) ?? []
    arr.push(r)
    byDay.set(r.weekday, arr)
  }
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div>
      {/* Boot-import from working_hours */}
      <form action={seedAction} className={styles.form} style={{ alignItems: 'flex-end' }}>
        <input type="hidden" name="staff_id" value={staffId} />
        <label className={styles.field} style={{ flex: '0 0 8rem' }}>
          <span>Steg (min)</span>
          <input name="step" type="number" min={1} max={240} defaultValue={15} />
        </label>
        <button type="submit" className={styles.btn} disabled={seedPending}>
          {seedPending ? 'Genererar…' : 'Generera från arbetstider'}
        </button>
        {seedState.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {seedState.error}
          </span>
        ) : null}
        {seedState.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {seedState.success}
          </span>
        ) : null}
      </form>
      <p className={styles.muted} style={{ marginTop: '-0.4rem' }}>
        Skapar starttider ur arbetstiderna ovan (med valt steg). Justera sedan fritt — ojämna tider
        är tillåtna. Tiderna sparas nu och börjar styra bokbara tider när bokningsmotorn slår på
        explicita tider.
      </p>

      {/* Add explicit times */}
      <form action={addAction} className={styles.form} style={{ marginTop: '1rem', alignItems: 'flex-end' }}>
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
        <label className={styles.field} style={{ flex: '1 1 16rem' }}>
          <span>Starttider</span>
          <input name="start_times" placeholder="t.ex. 09:00, 09:30, 11:45, 14:15" />
        </label>
        <button type="submit" className="btn-primary" disabled={addPending}>
          {addPending ? 'Sparar…' : 'Lägg till tider'}
        </button>
        {addState.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {addState.error}
          </span>
        ) : null}
        {addState.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            {addState.success}
          </span>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <div className={styles.empty} style={{ marginTop: '1rem' }}>
          <strong>Inga explicita bokbara tider för denna medarbetare.</strong>
          Generera ur arbetstiderna ovan, eller lägg till egna tider. Utan explicita tider erbjuder
          bokningen tider ur arbetstids-rastret.
        </div>
      ) : (
        <ul className={styles.list} style={{ marginTop: '1rem' }}>
          {order
            .filter((wd) => byDay.has(wd))
            .map((wd) => (
              <li key={wd} className={styles.row} style={{ alignItems: 'flex-start' }}>
                <span className={styles.rowTitle} style={{ minWidth: '6rem' }}>
                  {WEEKDAYS_SV[wd]}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                  {(byDay.get(wd) ?? []).map((s) => (
                    <SlotChip key={s.id} id={s.id} time={s.start_time.slice(0, 5)} />
                  ))}
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function SlotChip({ id, time }: { id: string; time: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteStaffSlot, {})
  return (
    <form action={formAction} style={{ display: 'inline-flex' }}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Ta bort denna tid"
        aria-label={`Ta bort ${time}`}
        className="num"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 999,
          border: '1px solid var(--c-line)',
          background: 'var(--c-paper-2)',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          color: 'var(--c-ink)',
          opacity: pending ? 0.5 : 1,
        }}
      >
        {time}
        <span aria-hidden="true" style={{ color: 'var(--c-ink-3)', fontSize: 14, lineHeight: 1 }}>
          ×
        </span>
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
