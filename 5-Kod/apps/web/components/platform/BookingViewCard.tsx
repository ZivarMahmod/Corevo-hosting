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
 * Boknings-vy — bor i SIDA-fliken (flyttad från Drift, Zivars önskan): det här ÄR en
 * del av hur kundens publika sida ser ut, inte drift. Eget kort + egen thin action
 * (saveTenantBookingView) så den inte drar med sig salongsnamn/recensionslänk.
 */
export function BookingViewCard({
  tenantId,
  bookingVariant,
}: {
  tenantId: string
  bookingVariant: BookingVariant
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTenantBookingView, {})

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
