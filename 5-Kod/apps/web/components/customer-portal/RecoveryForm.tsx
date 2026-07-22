'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { startRecoveryAction } from '@/app/(customer-portal)/(open)/aterhamta/[tenantSlug]/actions'

type RecoveryStartResult =
  | { state: 'accepted'; retryAfterSeconds: number }
  | { state: 'unavailable' }
  | { state: 'cooldown' | 'max_attempts'; retryAfterSeconds: number }

type RecoveryStartAction = (tenantSlug: string, lookup: string) => Promise<RecoveryStartResult>

function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="cp-form-error" id={id} role="alert">
      <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>
      <span>{children}</span>
    </p>
  )
}

function validLookup(value: string): boolean {
  const normalized = value.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return true
  return /^\+?\d{7,15}$/.test(normalized.replace(/[\s()-]/g, ''))
}

export function RecoveryForm({
  tenantSlug,
  tenantName,
  sessionExpired = false,
  startAction = startRecoveryAction,
}: {
  tenantSlug: string
  tenantName: string
  sessionExpired?: boolean
  startAction?: RecoveryStartAction
}) {
  const router = useRouter()
  const fieldRef = useRef<HTMLInputElement>(null)
  const [lookup, setLookup] = useState('')
  const [state, setState] = useState<'default' | 'pending' | 'network_error' | 'invalid' | 'cooldown' | 'max_attempts'>('default')
  const [retryAfter, setRetryAfter] = useState(0)
  const [toastVisible, setToastVisible] = useState(sessionExpired)
  const [toastPaused, setToastPaused] = useState(false)

  useEffect(() => {
    if (retryAfter <= 0 || (state !== 'cooldown' && state !== 'max_attempts')) return
    const timer = window.setInterval(() => {
      setRetryAfter((current) => {
        if (current > 1) return current - 1
        setState('default')
        return 0
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retryAfter, state])

  useEffect(() => {
    if (!toastVisible || toastPaused) return
    const timer = window.setTimeout(() => setToastVisible(false), 5000)
    return () => window.clearTimeout(timer)
  }, [toastPaused, toastVisible])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === 'pending' || state === 'cooldown' || state === 'max_attempts') return
    if (!validLookup(lookup)) {
      setState('invalid')
      window.setTimeout(() => fieldRef.current?.focus(), 0)
      return
    }

    setState('pending')
    try {
      const result = await startAction(tenantSlug, lookup.trim())
      if (result.state === 'accepted') {
        router.replace(`/verifiera/${tenantSlug}`)
        return
      }
      if (result.state === 'cooldown' || result.state === 'max_attempts') {
        setRetryAfter(result.retryAfterSeconds)
        setState(result.state)
        return
      }
      setState('network_error')
    } catch {
      setState('network_error')
    }
  }

  const locked = state === 'pending' || state === 'cooldown' || state === 'max_attempts'
  const describedBy = state === 'invalid' || state === 'network_error' || state === 'max_attempts' ? 'recovery-error' : undefined

  return (
    <section className="cp-recovery-screen" data-screen="aterhamta" data-state={state}>
      {toastVisible && (
        <p
          className="cp-toast"
          role="status"
          tabIndex={0}
          onMouseEnter={() => setToastPaused(true)}
          onMouseLeave={() => setToastPaused(false)}
          onFocus={() => setToastPaused(true)}
          onBlur={() => setToastPaused(false)}
        >
          <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>
          <span>Din session har gått ut. Verifiera dig igen.</span>
        </p>
      )}
      <h1>Kom åt dina bokningar</h1>
      <p>Ange mobilnumret eller e-postadressen du bokade med hos {tenantName}, så skickar vi en engångskod.</p>
      <form className="cp-recovery-card cp-form" onSubmit={handleSubmit} noValidate>
        <label className="cp-field-label" htmlFor="kontakt">Mobilnummer eller e-post</label>
        <input
          ref={fieldRef}
          className="cp-input"
          id="kontakt"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={lookup}
          disabled={locked}
          aria-invalid={state === 'invalid' || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setLookup(event.target.value)
            if (state === 'invalid' || state === 'network_error') setState('default')
          }}
        />
        {state === 'invalid' && <FormError id="recovery-error">Ange ett giltigt mobilnummer eller en giltig e-postadress.</FormError>}
        {state === 'network_error' && <FormError id="recovery-error">Något gick fel. Försök igen.</FormError>}
        {state === 'cooldown' && <p className="cp-form-note" aria-live="polite">Du kan begära en ny kod om {retryAfter} s.</p>}
        {state === 'max_attempts' && <FormError id="recovery-error">För många försök. Försök igen om {Math.max(1, Math.ceil(retryAfter / 60))} min.</FormError>}
        <button className="cp-btn cp-btn-primary cp-submit" type="submit" disabled={locked} aria-disabled={locked}>
          {state === 'pending' ? 'Skickar…' : 'Skicka kod'}
        </button>
        <p className="cp-form-meta">Koden skickas bara till en kontaktuppgift som redan är verifierad hos {tenantName}.</p>
      </form>
    </section>
  )
}
