'use client'

import { useActionState } from 'react'
import { saveTenantBookingView, type ActionState } from '@/lib/platform/actions'
import {
  BOOKING_VARIANT_LABELS,
  BOOKING_VARIANT_DESCRIPTIONS,
  type BookingVariant,
} from '@/lib/platform/booking-variant'
import styles from './platform.module.css'

/**
 * Boknings-vy — bor i SIDA-fliken. Visar ENDAST de vyer som faktiskt renderar olika
 * (Zivar: "de olika vyerna funkar inte" — drawer/inline var design-val utan egen
 * presentation; de renderade identiskt med wizard och gjorde kortet till fyra knappar
 * där bara en gjorde skillnad). En sparad drawer/inline visas som Steg-för-steg
 * (exakt så renderas den). Provkör: spara → klicka "Boka tid" i previewen.
 */
const REAL_VARIANTS: BookingVariant[] = ['wizard', 'compact']

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
  // drawer/inline renderas som wizard → visa dem ärligt som det valet.
  const effective: BookingVariant = bookingVariant === 'compact' ? 'compact' : 'wizard'

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.templateGrid} role="radiogroup" aria-label="Boknings-vy">
        {REAL_VARIANTS.map((v) => (
          <label key={v} className={styles.templateCard} style={{ cursor: 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <input type="radio" name="booking_variant" value={v} defaultChecked={v === effective} />
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
