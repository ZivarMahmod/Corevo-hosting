'use client'

import { useActionState, useState } from 'react'
import { saveStorefrontCopy, type ActionState } from '@/lib/admin/actions'
import type { CopyFields } from '@/lib/admin/data'
import styles from './admin.module.css'

type Field = keyof CopyFields

const FIELDS: { name: Field; label: string; hint: string; multiline?: boolean }[] = [
  { name: 'heroEyebrow', label: 'Hero — eyebrow', hint: 'Liten överrad, t.ex. “— Din salong”.' },
  { name: 'heroTitle', label: 'Hero — rubrik', hint: 'Stora rubriken högst upp.', multiline: true },
  { name: 'heroLede', label: 'Hero — ingress', hint: 'Kort rad under rubriken.', multiline: true },
  { name: 'tagline', label: 'Tagline', hint: 'En mening som fångar känslan.' },
  { name: 'italic', label: 'Kursiv accent', hint: 'Kort kursiv fras (serif-accent).' },
  { name: 'aboutCopy', label: 'Om oss', hint: 'Stycket på Om-sidan / om-sektionen.', multiline: true },
]

/**
 * Owner editorial-copy editor (M6 §3.6). Writes settings.copy via the M2↔M6 copy
 * contract. Empty field = "use the theme default" — that IS the undo for a single
 * field. The placeholder shows the theme's default text so the owner sees what
 * renders when they leave a field blank. "Återställ" reverts every field to the
 * last saved values (client-side), so an unsaved edit can be abandoned.
 */
export function StorefrontCopyForm({
  copy,
  themeDefaults,
}: {
  copy: CopyFields
  themeDefaults: CopyFields
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveStorefrontCopy, {})
  const [values, setValues] = useState<CopyFields>(copy)

  const set = (name: Field, v: string) => setValues((prev) => ({ ...prev, [name]: v }))
  const dirty = FIELDS.some((f) => values[f.name] !== copy[f.name])

  return (
    <form action={formAction} className={`${styles.form} ${styles.formStacked}`}>
      {FIELDS.map((f) => (
        <label key={f.name} className={styles.field}>
          <span>{f.label}</span>
          {f.multiline ? (
            <textarea
              name={f.name}
              value={values[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={themeDefaults[f.name]}
              rows={2}
              maxLength={600}
            />
          ) : (
            <input
              name={f.name}
              value={values[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={themeDefaults[f.name]}
              maxLength={600}
            />
          )}
          <span className={styles.muted}>
            {f.hint} Lämna tomt för temats standardtext.
          </span>
        </label>
      ))}

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara texter'}
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={pending || !dirty}
          onClick={() => setValues(copy)}
        >
          Ångra ändringar
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
  )
}
