'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { createCustomer, type ActionState } from '@/lib/admin/actions'
import { Button } from '@/components/portal/ui'
import { useToast } from '@/components/portal/ui/Toast'

const INPUT_STYLE: CSSProperties = {
  border: '1px solid var(--c-line, #d9d4c8)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  background: 'var(--c-bg, #fff)',
  minWidth: 150,
}

/**
 * "Ny kund" i ägaradminens kundlista (plan 007 — CRUD-symmetri: front-desk ska
 * kunna lägga in en stamkund utan att först skapa en bokning). Minimal disclosure:
 * knapp → inline-formulär (namn krav, kontakt valfri). Tenant sätts server-side ur
 * JWT — formuläret bär aldrig tenant-id.
 */
export function CreateCustomerForm() {
  const { notify } = useToast()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCustomer, {})

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      formRef.current?.reset()
      setOpen(false)
      router.refresh()
    }
    if (state.error) notify(state.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  if (!open) {
    return (
      <Button variant="primary" size="sm" icon="plus" type="button" onClick={() => setOpen(true)}>
        Ny kund
      </Button>
    )
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <input
        name="full_name"
        placeholder="Namn (krav)"
        required
        maxLength={120}
        style={INPUT_STYLE}
        autoFocus
      />
      <input
        name="email"
        type="email"
        placeholder="E-post (valfri)"
        maxLength={160}
        style={INPUT_STYLE}
      />
      <input name="phone" placeholder="Telefon (valfri)" maxLength={40} style={INPUT_STYLE} />
      <Button variant="primary" size="sm" type="submit" disabled={pending}>
        {pending ? 'Skapar…' : 'Skapa'}
      </Button>
      <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
        Avbryt
      </Button>
    </form>
  )
}
