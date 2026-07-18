'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useToast } from './Toast'

export { maskEmail, maskPhone } from './pii'

export type PiiContact = {
  email: string | null
  phone: string | null
}

export type PiiRevealLoadResult =
  | { ok: true; contact: PiiContact; expiresAt: string }
  | { ok: false; error: string }

/**
 * Lazy, time-bound contact reveal. Initial props contain masks only; raw contact
 * is fetched after an explicit click and kept in local state only until the
 * server-provided expiry. A loader may claim success only after its audit write
 * succeeded, so the success toast can truthfully say the reveal was logged.
 */
export function PiiReveal({
  maskedPhone,
  maskedEmail,
  loadContact,
  label = 'Kontaktuppgifter',
  note,
  onContactChange,
}: {
  maskedPhone: string
  maskedEmail: string
  loadContact: () => Promise<PiiRevealLoadResult>
  label?: string
  note?: string
  onContactChange?: (contact: PiiContact | null) => void
}) {
  const [contact, setContact] = useState<PiiContact | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const onContactChangeRef = useRef(onContactChange)
  onContactChangeRef.current = onContactChange
  const { notify } = useToast()

  const canReveal = maskedPhone !== '—' || maskedEmail !== '—'
  const revealed = contact !== null

  useEffect(() => {
    return () => {
      request.current += 1
      onContactChangeRef.current?.(null)
    }
  }, [])

  useEffect(() => {
    if (!contact || !expiresAt) return
    const remaining = Math.max(0, Date.parse(expiresAt) - Date.now())
    const timer = window.setTimeout(() => {
      setContact(null)
      setExpiresAt(null)
      setError(null)
      onContactChangeRef.current?.(null)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [contact, expiresAt])

  async function reveal() {
    if (loading || revealed) return
    const requestId = ++request.current
    setLoading(true)
    setError(null)
    try {
      const result = await loadContact()
      if (request.current !== requestId) return
      if (!result.ok) {
        setError(result.error)
        notify(result.error, 'warning')
        return
      }
      const expiry = Date.parse(result.expiresAt)
      if (!Number.isFinite(expiry) || expiry <= Date.now()) {
        const message = 'Kontaktuppgifternas visningstid har redan löpt ut. Försök igen.'
        setError(message)
        notify(message, 'warning')
        return
      }
      setContact(result.contact)
      setExpiresAt(result.expiresAt)
      onContactChangeRef.current?.(result.contact)
      notify('Kontaktuppgift synlig i 15 min (loggad)', 'warning')
    } catch {
      if (request.current !== requestId) return
      const message = 'Kontaktuppgifterna kunde inte hämtas. Försök igen.'
      setError(message)
      notify(message, 'warning')
    } finally {
      if (request.current === requestId) setLoading(false)
    }
  }

  function hide() {
    request.current += 1
    setContact(null)
    setExpiresAt(null)
    setLoading(false)
    setError(null)
    onContactChangeRef.current?.(null)
  }

  return (
    <div
      style={{
        background: 'var(--c-paper-2)',
        borderRadius: 12,
        padding: 14,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            color: 'var(--c-ink-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Icon name="shield" size={14} style={{ color: 'var(--c-ink-3)' }} />
          {label}
        </span>
        {canReveal &&
          (revealed ? (
            <button type="button" className="bo-pii-btn" onClick={hide}>
              <Icon name="eyeOff" size={14} />
              Dölj
            </button>
          ) : (
            <button type="button" className="bo-pii-btn" onClick={reveal} disabled={loading}>
              <Icon name="eye" size={14} />
              {loading ? 'Hämtar…' : 'Visa'}
            </button>
          ))}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>Telefon</div>
          <div
            className="num"
            style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2, color: 'var(--c-ink)' }}
          >
            {revealed ? (contact.phone ?? '—') : maskedPhone}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>E-post</div>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2, color: 'var(--c-ink)' }}>
            {revealed ? (contact.email ?? '—') : maskedEmail}
          </div>
        </div>
      </div>
      {note && !revealed && (
        <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 10 }}>{note}</div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 11.5, color: 'var(--c-danger)', marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  )
}
