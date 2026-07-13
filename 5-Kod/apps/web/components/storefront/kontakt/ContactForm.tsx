'use client'

// KONTAKTFORMULÄRET — den interaktiva 'use client'-ön (goal-64).
//
// Alla 12 Claude Design-mallar ritar ett kontaktformulär, men INGEN ritar samma:
//   Aurora   → Namn | Telefon (bredvid varandra) + Meddelande · knapp "Skicka"
//   Calytrix → Namn · E-post · Meddelande · knapp "SKICKA"
//   Eloria   → Namn · E-post · "Tillfälle & datum" (→ subject) · "Ert meddelande"
//   Blomstertorget → insändaren: namn · e-post · "Skicka insändaren"
//   Lunaria  → "Sänd" · Onyx → "Mejl"/"SKICKA" · Ateljé Vinter → gemener genomgående
// Filen är LAG. Därför äger MALLEN fältuppsättningen, etiketterna, placeholders och
// knapptexten — de skickas in som props. Komponenten äger bara FUNKTIONEN (validering,
// server action, pending, fel, honeypot). Vektor-regeln, exakt som goal-60 satte den.
//
// CLIENT/SERVER-FENCE (kostade 18h en gång): den här filens importgraf får INTE nå en
// enda 'server-only'-modul. Den importerar bara react, den PURA twin-typen
// lib/storefront/kontakt/types (ingen I/O) och själva server-actionen — 'use server'
// gör den till en RPC-gräns, inte en import av serverkod in i klientbundlen.
//
// STILARNA bor i storefront-form.module.css (delad med offert- och kurs-formuläret).
// Mallen ger formuläret sin röst genom att sätta --sf-field-*/--sf-btn-*-variabler i
// sin egen scope — aldrig genom att bygga om fälten.

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  CONTACT_HONEYPOT,
  CONTACT_MAX,
  CONTACT_SUBMIT_INITIAL,
  type ContactField,
  type ContactSubmitState,
} from '@/lib/storefront/kontakt/types'
import { submitContactMessage } from '@/lib/storefront/kontakt/intake'
import styles from '../storefront-form.module.css'

/** Ett fält så som MALLEN vill ha det — etikett och placeholder lyfts verbatim ur .dc.html. */
export type ContactFieldSpec = {
  key: ContactField
  /** Mallens etikett. Utelämnad → ingen synlig etikett (flera mallar har bara placeholder);
   *  då bär placeholdern aria-label så fältet ändå är läsbart för skärmläsare. */
  label?: string
  placeholder?: string
  required?: boolean
  /** Bara för `message` — mallens rows (Aurora har 5). */
  rows?: number
}

/** HTML-input-typen per fält (message renderas som textarea). */
const INPUT_TYPE: Record<Exclude<ContactField, 'message'>, string> = {
  name: 'text',
  email: 'email',
  phone: 'tel',
  subject: 'text',
}

const AUTOCOMPLETE: Partial<Record<ContactField, string>> = {
  name: 'name',
  email: 'email',
  phone: 'tel',
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
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

function Field({ spec }: { spec: ContactFieldSpec }) {
  const id = `kontakt-${spec.key}`
  // Saknar mallen etikett måste placeholdern bära namnet — annars är fältet stumt
  // för en skärmläsare. Vi hittar aldrig på en synlig etikett mallen inte har.
  const a11y = spec.label ? undefined : (spec.placeholder ?? spec.key)

  return (
    <div>
      {spec.label ? (
        <label className={styles.label} htmlFor={id}>
          {spec.label}
        </label>
      ) : null}
      {spec.key === 'message' ? (
        <textarea
          id={id}
          name="message"
          rows={spec.rows ?? 5}
          required={spec.required ?? true}
          maxLength={CONTACT_MAX.message}
          placeholder={spec.placeholder}
          aria-label={a11y}
          className={`${styles.field} ${styles.textarea}`}
        />
      ) : (
        <input
          id={id}
          name={spec.key}
          type={INPUT_TYPE[spec.key]}
          autoComplete={AUTOCOMPLETE[spec.key]}
          required={spec.required ?? false}
          maxLength={CONTACT_MAX[spec.key]}
          placeholder={spec.placeholder}
          aria-label={a11y}
          className={styles.field}
        />
      )}
    </div>
  )
}

/**
 * Mallens kontaktformulär, kopplat till rälsen.
 *
 * @param rows  Fälten radvis — en inre array = en rad. Aurora lägger [namn, telefon] på
 *              samma rad; de flesta andra har en fält per rad. Speglar .dc.html:s grid.
 * @param submitLabel  Mallens EXAKTA knapptext ("Skicka" · "SKICKA" · "Sänd" ·
 *                     "Skicka insändaren" · "Skicka förfrågan" · "skicka").
 * @param doneText  Kvittensen efter lyckad insändning, i mallens röst.
 */
export function ContactForm({
  rows,
  submitLabel,
  doneText = 'Tack! Vi hör av oss så snart vi kan.',
}: {
  rows: ContactFieldSpec[][]
  submitLabel: string
  doneText?: string
}) {
  const [state, formAction] = useActionState<ContactSubmitState, FormData>(
    submitContactMessage,
    CONTACT_SUBMIT_INITIAL,
  )

  // Kvittensen ersätter formuläret — samma mönster som offert-formuläret. Boten som
  // fyllt honeypoten ser exakt det här (tyst avvisning), och lär sig ingenting.
  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.done}>
        {doneText}
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.form}>
      {/* HONEYPOT: osynlig för människor (dolt + aria-hidden + utanför tab-ordningen),
          oemotståndlig för en dum bot. Ifylld → servern låtsas att allt gick bra men
          skriver ingenting. Ingen autoComplete — annars kan webbläsaren fylla i den
          åt en riktig besökare och tysta hennes meddelande. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <input
          type="text"
          name={CONTACT_HONEYPOT}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {rows.map((row, i) =>
        row.length > 1 ? (
          <div key={i} className={styles.row}>
            {row.map((spec) => (
              <Field key={spec.key} spec={spec} />
            ))}
          </div>
        ) : row[0] ? (
          <Field key={row[0].key} spec={row[0]} />
        ) : null,
      )}

      <div>
        {state.phase === 'error' ? (
          <p role="alert" className={styles.error} style={{ marginBottom: 12 }}>
            {state.message}
          </p>
        ) : null}
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  )
}
