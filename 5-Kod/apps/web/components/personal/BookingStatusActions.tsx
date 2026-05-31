'use client'

import { useActionState } from 'react'
import { setBookingStatus, type ActionState } from '@/lib/personal/actions'
import styles from './personal.module.css'

/** completed / no_show buttons, shown only for still-active bookings. */
export function BookingStatusActions({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})

  return (
    <div>
      <form action={formAction} className={styles.actions}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <button type="submit" name="status" value="completed" className={styles.btn} disabled={pending}>
          Genomförd
        </button>
        <button
          type="submit"
          name="status"
          value="no_show"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={pending}
        >
          Uteblev
        </button>
      </form>
      {state.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
