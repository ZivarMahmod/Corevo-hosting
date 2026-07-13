'use client'

// ATELJÉ VINTER — FORMULÄR-ÖARNA (goal-64 regression, exakt kopia ur .dc.html).
//
// Mallen äger FORMEN, modulen äger FUNKTIONEN. De här 'use client'-öarna renderar
// filens egna fält (understruken hårlinje, transparent, gemena etiketter) och postar
// till EXAKT samma server-actions som de delade formulären — submitOffertRequest.
// Ingen validering, inget pending-läge, ingen fältkontrakt ändras; bara markupen är
// mallens.
//
// CLIENT/SERVER-STAKETET (kostade 18h en gång): den här filens importgraf når INGEN
// 'server-only'-modul. Den importerar bara: react; de PURA typerna i
// lib/storefront/offert/types (ingen I/O); och server-actionen (RPC-gräns via
// 'use server'). Lägg ALDRIG load-offert eller @/lib/supabase/* här.

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  offertCtaLabel,
  OFFERT_SUBMIT_INITIAL,
  type OffertMode,
  type OffertSubmitState,
} from '@/lib/storefront/offert/types'
import { submitOffertRequest } from '@/lib/storefront/offert/intake'
import styles from './ateljevinter.module.css'

/** Submit-knappen, nästlad så useFormStatus läser DET HÄR formulärets pending-läge.
 *  Filens knapp är den fyllda svarta (.avSolidWide) — gemener, spärrad 0.24em. */
function OffertSubmit({ mode }: { mode: OffertMode }) {
  const { pending } = useFormStatus()
  // Filens copy är gemen; offertCtaLabel ger "Skicka förfrågan" → mallen sänker den.
  const label = offertCtaLabel(mode).toLowerCase()
  return (
    <button type="submit" className={styles.avSolidWide} disabled={pending} aria-label={label}>
      {pending ? 'skickar…' : label}
    </button>
  )
}

/**
 * BESTÄLLNINGSVERK — filens `showOffert`. uppdragets art-chips (config.subjects),
 * namn + e-post i två spalter, beskrivning, och den fyllda knappen. Fälten är filens:
 * `border:none; border-bottom:1px solid #161616`, transparent, gemen etikett.
 *
 * Fältkontraktet är modulens (submitOffertRequest): name krävs, e-post ELLER telefon,
 * subject sparas för alla lägen, message krävs för allt utom callback. Filens
 * beställningsverk saknar telefonfält — därför samlar den e-post, och validering
 * (e-post eller telefon) uppfylls av e-posten.
 */
export function AteljeVinterOffertForm({
  mode,
  responseDays,
  subjects,
}: {
  mode: OffertMode
  responseDays: number
  subjects: string[]
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
      <p role="status" className={styles.avFormDone}>
        mottaget — vi återkommer inom {responseDays} {responseDays === 1 ? 'dag' : 'dagar'}.
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.avForm}>
      {hasChips ? (
        <fieldset className={styles.avFieldset}>
          <legend className={styles.avSubLabel}>uppdragets art</legend>
          <div className={styles.avChipRow}>
            {subjects.map((s) => (
              <label key={s} className={styles.avChip}>
                <input type="radio" name="subject" value={s} required className={styles.avChipInput} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className={styles.avFormRow}>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-offert-name">
            namn
          </label>
          <input
            id="av-offert-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            placeholder="för- och efternamn"
            className={styles.avField}
          />
        </div>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-offert-email">
            e-post
          </label>
          <input
            id="av-offert-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            placeholder="namn@adress.se"
            className={styles.avField}
          />
        </div>
      </div>

      {showSubject ? (
        <div className={styles.avFormField}>
          <label className={styles.avFieldLabel} htmlFor="av-offert-subject">
            vad gäller det?
          </label>
          <input
            id="av-offert-subject"
            name="subject"
            type="text"
            required
            maxLength={200}
            className={styles.avField}
          />
        </div>
      ) : null}

      {showMessage ? (
        <div className={styles.avFormField}>
          <label className={styles.avFieldLabel} htmlFor="av-offert-message">
            beskrivning
          </label>
          <textarea
            id="av-offert-message"
            name="message"
            rows={4}
            required
            maxLength={4000}
            placeholder="plats, datum, känsla, budget…"
            className={styles.avTextarea}
          />
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <p role="alert" className={styles.avFormError}>
          {state.message}
        </p>
      ) : null}

      <OffertSubmit mode={mode} />
    </form>
  )
}
