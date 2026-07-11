'use client'

// Kurs-ANMÄLNINGSFORMULÄR — the interactive 'use client' island per kurstillfälle
// on /kurser. Posts an ANONYMOUS registration via the submitEventRegistration
// server action (which resolves tenant + capacity server-side).
//
// CLIENT/SERVER FENCE (same as OffertForm): this file's OWN import graph must
// reach NO 'server-only' module. It imports ONLY: react; the PURE twin
// lib/storefront/kurser/types; and the server action (RPC boundary). Do NOT add
// load-kurser, @/lib/supabase/*, or any other server util here.
//
// goal-60: stilarna bor i storefront-form.module.css. De låg tidigare i inline
// `style={{...FIELD_STYLE}}`, vilket gjorde :focus, :hover och :user-invalid FYSISKT
// omöjliga — och en mall kunde aldrig nå dem. Formulären var inte fula, de var
// omöjliga att göra fina. Samma sjuka som köpknappen hade. Mallen sätter --sf-field-*
// i sitt [data-theme]-block; funktionen här rörs aldrig.

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { KURS_SUBMIT_INITIAL, type KursSubmitState } from '@/lib/storefront/kurser/types'
import { submitEventRegistration } from '@/app/(public)/kurser/actions'
import styles from './storefront-form.module.css'

/** Submit button. Nested so useFormStatus reads THIS form's pending state. */
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          Skickar…
        </>
      ) : (
        'Anmäl'
      )}
    </button>
  )
}

/** Anmälningsformulär för ETT kurstillfälle. maxParty <= 8, capped av "kvar". */
export function KursAnmalanForm({ eventId, maxParty }: { eventId: string; maxParty: number }) {
  const [state, formAction] = useActionState<KursSubmitState, FormData>(
    submitEventRegistration,
    KURS_SUBMIT_INITIAL,
  )

  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.done} style={{ marginTop: 18 }}>
        Tack! Du är anmäld — en bekräftelse skickas till din e-post.
      </p>
    )
  }

  const seats = Array.from({ length: Math.max(1, Math.min(8, maxParty)) }, (_, i) => i + 1)

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="event_id" value={eventId} />

      <div className={styles.row}>
        <div>
          <label className={styles.label} htmlFor={`kurs-name-${eventId}`}>
            Namn
          </label>
          <input
            id={`kurs-name-${eventId}`}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            className={styles.field}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`kurs-email-${eventId}`}>
            E-post
          </label>
          <input
            id={`kurs-email-${eventId}`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            className={styles.field}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label className={styles.label} htmlFor={`kurs-phone-${eventId}`}>
            Telefon (valfritt)
          </label>
          <input
            id={`kurs-phone-${eventId}`}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            className={styles.field}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`kurs-party-${eventId}`}>
            Antal platser
          </label>
          <select
            id={`kurs-party-${eventId}`}
            name="party_size"
            defaultValue="1"
            className={`${styles.field} ${styles.select}`}
          >
            {seats.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={styles.label} htmlFor={`kurs-message-${eventId}`}>
          Meddelande (valfritt)
        </label>
        <textarea
          id={`kurs-message-${eventId}`}
          name="message"
          rows={3}
          maxLength={2000}
          className={`${styles.field} ${styles.textarea}`}
        />
      </div>

      <div>
        {state.phase === 'error' ? (
          <p role="alert" className={styles.error} style={{ marginBottom: 12 }}>
            {state.message}
          </p>
        ) : null}
        <SubmitButton />
      </div>
    </form>
  )
}
