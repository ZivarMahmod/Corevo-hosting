'use client'

// ATELJÉ VINTER — KONTAKTFORMULÄRET (goal-64 regression). Filens `showKontakt`:
// namn + e-post i två spalter, meddelande under (placeholder "vi läser allt,
// långsamt men noggrant"), knappen "skicka" i gemener. Understrukna hårlinjefält,
// exakt samma grammatik som offert/kurser/kassa.
//
// FUNKTIONEN är modulens: submitContactMessage (honeypot, validering, pending,
// fel) — den delade ContactForm-öns EXAKTA kontrakt, bara markupen är mallens.

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  CONTACT_HONEYPOT,
  CONTACT_MAX,
  CONTACT_SUBMIT_INITIAL,
  type ContactSubmitState,
} from '@/lib/storefront/kontakt/types'
import { submitContactMessage } from '@/lib/storefront/kontakt/intake'
import styles from './ateljevinter.module.css'

function AvKontaktSubmit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={styles.avSolidWide} disabled={pending}>
      {pending ? 'skickar…' : 'skicka'}
    </button>
  )
}

export function AteljeVinterKontaktForm({ doneText }: { doneText: string }) {
  const [state, formAction] = useActionState<ContactSubmitState, FormData>(
    submitContactMessage,
    CONTACT_SUBMIT_INITIAL,
  )

  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.avFormDone}>
        {doneText}
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.avForm}>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <input type="text" name={CONTACT_HONEYPOT} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className={styles.avFormRow}>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-kontakt-name">
            namn
          </label>
          <input
            id="av-kontakt-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={CONTACT_MAX.name}
            placeholder="för- och efternamn"
            className={styles.avField}
          />
        </div>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-kontakt-email">
            e-post
          </label>
          <input
            id="av-kontakt-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={CONTACT_MAX.email}
            placeholder="namn@adress.se"
            className={styles.avField}
          />
        </div>
      </div>

      <div className={styles.avFormField}>
        <label className={styles.avFieldLabel} htmlFor="av-kontakt-message">
          meddelande
        </label>
        <textarea
          id="av-kontakt-message"
          name="message"
          rows={4}
          required
          maxLength={CONTACT_MAX.message}
          placeholder="vi läser allt, långsamt men noggrant"
          className={styles.avTextarea}
        />
      </div>

      {state.phase === 'error' ? (
        <p role="alert" className={styles.avFormError}>
          {state.message}
        </p>
      ) : null}

      <AvKontaktSubmit />
    </form>
  )
}
