'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resendRecoveryAction } from '@/app/(customer-portal)/(open)/aterhamta/[tenantSlug]/actions'
import { verifyRecoveryAction } from '@/app/(customer-portal)/(open)/verifiera/[tenantSlug]/actions'

type InitialRecoveryState =
  | { state: 'sent'; attemptsRemaining: number; retryAfterSeconds: number }
  | { state: 'expired' | 'unavailable' }
  | { state: 'max_attempts'; retryAfterSeconds: number }

type VerifyResult =
  | { ok: true }
  | { ok: false; reason?: 'invalid' | 'expired' | 'max_attempts'; attemptsRemaining?: number; retryAfterSeconds?: number }

type ResendResult =
  | { state: 'accepted'; retryAfterSeconds: number }
  | { state: 'unavailable' }
  | { state: 'cooldown' | 'max_attempts'; retryAfterSeconds: number }

function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p className="cp-form-error" id={id} role="alert">
      <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>
      <span>{children}</span>
    </p>
  )
}

function countdownLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const rest = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${rest}`
}

export function PinVerificationForm({
  mode,
  tenantSlug,
  initialState,
  verifyAction = verifyRecoveryAction,
  resendAction = resendRecoveryAction,
}: {
  mode: 'recovery'
  tenantSlug: string
  initialState: InitialRecoveryState
  verifyAction?: (tenantSlug: string, code: string) => Promise<VerifyResult>
  resendAction?: (tenantSlug: string) => Promise<ResendResult>
}) {
  const router = useRouter()
  const fieldRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'sent' | 'verifying' | 'invalid' | 'expired' | 'max_attempts' | 'delivery_failed' | 'verify_failed' | 'verified' | 'resending' | 'resent'>(
    initialState.state === 'unavailable'
      ? 'delivery_failed'
      : initialState.state === 'max_attempts' && initialState.retryAfterSeconds <= 0
        ? 'expired'
        : initialState.state,
  )
  const [attemptsRemaining, setAttemptsRemaining] = useState(initialState.state === 'sent' ? initialState.attemptsRemaining : 0)
  const [retryAfter, setRetryAfter] = useState(
    initialState.state === 'sent'
      ? initialState.retryAfterSeconds
      : initialState.state === 'max_attempts' ? initialState.retryAfterSeconds : 0,
  )

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = window.setInterval(() => setRetryAfter((current) => {
      if (current > 1) return current - 1
      if (state === 'max_attempts') setState('expired')
      return 0
    }), 1000)
    return () => window.clearInterval(timer)
  }, [retryAfter, state])

  useEffect(() => {
    if (state !== 'verified') return
    const timer = window.setTimeout(() => router.replace('/mina'), 160)
    return () => window.clearTimeout(timer)
  }, [router, state])

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code) || state === 'verifying' || state === 'expired' || state === 'max_attempts') return
    setState('verifying')
    try {
      const result = await verifyAction(tenantSlug, code)
      if (result.ok) {
        setState('verified')
        return
      }
      if (result.reason === 'invalid') {
        setAttemptsRemaining(result.attemptsRemaining ?? 0)
        setState('invalid')
        window.setTimeout(() => fieldRef.current?.focus(), 0)
        return
      }
      if (result.reason === 'expired') {
        setState('expired')
        return
      }
      if (result.reason === 'max_attempts') {
        setRetryAfter(result.retryAfterSeconds ?? 0)
        setState('max_attempts')
        return
      }
      setState('verify_failed')
    } catch {
      setState('verify_failed')
    }
  }

  async function handleResend() {
    if (retryAfter > 0 || state === 'resending' || state === 'max_attempts') return
    setState('resending')
    try {
      const result = await resendAction(tenantSlug)
      if (result.state === 'accepted') {
        setCode('')
        setRetryAfter(result.retryAfterSeconds)
        setState('resent')
        window.setTimeout(() => fieldRef.current?.focus(), 0)
        return
      }
      if (result.state === 'cooldown' || result.state === 'max_attempts') {
        setRetryAfter(result.retryAfterSeconds)
        setState(result.state === 'cooldown' ? 'sent' : 'max_attempts')
        return
      }
      setState('delivery_failed')
    } catch {
      setState('delivery_failed')
    }
  }

  const verifyLocked = state === 'verifying' || state === 'expired' || state === 'max_attempts' || state === 'resending' || state === 'verified'
  const needsFreshChallenge = state === 'expired' || (state === 'max_attempts' && retryAfter <= 0)
  const dataState = state === 'sent' || state === 'resent'
    ? retryAfter > 0 ? 'cooldown' : 'resend_ready'
    : state === 'verifying'
      ? 'pending'
      : state === 'resending'
      ? 'sending'
      : state === 'verify_failed'
        ? retryAfter > 0 ? 'cooldown' : 'resend_ready'
        : state
  const error = state === 'invalid'
    ? `Fel kod. Du har ${attemptsRemaining} försök kvar.`
    : state === 'expired'
      ? 'Koden har gått ut. Begär en ny kod.'
      : state === 'max_attempts'
        ? `För många försök. Försök igen om ${Math.max(1, Math.ceil(retryAfter / 60))} min.`
        : state === 'delivery_failed'
          ? 'Koden kunde inte skickas. Försök igen.'
          : state === 'verify_failed'
            ? 'Koden kunde inte kontrolleras. Försök igen.'
          : null

  if (state === 'verified') {
    return (
      <section className="cp-recovery-screen" data-screen="verifiera" data-state="verified">
        <p className="cp-verified" role="status">
          <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
          Verifierad
        </p>
      </section>
    )
  }

  return (
    <section className="cp-recovery-screen" data-screen="verifiera" data-state={dataState}>
      <h1>Ange koden</h1>
      <p className="cp-channel-note" aria-live="polite">
        {state === 'resent' ? 'En ny kod har skickats.' : 'Om uppgiften finns hos oss har vi skickat en kod.'}
      </p>
      <form className="cp-recovery-card cp-form" onSubmit={handleVerify} noValidate>
        <label className="cp-field-label" htmlFor="engangskod">Engångskod</label>
        <input
          ref={fieldRef}
          className="cp-input cp-code-input"
          id="engangskod"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus={initialState.state === 'sent'}
          value={code}
          disabled={verifyLocked}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? 'verify-error' : undefined}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            if (state === 'invalid' || state === 'delivery_failed' || state === 'verify_failed' || state === 'resent') setState('sent')
          }}
        />
        {error && <FormError id="verify-error">{error}</FormError>}
        <button className="cp-btn cp-btn-primary cp-submit" type="submit" disabled={verifyLocked || code.length !== 6} aria-disabled={verifyLocked || code.length !== 6}>
          {state === 'verifying' ? 'Verifierar…' : 'Verifiera'}
        </button>
        <div className="cp-resend">
          {needsFreshChallenge ? (
            <Link className="cp-btn cp-btn-ghost" href={`/aterhamta/${tenantSlug}`}>Skicka ny kod</Link>
          ) : retryAfter > 0 ? (
            <span aria-live="polite">Skicka ny kod om {countdownLabel(retryAfter)}</span>
          ) : (
            <button className="cp-btn cp-btn-ghost" type="button" onClick={handleResend} disabled={state === 'resending'} aria-disabled={state === 'resending'}>
              {state === 'resending' ? 'Skickar…' : 'Skicka ny kod'}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
