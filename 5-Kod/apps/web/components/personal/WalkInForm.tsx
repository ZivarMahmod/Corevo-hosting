'use client'

import { useState, useActionState } from 'react'
import { createWalkIn, type ActionState } from '@/lib/personal/actions'
import type { StaffService } from '@/lib/personal/staff'
import styles from './personal.module.css'

/**
 * Drop-in / walk-in (M5 §2.1). The frisör logs a customer who walked in — a booking
 * on their OWN staff_id. The no_double_booking EXCLUDE guards the slot server-side
 * (a clash returns a clear inline error). Name is optional and rides the note.
 */
export function WalkInForm({
  services,
  timeZone,
}: {
  services: StaffService[]
  timeZone: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createWalkIn, {})
  const [open, setOpen] = useState(false)

  if (services.length === 0) {
    return (
      <p className={styles.muted}>
        Inga tjänster är kopplade till dig än — be salongsadmin koppla dina tjänster så kan du logga
        walk-ins.
      </p>
    )
  }

  return (
    <div className={styles.walkin}>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Stäng' : '+ Walk-in'}
      </button>

      {open ? (
        <form action={formAction} className={styles.form}>
          <label className={styles.field}>
            <span>Tjänst</span>
            <select name="serviceId" required defaultValue="">
              <option value="" disabled>
                Välj tjänst
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMin} min)
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Starttid ({timeZone})</span>
            <input name="start" type="datetime-local" required />
          </label>
          <label className={styles.field}>
            <span>Kundnamn (valfritt)</span>
            <input name="name" type="text" placeholder="t.ex. Drop-in" />
          </label>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Lägger in…' : 'Lägg in walk-in'}
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
      ) : null}
    </div>
  )
}
