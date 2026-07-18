'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { setTenantStatus, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

const ARM_TIMEOUT_MS = 10_000

export function StatusControl({ tenantId, status }: { tenantId: string; status: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setTenantStatus, {})
  const [armed, setArmed] = useState(false)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerFocusRef = useRef(false)
  const suspend = status === 'active'
  const nextStatus = suspend ? 'suspended' : 'active'

  useEffect(() => {
    if (state.success || state.error) {
      restoreTriggerFocusRef.current = false
      setArmed(false)
    }
  }, [state])

  useEffect(() => {
    restoreTriggerFocusRef.current = false
    setArmed(false)
  }, [tenantId, status])

  useEffect(() => {
    if (armed) {
      confirmButtonRef.current?.focus()
    } else if (restoreTriggerFocusRef.current) {
      restoreTriggerFocusRef.current = false
      triggerButtonRef.current?.focus()
    }
  }, [armed])

  useEffect(() => {
    if (!armed || pending) return
    const timeoutId = setTimeout(() => {
      restoreTriggerFocusRef.current = true
      setArmed(false)
    }, ARM_TIMEOUT_MS)
    return () => clearTimeout(timeoutId)
  }, [armed, pending])

  function disarmAndRestoreFocus() {
    restoreTriggerFocusRef.current = true
    setArmed(false)
  }

  return (
    <form
      action={formAction}
      className={styles.actions}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && armed && !pending) {
          event.preventDefault()
          disarmAndRestoreFocus()
        }
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="status" value={nextStatus} />
      {suspend && !armed ? (
        <button
          ref={triggerButtonRef}
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={pending}
          onClick={() => {
            restoreTriggerFocusRef.current = false
            setArmed(true)
          }}
        >
          Pausa kund…
        </button>
      ) : (
        <>
          {suspend ? (
            <span
              id="suspend-tenant-warning"
              className={styles.armWarning}
              role="status"
              aria-live="polite"
            >
              Den publika sajten blockeras och kunden kan inte använda admin tills du aktiverar igen.
            </span>
          ) : null}
          <button
            ref={suspend ? confirmButtonRef : undefined}
            type="submit"
            className={`${styles.btn}${suspend ? ` ${styles.btnDanger}` : ''}`}
            disabled={pending}
            aria-describedby={suspend ? 'suspend-tenant-warning' : undefined}
          >
            {pending ? 'Uppdaterar…' : suspend ? 'Bekräfta paus' : 'Aktivera kund igen'}
          </button>
          {suspend ? (
            <button type="button" className={styles.btn} disabled={pending} onClick={disarmAndRestoreFocus}>
              Avbryt
            </button>
          ) : null}
        </>
      )}
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {state.success}
        </span>
      ) : null}
    </form>
  )
}
