'use client'

import { useState } from 'react'
import { Icon } from './Icon'
import { useToast } from './Toast'

/** Mask a phone number to the handoff pattern "070- •• •• ••" (first 4 chars
 *  kept). Pure — exported so list/table cells can show the masked form without
 *  mounting the full reveal control. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone === '—') return '—'
  return `${phone.slice(0, 4)} •• •• ••`
}

/** Mask an email to "•••••@•••" (the handoff convention). */
export function maskEmail(email: string | null | undefined): string {
  if (!email || email === '—') return '—'
  return '•••••@•••'
}

/**
 * Time-bound PII reveal (playbook §4.9 + §6 "Röd tråd"). Contact details are
 * MASKED by default; "Visa" reveals them and fires the logged warning toast
 * ("Kontaktuppgift synlig i 15 min (loggas)"). "Dölj" re-masks. GDPR-minimised
 * by design: nothing is shown until an operator explicitly asks.
 *
 * The toast says "loggas", so the reveal exposes an `onReveal` seam for the data
 * layer to write the real audit-log entry — this primitive does NOT import lib
 * (presentational + the toast only). It also does not run a real 15-minute
 * auto-remask timer (the copy communicates the policy; the actual TTL is enforced
 * server-side via the audit/reveal grant the data agent wires through onReveal).
 *
 * Layout matches the handoff (Bookings.jsx / Customers.jsx PII block): a header
 * row with a label + the Visa/Dölj button, then phone + email columns.
 */
export function PiiReveal({
  phone,
  email,
  label = 'Kontaktuppgifter',
  note,
  onReveal,
  onHide,
}: {
  phone: string | null | undefined
  email: string | null | undefined
  /** Header label (e.g. "Kontaktuppgifter" or "Kontakt-PII · tidsbunden"). */
  label?: string
  /** Optional caption shown under the values while masked (retention copy). */
  note?: string
  /** Fired when the operator reveals — wire the audit-log write here. */
  onReveal?: () => void
  /** Fired when the operator re-hides. */
  onHide?: () => void
}) {
  const [revealed, setRevealed] = useState(false)
  const { notify } = useToast()

  const hasPhone = !!phone && phone !== '—'
  const hasEmail = !!email && email !== '—'
  const canReveal = hasPhone || hasEmail

  function reveal() {
    setRevealed(true)
    onReveal?.()
    notify('Kontaktuppgift synlig i 15 min (loggas)', 'warning')
  }
  function hide() {
    setRevealed(false)
    onHide?.()
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
            <button type="button" className="bo-pii-btn" onClick={reveal}>
              <Icon name="eye" size={14} />
              Visa
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
            {revealed && hasPhone ? phone : maskPhone(phone)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>E-post</div>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2, color: 'var(--c-ink)' }}>
            {revealed && hasEmail ? email : maskEmail(email)}
          </div>
        </div>
      </div>
      {note && !revealed && (
        <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 10 }}>{note}</div>
      )}
    </div>
  )
}
