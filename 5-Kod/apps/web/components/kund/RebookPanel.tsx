'use client'

import { useActionState, useMemo, useState, useTransition } from 'react'
import { getAvailableSlots, type SlotOption } from '@/app/boka/actions'
import { rebookBooking, type BookingActionState } from '@/lib/kund/actions'
import styles from './kund.module.css'

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Rebooking picker for one booking: choose a new day + time for the SAME
 * service. Slots come from the shared getAvailableSlots (G04) — which already
 * excludes the customer's own current booking — and the submit runs the
 * rebookBooking action (create-new-then-cancel-old via the reused RPC).
 */
export function RebookPanel({
  bookingId,
  serviceId,
}: {
  bookingId: string
  serviceId: string
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [timeZone, setTimeZone] = useState('Europe/Stockholm')
  const [slot, setSlot] = useState<SlotOption | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [state, formAction, submitting] = useActionState<BookingActionState, FormData>(
    rebookBooking,
    {},
  )

  const days = useMemo(() => {
    const out: Date[] = []
    const base = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      out.push(d)
    }
    return out
  }, [])

  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone }).format(
      new Date(iso),
    )

  function pickDate(d: string) {
    setDate(d)
    setSlot(null)
    setLoadError(null)
    startTransition(async () => {
      const res = await getAvailableSlots(serviceId, null, d)
      if (res.ok) {
        setSlots(res.slots)
        setTimeZone(res.timeZone)
      } else {
        setSlots([])
        setLoadError(res.error)
      }
    })
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Omboka
      </button>
    )
  }

  return (
    <div className={styles.rebookOpen}>
      <p className={styles.pickerLabel}>Välj ny dag</p>
      <div className={styles.days}>
        {days.map((d) => {
          const key = ymd(d)
          return (
            <button
              key={key}
              type="button"
              className={`${styles.day}${date === key ? ` ${styles.daySelected}` : ''}`}
              onClick={() => pickDate(key)}
            >
              {fmtDay(d)}
            </button>
          )
        })}
      </div>

      {pending ? <p className={styles.muted}>Hämtar lediga tider…</p> : null}
      {!pending && loadError ? (
        <p className="auth-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {!pending && date && !loadError && slots.length === 0 ? (
        <p className={styles.muted}>Inga lediga tider den dagen. Välj en annan dag.</p>
      ) : null}

      {!pending && slots.length > 0 ? <p className={styles.pickerLabel}>Välj ny tid</p> : null}

      <div className={styles.times}>
        {slots.map((sl) => (
          <button
            key={sl.start + sl.staffId}
            type="button"
            className={`${styles.time}${
              slot?.start === sl.start && slot?.staffId === sl.staffId ? ` ${styles.timeSelected}` : ''
            }`}
            onClick={() => setSlot(sl)}
          >
            {fmtTime(sl.start)}
            {sl.staffTitle ? <span className={styles.timeStaff}>{sl.staffTitle}</span> : null}
          </button>
        ))}
      </div>

      <form action={formAction} className={styles.actions}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="startISO" value={slot?.start ?? ''} />
        <input type="hidden" name="staffId" value={slot?.staffId ?? ''} />
        <button type="submit" className="btn-primary" disabled={!slot || submitting}>
          {submitting ? 'Bokar om…' : 'Bekräfta ny tid'}
        </button>
        <button type="button" className={styles.btnSecondary} onClick={() => setOpen(false)}>
          Avbryt
        </button>
      </form>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
