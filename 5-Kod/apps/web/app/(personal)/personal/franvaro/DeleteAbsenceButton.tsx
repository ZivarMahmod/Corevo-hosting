'use client'

import { useActionState, useEffect } from 'react'
import { deleteTimeOff, type ActionState } from '@/lib/personal/actions'
import { Button, useToast } from '@/components/portal/ui'

/**
 * Co-located delete for one frånvaro row. Mirrors the shared DeleteRowButton
 * (same `deleteTimeOff` action, hidden id) but adds the §4.10 consequence toast
 * the shared button can't fire (it's owned by the shared pass and swallows its
 * own success). Additive: keeps the shipped immediate-delete behavior.
 */
export function DeleteAbsenceButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteTimeOff, {})
  const { notify } = useToast()

  // Depend on the state OBJECT so a repeat delete still refires the toast.
  useEffect(() => {
    if (state.success) notify('Frånvaro borttagen — tiden åter bokningsbar', 'info')
    else if (state.error) notify(state.error, 'warning')
  }, [state, notify])

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button variant="ghost" size="sm" icon="trash" type="submit" disabled={pending}>
        {pending ? '…' : 'Ta bort'}
      </Button>
    </form>
  )
}
