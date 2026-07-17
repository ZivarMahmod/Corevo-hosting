'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { cancelBooking, type BookingActionState } from '@/lib/kund/actions'
import styles from './kund.module.css'

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<BookingActionState, FormData>(cancelBooking, {})
  // Tvåstegs-arm (plan 007): klick 1 armar, klick 2 utför — samma bekräftelse-gest
  // som resten av huset (PresentkortAdmin/MediaLibrary). Sista window.confirm borta.
  const [armed, setArmed] = useState(false)

  return (
    <form action={formAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      {armed ? (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <button type="submit" className={styles.danger} disabled={pending}>
            {pending ? 'Avbokar…' : 'Säker? Avboka'}
          </button>
          <button type="button" className={styles.danger} onClick={() => setArmed(false)}>
            Ångra
          </button>
        </span>
      ) : (
        <button type="button" className={styles.danger} onClick={() => setArmed(true)}>
          Avboka
        </button>
      )}
      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
