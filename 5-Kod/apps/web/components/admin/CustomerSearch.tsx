'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/portal/ui'

/**
 * Free-text customer search (M6 §3.1). A GET form that pushes `?q=` so the list
 * page re-queries server-side — no client data fetching, RLS stays the fence.
 * Searches the SHOWN name only (never the hidden full name).
 */
export function CustomerSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [value, setValue] = useState(defaultValue)

  function submit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(sp.toString())
    const v = value.trim()
    if (v) params.set('q', v)
    else params.delete('q')
    router.push(`/admin/kunder${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <form onSubmit={submit} style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--c-ink-3)',
          display: 'inline-flex',
        }}
      >
        <Icon name="search" size={16} />
      </span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Sök kund…"
        aria-label="Sök kund"
        style={{
          width: '100%',
          padding: '10px 12px 10px 36px',
          borderRadius: 10,
          border: '1px solid var(--c-line)',
          background: 'var(--c-paper)',
          fontFamily: 'var(--font-ui)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </form>
  )
}
