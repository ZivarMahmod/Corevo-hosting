'use client'

import { useActionState } from 'react'
import { setBookingStatus, type ActionState } from '@/lib/admin/actions'
import { BOOKING_STATUSES, statusLabel } from '@/lib/admin/format'
import styles from './admin.module.css'

export function BookingStatusControl({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})

  return (
    <form action={formAction} className={styles.actions}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <select name="status" defaultValue={status} aria-label="Ändra status">
        {BOOKING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>
      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? '…' : 'Spara'}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
