'use client'

import { useState } from 'react'
import type { CustomerContact } from '@/lib/admin/data'
import { Icon } from '@/components/portal/ui'

/**
 * Renders the time-bound contact PII (M6 §4). The server (get_customer_contact
 * RPC) has ALREADY decided whether the real values are available: when
 * `piiVisible` is false the email/phone are null and there is nothing to reveal —
 * we show masked placeholders + an honest reason. When `piiVisible` is true the
 * operator can flip a presentational "Visa/Dölj" so the data isn't on screen by
 * default (keeps it out of shoulder-surfing view between glances).
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 3) return '•••'
  return `••• •• ${digits.slice(-2)}`
}

export function CustomerContactCard({ contact }: { contact: CustomerContact | null }) {
  const [revealed, setRevealed] = useState(false)

  const visible = contact?.piiVisible === true
  const phone = contact?.phone ?? null
  const email = contact?.email ?? null
  const hasAny = Boolean(phone || email)

  return (
    <div style={{ background: 'var(--c-paper-2)', borderRadius: 12, padding: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 10,
        }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>
          {visible ? 'Visas i driftfönstret' : 'Utanför driftfönstret — maskerad'}
        </span>
        {visible && hasAny && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--c-line)',
              borderRadius: 8,
              padding: '5px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 12.5,
              color: 'var(--c-ink)',
            }}
          >
            <Icon name={revealed ? 'x' : 'user'} size={14} />
            {revealed ? 'Dölj' : 'Visa'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>Telefon</div>
          <div className="num" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
            {!phone ? '—' : revealed ? phone : maskPhone(phone)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--c-ink-3)' }}>E-post</div>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>
            {!email ? '—' : revealed ? email : '•••••@•••'}
          </div>
        </div>
      </div>

      {!visible && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--c-ink-3)' }}>
          Kontaktuppgifterna blir synliga igen nära kundens nästa bokning.
        </p>
      )}
    </div>
  )
}
