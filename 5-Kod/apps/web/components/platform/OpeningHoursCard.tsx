'use client'

import { useActionState } from 'react'
import { saveTenantOpeningHours, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

const DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'] as const

/**
 * Manuella öppettider (settings.opening_hours) — Zivar: "öppettider ska kunna ändras
 * under Kontakt". Utan egna tider härleds de ur personalens veckoscheman (som förut);
 * fyller du i här vinner de på hela sidan (Kontakt + footer). Töm alla fält och spara
 * för att gå tillbaka till scheman-härledda.
 */
export function OpeningHoursCard({
  tenantId,
  openingHours,
  onSaved,
  onFlash,
}: {
  tenantId: string
  /** Sparad manuell override (settings.opening_hours) — null = härleds ur scheman. */
  openingHours: { day: string; time: string }[] | null
  onSaved?: () => void
  onFlash?: (text: string) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantOpeningHours(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )
  const manual = !!openingHours && openingHours.length > 0
  const valueFor = (day: string) => openingHours?.find((r) => r.day === day)?.time ?? ''

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        Öppettider
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: manual ? 'var(--c-gold-600, #9c6f1f)' : 'var(--c-ink-3)', background: manual ? 'var(--c-gold-100, #f0e6ce)' : 'var(--c-paper-2)', border: manual ? '1px solid transparent' : '1px solid var(--c-line)', padding: '1px 6px', borderRadius: 999 }}>
          {manual ? 'Egna tider' : 'Härleds ur scheman'}
        </span>
        {onFlash ? (
          <button
            type="button"
            className={styles.btn}
            style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}
            onClick={() => onFlash('Öppettider')}
            title="Markerar öppettids-tabellen i previewen"
          >
            Visa var
          </button>
        ) : null}
      </p>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Skriv t.ex. <strong>10–19</strong> eller <strong>Stängt</strong>. Tomma dagar visas inte.
        Utan egna tider härleds tiderna automatiskt ur personalens veckoscheman
        (Personal-fliken). Töm alla fält och spara för att gå tillbaka till det.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {DAYS.map((day, i) => (
          <label key={day} className={styles.field}>
            <span>{day}</span>
            <input name={`hours_${i}`} defaultValue={valueFor(day)} placeholder={manual ? '' : 'härleds ur scheman'} />
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara öppettider'}
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
