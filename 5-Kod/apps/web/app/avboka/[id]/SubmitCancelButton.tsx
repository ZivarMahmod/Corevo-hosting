'use client'

import { useFormStatus } from 'react-dom'

export function SubmitCancelButton() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className="tkt-btn-accent" disabled={pending} aria-disabled={pending}>
      {pending ? 'Avbokar…' : 'Avboka tid'}
    </button>
  )
}
