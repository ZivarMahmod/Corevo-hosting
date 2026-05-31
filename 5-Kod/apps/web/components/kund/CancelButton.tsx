'use client'

import { useActionState } from 'react'
import { cancelBooking, type BookingActionState } from '@/lib/kund/actions'
import styles from './kund.module.css'

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<BookingActionState, FormData>(cancelBooking, {})

  return (
    <form action={formAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <button
        type="submit"
        className={styles.danger}
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm('Vill du avboka den här tiden?')) e.preventDefault()
        }}
      >
        {pending ? 'Avbokar…' : 'Avboka'}
      </button>
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
