'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@/components/portal/ui'
import type { ActionState } from '@/lib/platform/actions/shared'

const ARM_TIMEOUT_MS = 10_000

export function useRefreshOnActionSuccess(state: ActionState, pending: boolean) {
  const router = useRouter()
  const { notify } = useToast()
  const submittedRef = useRef(false)

  useEffect(() => {
    if (pending) {
      submittedRef.current = true
      return
    }
    if (!submittedRef.current) return
    submittedRef.current = false
    if (!state.success) return
    notify(state.success, 'success')
    router.refresh()
  }, [notify, pending, router, state.success])
}

export function PartnerMutationSubmit({
  state,
  pending,
  triggerLabel,
  confirmLabel,
  pendingLabel,
  warning,
}: {
  state: ActionState
  pending: boolean
  triggerLabel: string
  confirmLabel: string
  pendingLabel: string
  warning: string
}) {
  const [armed, setArmed] = useState(false)
  const triggerButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const submittedRef = useRef(false)
  const restoreTriggerFocusRef = useRef(false)

  useEffect(() => {
    if (pending) {
      submittedRef.current = true
      return
    }
    if (!submittedRef.current) return
    submittedRef.current = false
    if (state.success) {
      restoreTriggerFocusRef.current = true
      setArmed(false)
    }
  }, [pending, state.success])

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

  useEffect(() => {
    if (!armed || pending) return
    const form = confirmButtonRef.current?.form
    if (!form) return
    const disarmForChangedValues = () => {
      restoreTriggerFocusRef.current = false
      setArmed(false)
    }
    form.addEventListener('input', disarmForChangedValues)
    form.addEventListener('change', disarmForChangedValues)
    return () => {
      form.removeEventListener('input', disarmForChangedValues)
      form.removeEventListener('change', disarmForChangedValues)
    }
  }, [armed, pending])

  function disarmAndRestoreFocus() {
    restoreTriggerFocusRef.current = true
    setArmed(false)
  }

  if (!armed) {
    return (
      <Button
        type="button"
        disabled={pending}
        buttonRef={triggerButtonRef}
        onClick={() => {
          restoreTriggerFocusRef.current = false
          setArmed(true)
        }}
      >
        {triggerLabel}
      </Button>
    )
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          event.preventDefault()
          disarmAndRestoreFocus()
        }
      }}
    >
      <span role="status" aria-live="polite" style={{ flexBasis: '100%', color: 'var(--c-warning)', fontSize: 12 }}>
        {warning}
      </span>
      <Button type="submit" disabled={pending} buttonRef={confirmButtonRef}>
        {pending ? pendingLabel : confirmLabel}
      </Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={disarmAndRestoreFocus}>
        Avbryt
      </Button>
    </div>
  )
}
