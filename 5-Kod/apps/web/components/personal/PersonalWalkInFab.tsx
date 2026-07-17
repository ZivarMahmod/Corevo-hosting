'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createWalkIn, type ActionState } from '@/lib/personal/actions'
import type { StaffService } from '@/lib/personal/staff'
import styles from './personal-pwa.module.css'

export function PersonalWalkInFab({
  services,
  timeZone,
}: {
  services: StaffService[]
  timeZone: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(createWalkIn, {})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      firstFieldRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const close = () => dialogRef.current?.close()
  if (services.length === 0) return null
  return (
    <div data-accept="personal-create">
      <button
        ref={triggerRef}
        type="button"
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label="Skapa walk-in"
      >
        +
      </button>
      <dialog
        ref={dialogRef}
        className={styles.sheetLayer}
        aria-labelledby="walk-in-title"
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClose={() => {
          setOpen(false)
          triggerRef.current?.focus()
        }}
      >
        {open ? (
          <>
            <button
              type="button"
              className={styles.sheetBackdrop}
              onClick={close}
              aria-label="Stäng walk-in"
            />
            <form action={action} className={`${styles.sheet} ${styles.walkInSheet}`}>
              <div className={styles.sheetHandle} />
              <div className={styles.sheetMeta}>
                <span>
                  <i />
                  ny bokning · egen kalender
                </span>
                <button type="button" onClick={close} aria-label="Stäng walk-in">
                  ✕
                </button>
              </div>
              <h2 id="walk-in-title">Walk-in</h2>
              <label>
                <span>Tjänst</span>
                <select ref={firstFieldRef} name="serviceId" required defaultValue="">
                  <option value="" disabled>
                    Välj tjänst
                  </option>
                  {services.map((service) => (
                    <option value={service.id} key={service.id}>
                      {service.name} · {service.durationMin} min
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Starttid ({timeZone})</span>
                <input name="start" type="datetime-local" required />
              </label>
              <label>
                <span>Kundnamn (valfritt)</span>
                <input name="name" type="text" />
              </label>
              <button type="submit" className={styles.createButton} disabled={pending}>
                {pending ? 'Lägger in…' : 'Lägg in walk-in'}
              </button>
              {state.error ? <p role="alert">{state.error}</p> : null}
              {state.success ? <p role="status">{state.success}</p> : null}
            </form>
          </>
        ) : null}
      </dialog>
    </div>
  )
}
