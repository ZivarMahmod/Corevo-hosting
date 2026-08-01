'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { cancelPortalBookingAction } from '@/app/(customer-portal)/mina/actions'
import { usePortalCancellationFeedback } from './PortalCancellationFeedback'

type DialogState = 'closed' | 'confirm' | 'pending' | 'error' | 'policy_blocked' | 'closing'
type TerminalState = 'none' | 'cancelled' | 'policy_blocked'
type CloseReason = 'dismissed' | 'success' | 'policy_blocked'

const EXIT_DURATION_MS = 140

type BlockedContact = {
  phone: string | null
  website: string
}

export function PortalBookingCancellation({
  bookingPublicId,
  expectedCutoffHours,
  tenantName,
  bookingSummary,
  policyText,
  triggerLabel,
  blockedContact,
  variant,
}: {
  bookingPublicId: string
  expectedCutoffHours: number
  tenantName: string
  bookingSummary: string
  policyText: string | null
  triggerLabel: 'Avboka' | 'Avboka bokningen'
  blockedContact: BlockedContact
  variant: 'home' | 'detail'
}) {
  const router = useRouter()
  const feedback = usePortalCancellationFeedback()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const idempotencyKeyRef = useRef<string | null>(null)
  const requestPendingRef = useRef(false)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [dialogState, setDialogState] = useState<DialogState>('closed')
  const [terminalState, setTerminalState] = useState<TerminalState>('none')

  const dialogOpen = dialogState !== 'closed'
  const pending = dialogState === 'pending'
  const closing = dialogState === 'closing'
  const locked = pending || closing

  const finishClose = useCallback((reason: CloseReason) => {
    closeTimerRef.current = null
    closingRef.current = false
    idempotencyKeyRef.current = null
    setDialogState('closed')

    if (reason === 'success') {
      setTerminalState('cancelled')
      if (!feedback) {
        document.getElementById('huvudinnehall')?.focus()
        router.refresh()
      }
      return
    }
    if (reason === 'policy_blocked') {
      setTerminalState('policy_blocked')
      feedback?.focusPortalContent()
      if (!feedback) document.getElementById('huvudinnehall')?.focus()
      router.refresh()
      return
    }
    triggerRef.current?.focus()
  }, [feedback, router])

  const closeDialog = useCallback((
    reason: CloseReason = 'dismissed',
    durationOverride?: number,
  ) => {
    if (requestPendingRef.current || closingRef.current) return
    closingRef.current = true
    setDialogState('closing')
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    closeTimerRef.current = window.setTimeout(
      () => finishClose(reason),
      durationOverride ?? (reducedMotion ? 0 : EXIT_DURATION_MS),
    )
  }, [finishClose])

  useEffect(() => setMounted(true), [])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [dialogOpen])

  useEffect(() => {
    if (dialogState === 'confirm') keepRef.current?.focus()
  }, [dialogState])

  useEffect(() => {
    if (!dialogOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog(dialogState === 'policy_blocked' ? 'policy_blocked' : 'dismissed')
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([aria-disabled="true"]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeDialog, dialogOpen, dialogState])

  function openDialog() {
    closingRef.current = false
    idempotencyKeyRef.current = globalThis.crypto.randomUUID()
    setDialogState('confirm')
  }

  async function submitCancellation() {
    if (requestPendingRef.current) return
    requestPendingRef.current = true
    setDialogState('pending')
    const idempotencyKey = idempotencyKeyRef.current ?? globalThis.crypto.randomUUID()
    idempotencyKeyRef.current = idempotencyKey

    try {
      const result = await cancelPortalBookingAction({
        bookingPublicId,
        expectedCutoffHours,
        idempotencyKey,
      })
      if (result.outcome === 'success') {
        requestPendingRef.current = false
        const stableHostDelay = feedback?.scheduleSuccess(tenantName)
        closeDialog('success', stableHostDelay)
      } else if (result.outcome === 'policy_blocked') {
        setDialogState('policy_blocked')
      } else {
        setDialogState('error')
      }
    } catch {
      setDialogState('error')
    } finally {
      requestPendingRef.current = false
    }
  }

  const trigger = terminalState === 'none' ? (
    <button
      className="cp-btn cp-btn-danger cp-cancel-trigger"
      type="button"
      ref={triggerRef}
      onClick={openDialog}
      data-cancel-variant={variant}
    >
      {triggerLabel}
    </button>
  ) : null

  const blocked = terminalState === 'policy_blocked' && variant === 'detail' ? (
    <p className="cp-cancel-blocked" role="status">
      {blockedContact.phone ? (
        <>Den här bokningen kan inte längre avbokas online. Ring {tenantName} på{' '}
          <a href={`tel:${blockedContact.phone}`}>{blockedContact.phone}</a>.</>
      ) : (
        <>Den här bokningen kan inte längre avbokas online. Kontakta {tenantName} via{' '}
          <a href={blockedContact.website} rel="noopener">deras webbplats</a>.</>
      )}
    </p>
  ) : null

  const dialog = mounted && dialogOpen ? createPortal(
    <div className="cp-cancel-layer" data-closing={closing ? 'true' : undefined}>
      <div className="cp-cancel-scrim" aria-hidden="true" />
      <div
        className="cp-cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avboka-titel"
        aria-describedby="avboka-brod"
        ref={dialogRef}
      >
        <div className="cp-cancel-handle" aria-hidden="true" />
        <button
          className="cp-cancel-close"
          type="button"
          aria-label="Stäng"
          aria-disabled={locked ? 'true' : undefined}
          onClick={() => closeDialog(dialogState === 'policy_blocked' ? 'policy_blocked' : 'dismissed')}
        >
          <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
        </button>
        <h2 id="avboka-titel">Avboka bokningen?</h2>
        <p id="avboka-brod" className="cp-cancel-summary">
          <span className="cp-mono">{bookingSummary}</span>
          {policyText && <span className="cp-cancel-policy">{policyText}</span>}
        </p>

        {dialogState === 'error' && (
          <p className="cp-cancel-error" role="alert">
            <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11.5h.01" /></svg>
            Avbokningen kunde inte genomföras. Din bokning är oförändrad.
          </p>
        )}
        {dialogState === 'policy_blocked' && (
          <p className="cp-cancel-error" role="alert">
            <svg className="cp-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5v4M8 11.5h.01" /></svg>
            Bokningen kan inte längre avbokas online. Din bokning är oförändrad.
          </p>
        )}

        <div className="cp-cancel-actions">
          {dialogState === 'policy_blocked' ? (
            <button className="cp-btn" type="button" onClick={() => closeDialog('policy_blocked')}>Stäng</button>
          ) : dialogState === 'error' ? (
            <>
              <button className="cp-btn" type="button" onClick={() => closeDialog()}>Behåll bokningen</button>
              <button className="cp-btn cp-btn-danger" type="button" onClick={submitCancellation}>Försök igen</button>
            </>
          ) : (
            <>
              <button
                className="cp-btn"
                type="button"
                ref={keepRef}
                aria-disabled={locked ? 'true' : undefined}
                onClick={() => closeDialog()}
              >
                Behåll bokningen
              </button>
              <button
                className="cp-btn cp-btn-danger"
                type="button"
                aria-disabled={locked ? 'true' : undefined}
                onClick={submitCancellation}
              >
                {pending ? 'Avbokar…' : 'Ja, avboka'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  ) : null

  return <>{trigger}{blocked}{dialog}</>
}
