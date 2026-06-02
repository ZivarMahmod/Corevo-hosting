'use client'

import { useActionState } from 'react'
import { setBookingStatus, type ActionState } from '@/lib/personal/actions'
import { Button } from '@/components/portal/ui'

/**
 * Gold "Markera klar" for the "Nästa kund" hero on /personal. Reuses the EXACT
 * same server-action contract as the per-row "Genomförd" path in
 * BookingStatusActions: setBookingStatus is (prevState, formData), so it needs
 * useActionState (client-only) — a bare server-page <form action> would land the
 * formData in the prevState slot. Status rides hidden inputs (the Button primitive
 * doesn't forward name/value), identical to the existing completed path. This is
 * additive chrome around the same action; it changes nothing about how the action,
 * the per-row controls, or the data flow work.
 */
export function MarkDoneButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setBookingStatus, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <form action={action}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="status" value="completed" />
        <Button variant="gold" icon="check" type="submit" disabled={pending}>
          {pending ? 'Sparar…' : 'Markera klar'}
        </Button>
      </form>
      {state.error ? (
        <p
          className="small"
          role="alert"
          style={{ margin: 0, color: 'var(--c-on-forest)', opacity: 0.92 }}
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p
          className="small"
          role="status"
          style={{ margin: 0, color: 'var(--c-on-forest)', opacity: 0.92 }}
        >
          {state.success}
        </p>
      ) : null}
    </div>
  )
}
