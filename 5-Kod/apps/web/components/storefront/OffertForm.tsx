'use client'

// Offert storefront FORM — the interactive 'use client' island that replaces the
// inert shell in OffertSection. It posts an ANONYMOUS offert request via the
// submitOffertRequest server action (which resolves tenant + variant server-side).
//
// CLIENT/SERVER FENCE (cost 18h before): this file's OWN import graph must reach NO
// 'server-only' module. It imports ONLY: react; the PURE twin lib/storefront/offert/
// types (no I/O, no 'server-only'); and the server action — the action reference is
// the single thing that crosses to the server, and 'use server' makes that an RPC
// boundary, not an import of server code into the bundle. Do NOT add load-offert,
// @/lib/supabase/*, or any other server util here.
//
// goal-60: stilarna bor i storefront-form.module.css (delad med kurs-formuläret och
// kontaktformuläret). De låg tidigare i inline `style={{...FIELD_STYLE}}` — inline kan
// inte bära :focus/:hover/:user-invalid, och en mall kunde aldrig nå dem. Formulären
// var inte fula, de var omöjliga att göra fina. Ämnes-chipsen var systemradios i
// pillerramar; nu är de riktiga valytor (radion finns kvar i DOM:en för tangentbord,
// skärmläsare och formdata — bara den visuella prickens plats är tagen av chipet).

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  offertCtaLabel,
  OFFERT_SUBMIT_INITIAL,
  type OffertMode,
  type OffertSubmitState,
} from '@/lib/storefront/offert/types'
import { submitOffertRequest } from '@/lib/storefront/offert/intake'
import styles from './storefront-form.module.css'

/** Submit button. Nested so useFormStatus reads THIS form's pending state. Enabled
 *  (unlike the parked shell) — disabled only while the action is in flight. */
function SubmitButton({ mode }: { mode: OffertMode }) {
  const { pending } = useFormStatus()
  const label = offertCtaLabel(mode)
  return (
    <button type="submit" className={styles.submit} disabled={pending} aria-label={label}>
      {pending ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          Skickar…
        </>
      ) : (
        label
      )}
    </button>
  )
}

/** Variant-correct, wired offert form. Mirrors the section's field logic:
 *  name + email + phone always; subject ONLY for estimate_form; message textarea
 *  for every variant except callback. */
export function OffertForm({
  mode,
  responseDays,
  subjects = [],
}: {
  mode: OffertMode
  responseDays: number
  /** Config-styrda snabbval ("Vad gäller det?"-chips). Tom = fritext/inget ämne. */
  subjects?: string[]
}) {
  const [state, formAction] = useActionState<OffertSubmitState, FormData>(
    submitOffertRequest,
    OFFERT_SUBMIT_INITIAL,
  )

  const hasChips = subjects.length > 0
  const showSubject = mode === 'estimate_form' && !hasChips
  const showMessage = mode !== 'callback'

  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.done} style={{ marginTop: 28, maxWidth: 560 }}>
        Tack! Vi återkommer inom {responseDays} {responseDays === 1 ? 'dag' : 'dagar'}.
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.form} style={{ marginTop: 28 }}>
      {/* Ämnes-chips (config.subjects): ETT klick istället för fritext — kunden
          väljer vad det gäller (Bröllop/Begravning/…) innan uppgifterna. */}
      {hasChips ? (
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend className={styles.label}>Vad gäller det?</legend>
          <div className={styles.choiceRow}>
            {subjects.map((s) => (
              <label key={s} className={styles.choice}>
                <input
                  type="radio"
                  name="subject"
                  value={s}
                  required
                  className={styles.choiceInput}
                />
                <span className={styles.choiceText}>{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className={styles.row}>
        <div>
          <label className={styles.label} htmlFor="offert-name">
            Namn
          </label>
          <input
            id="offert-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            className={styles.field}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor="offert-email">
            E-post
          </label>
          <input
            id="offert-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={160}
            className={styles.field}
          />
        </div>
      </div>

      <div>
        <label className={styles.label} htmlFor="offert-phone">
          Telefon
        </label>
        <input
          id="offert-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className={styles.field}
        />
      </div>

      {showSubject ? (
        <div>
          <label className={styles.label} htmlFor="offert-subject">
            Vad gäller det?
          </label>
          <input
            id="offert-subject"
            name="subject"
            type="text"
            required
            maxLength={200}
            className={styles.field}
          />
        </div>
      ) : null}

      {showMessage ? (
        <div>
          <label className={styles.label} htmlFor="offert-message">
            {showSubject ? 'Beskriv omfattning' : 'Beskriv ditt behov'}
          </label>
          <textarea
            id="offert-message"
            name="message"
            rows={4}
            required
            maxLength={4000}
            className={`${styles.field} ${styles.textarea}`}
          />
        </div>
      ) : null}

      <div>
        {state.phase === 'error' ? (
          <p role="alert" className={styles.error} style={{ marginBottom: 12 }}>
            {state.message}
          </p>
        ) : null}
        <SubmitButton mode={mode} />
      </div>
    </form>
  )
}
