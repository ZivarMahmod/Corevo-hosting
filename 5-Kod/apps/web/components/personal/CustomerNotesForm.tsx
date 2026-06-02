'use client'

import { useActionState } from 'react'
import { upsertCustomerNotes, type ActionState } from '@/lib/personal/actions'
import type { CustomerNotes } from '@/lib/personal/customer'
import styles from './personal.module.css'

const HAIR_TYPES = ['rakt', 'vågigt', 'lockigt', 'afro']
const HAIR_LENGTHS = ['kort', 'medel', 'långt']
const SENSITIVITIES = ['normal', 'känslig hårbotten', 'känslig hud']

/**
 * Internal client-card notes (M5 §2.3). Structured, content-guarded: tag arrays
 * (comma/newline-separated) + guarded enums + a vaktad free-text note. Upserts the
 * single (tenant, customer) row. Strictly staff-only — never customer-facing.
 */
export function CustomerNotesForm({
  customerId,
  notes,
}: {
  customerId: string
  notes: CustomerNotes
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(upsertCustomerNotes, {})

  return (
    <form action={formAction} className={styles.notesForm}>
      <input type="hidden" name="customerId" value={customerId} />

      <label className={styles.field}>
        <span>Önskemål (komma-separerat)</span>
        <input
          name="preferences"
          type="text"
          defaultValue={notes.preferences.join(', ')}
          placeholder="t.ex. kort sidor, 4 på toppen"
        />
      </label>

      <label className={styles.field}>
        <span>Allergier / känslighet (komma-separerat)</span>
        <input
          name="allergies"
          type="text"
          defaultValue={notes.allergies.join(', ')}
          placeholder="t.ex. PPD-blekning, parfymerat"
        />
      </label>

      <label className={styles.field}>
        <span>Produkter (komma-separerat)</span>
        <input
          name="products"
          type="text"
          defaultValue={notes.products.join(', ')}
          placeholder="t.ex. silverschampo"
        />
      </label>

      <div className={styles.notesEnums}>
        <label className={styles.field}>
          <span>Hårtyp</span>
          <select name="hairType" defaultValue={notes.hairType ?? ''}>
            <option value="">–</option>
            {HAIR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Längd</span>
          <select name="hairLength" defaultValue={notes.hairLength ?? ''}>
            <option value="">–</option>
            {HAIR_LENGTHS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Känslighet</span>
          <select name="sensitivity" defaultValue={notes.sensitivity ?? ''}>
            <option value="">–</option>
            {SENSITIVITIES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.field}>
        <span>Intern notering</span>
        <textarea
          name="internalNote"
          rows={3}
          defaultValue={notes.internalNote ?? ''}
          placeholder="Endast internt — visas aldrig för kunden."
          className={styles.textarea}
        />
      </label>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara klientkort'}
        </button>
      </div>

      {state.error ? (
        <p className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {state.success}
        </p>
      ) : null}
    </form>
  )
}
