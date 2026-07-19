'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties } from 'react'
import { createCustomer, type ActionState } from '@/lib/admin/actions'
import { Button, Modal } from '@/components/portal/ui'
import { useToast } from '@/components/portal/ui/Toast'

const INPUT_STYLE: CSSProperties = {
  border: '1px solid var(--c-line, #d9d4c8)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  background: 'var(--c-paper-2)',
  color: 'var(--c-ink)',
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
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCustomer, {})

  useEffect(() => {
    if (!searchParams.has('ny')) return
    setOpen(true)
    // Parametern är en engångssignal. Den tas bort direkt så att samma
    // mobilknapp kan öppna panelen igen utan omladdning och Back inte återöppnar den.
    router.replace('/admin/kunder', { scroll: false })
  }, [router, searchParams])

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
    <Modal title="Ny kund" anchor="top" onClose={() => setOpen(false)}>
      <form ref={formRef} action={formAction} style={{ display: 'grid', gap: 12, width: '100%' }}>
        <input
          name="full_name"
          placeholder="Namn (krav)"
          required
          maxLength={120}
          style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', minHeight: 44 }}
          autoFocus
        />
        <input
          name="email"
          type="email"
          placeholder="E-post (valfri)"
          maxLength={160}
          style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', minHeight: 44 }}
        />
        <input
          name="phone"
          placeholder="Telefon (valfri)"
          maxLength={40}
          style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', minHeight: 44 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" type="button" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={pending}>
            {pending ? 'Skapar…' : 'Skapa kund'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
