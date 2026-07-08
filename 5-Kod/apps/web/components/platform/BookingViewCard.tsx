'use client'

import { useActionState } from 'react'
import { saveTenantBookingView, type ActionState } from '@/lib/platform/actions'
import {
  BOOKING_VARIANTS,
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_DESCRIPTIONS,
  type BookingVariant,
} from '@/lib/platform/booking-variant'
import styles from './platform.module.css'

/**
 * Boknings-vy — bor i SIDA-fliken. ALLA FYRA vyerna renderar numera distinkt
 * (Zivar: "det ska finnas olika att välja mellan och de ska funka"):
 * wizard = steg i centrerad modal · drawer = steg i slide-over · compact =
 * snabbboka i slide-over · inline = inbyggd sektion längst ner på sidan.
 * Provkör: spara → klicka "Boka tid" i previewen.
 */

export function BookingViewCard({
  tenantId,
  bookingVariant,
  onSaved,
}: {
  tenantId: string
  bookingVariant: BookingVariant
  /** Ladda om previewen efter spar så valet kan provklickas direkt. */
  onSaved?: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantBookingView(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.templateGrid} role="radiogroup" aria-label="Boknings-vy">
        {BOOKING_VARIANTS.map((v) => (
          <label key={v} className={styles.templateCard} style={{ cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <input type="radio" name="booking_variant" value={v} defaultChecked={v === bookingVariant} />
              <span className={styles.templateName}>{BOOKING_VARIANT_LABELS[v]}</span>
            </span>
            <span className={styles.templateDesc}>{BOOKING_VARIANT_DESCRIPTIONS[v]}</span>
          </label>
        ))}
      </div>
      <p className={styles.hint} style={{ margin: 0 }}>
        Testa direkt: spara, klicka sedan <strong>Boka tid</strong> i previewen till höger —
        panelen som öppnas följer valet.
      </p>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara boknings-vy'}
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
