'use client'

import { useState, useActionState } from 'react'
import {
  setBookingStatus,
  rebookOwnBooking,
  cancelOwnBooking,
  type ActionState,
} from '@/lib/personal/actions'
import styles from './personal.module.css'

/**
 * Operative actions for a still-active booking (M5): mark completed / no-show,
 * rebook (new time, same staff+service — in-place), or cancel (frees the slot).
 * The frisör never edits the working-hours baseline here — only their own bookings.
 */
export function BookingStatusActions({
  bookingId,
  timeZone,
}: {
  bookingId: string
  timeZone: string
}) {
  const [status, statusAction, statusPending] = useActionState<ActionState, FormData>(
    setBookingStatus,
    {},
  )
  const [cancel, cancelAction, cancelPending] = useActionState<ActionState, FormData>(
    cancelOwnBooking,
    {},
  )
  const [showRebook, setShowRebook] = useState(false)

  return (
    <div>
      <div className={styles.actions}>
        <form action={statusAction} style={{ display: 'contents' }}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            name="status"
            value="completed"
            className={`${styles.btn} ${styles.btnDone}`}
            disabled={statusPending}
          >
            {statusPending ? 'Sparar…' : 'Genomförd'}
          </button>
          <button
            type="submit"
            name="status"
            value="no_show"
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={statusPending}
          >
            Uteblev
          </button>
        </form>

        <button
          type="button"
          className={styles.btn}
          onClick={() => setShowRebook((v) => !v)}
          aria-expanded={showRebook}
        >
          Omboka
        </button>

        <form action={cancelAction} style={{ display: 'contents' }}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button type="submit" className={`${styles.btn} ${styles.btnDanger}`} disabled={cancelPending}>
            {cancelPending ? 'Avbokar…' : 'Avboka'}
          </button>
        </form>
      </div>

      {showRebook ? <RebookForm bookingId={bookingId} timeZone={timeZone} /> : null}

      {status.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {status.error}
        </p>
      ) : null}
      {status.success ? (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {status.success}
        </p>
      ) : null}
      {cancel.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {cancel.error}
        </p>
      ) : null}
      {cancel.success ? (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {cancel.success}
        </p>
      ) : null}
    </div>
  )
}

function RebookForm({ bookingId, timeZone }: { bookingId: string; timeZone: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(rebookOwnBooking, {})
  return (
    <form action={formAction} className={styles.inlineForm}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={styles.field}>
        <span>Ny tid ({timeZone})</span>
        <input name="start" type="datetime-local" required />
      </label>
      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? 'Ombokar…' : 'Spara ny tid'}
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
  )
}
