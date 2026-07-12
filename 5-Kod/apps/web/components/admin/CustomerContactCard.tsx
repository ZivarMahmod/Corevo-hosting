'use client'

import { useActionState, useState } from 'react'
import { saveCustomerContact, type ActionState } from '@/lib/admin/actions'
import type { CustomerContact } from '@/lib/admin/data'
import { Icon } from '@/components/portal/ui'
import styles from './admin.module.css'

/**
 * Renders the time-bound contact PII (M6 §4). The server (get_customer_contact
 * RPC) has ALREADY decided whether the real values are available: when
 * `piiVisible` is false the email/phone are null and there is nothing to reveal —
 * we show masked placeholders + an honest reason. When `piiVisible` is true the
 * operator can flip a presentational "Visa/Dölj" so the data isn't on screen by
 * default (keeps it out of shoulder-surfing view between glances).
 *
 * REDIGERA (saveCustomerContact): front-desk måste kunna rätta en feltypad siffra.
 * Formuläret visas BARA när `piiVisible && canEdit`, och det är inte kosmetik:
 *   · piiVisible=false ⇒ RPC:n gav oss null, inte de riktiga värdena. Ett formulär
 *     hade då stått TOMT — och ett "Spara" hade skrivit tomt över riktig data.
 *     Utanför fönstret finns alltså inget att redigera, bara att förstöra.
 *   · canEdit=false ⇒ GDPR-skrubbad kund (status='anonymized'). Server-actionen
 *     vägrar också — det här är bara att inte visa en knapp som ändå säger nej.
 * Namnet redigeras inte här: visningsnamnet äger CustomerPrivacyForm (samma sida),
 * och full_name maskas bort av RPC:n vid name_hidden → samma tom-fält-fälla.
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 3) return '•••'
  return `••• •• ${digits.slice(-2)}`
}

export function CustomerContactCard({
  contact,
  customerId,
  canEdit = false,
}: {
  contact: CustomerContact | null
  customerId: string
  /** False = GDPR-skrubbad kund (status ≠ 'active') → aldrig redigerbar. */
  canEdit?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveCustomerContact, {})

  const visible = contact?.piiVisible === true
  const phone = contact?.phone ?? null
  const email = contact?.email ?? null
  const hasAny = Boolean(phone || email)
  const editable = visible && canEdit

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
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {visible && hasAny && !editing && (
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
          {editable && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
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
              <Icon name="edit" size={14} />
              Redigera
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <form action={formAction} className={`${styles.form} ${styles.formStacked}`} style={{ margin: 0 }}>
          <input type="hidden" name="customer_id" value={customerId} />

          <label className={styles.field}>
            <span>Telefon</span>
            <input name="phone" defaultValue={phone ?? ''} placeholder="070-123 45 67" />
          </label>
          <label className={styles.field} style={{ marginTop: 12 }}>
            <span>E-post</span>
            <input
              name="email"
              type="email"
              defaultValue={email ?? ''}
              placeholder="kund@exempel.se"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <div className={styles.actions} style={{ marginTop: 12 }}>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Sparar…' : 'Spara kontaktuppgifter'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              style={{
                background: 'transparent',
                border: '1px solid var(--c-line)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: pending ? 'default' : 'pointer',
                fontFamily: 'var(--font-ui)',
                fontSize: 12.5,
                color: 'var(--c-ink-2)',
              }}
            >
              Avbryt
            </button>
            {state.error ? (
              <span className={`${styles.feedback} auth-error`} role="alert">
                {state.error}
              </span>
            ) : null}
            {state.success ? (
              <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
                {state.success}
              </span>
            ) : null}
          </div>
        </form>
      ) : (
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
      )}

      {!visible && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--c-ink-3)' }}>
          Kontaktuppgifterna blir synliga igen nära kundens nästa bokning.
        </p>
      )}
      {visible && !canEdit && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--c-ink-3)' }}>
          Kunden är raderad (GDPR) — uppgifterna kan inte ändras.
        </p>
      )}
    </div>
  )
}
