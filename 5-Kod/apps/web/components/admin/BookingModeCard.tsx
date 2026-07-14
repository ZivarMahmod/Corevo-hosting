'use client'

import { useActionState } from 'react'
import { Card, Badge, Callout, Icon } from '@/components/portal/ui'
import {
  BOOKING_MODE_COPY,
  SWITCHABLE_MODES,
  type BookingMode,
} from '@/lib/admin/booking-mode'
import { setBookingMode, type BookingModeState } from '@/lib/admin/booking-mode-actions'

/** L3 C-03 — tre lägen, konsekvenstext i varje. Ett klick byter läge (inget
 *  "spara"-steg): varje läge ÄR en submit-knapp. Av visas men går inte att välja —
 *  DB-vakten (0026) gör off→på till en super-admin-övergång, så en Av-knapp här
 *  hade varit en enkelriktad fälla. Statusen bärs av text + ikon, aldrig av färg. */
export function BookingModeCard({ current }: { current: BookingMode }) {
  const [state, formAction, pending] = useActionState<BookingModeState, FormData>(
    setBookingMode,
    {},
  )
  const modes: BookingMode[] = ['pa', 'pausad', 'av']

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Bokning
        </h2>
        <Badge tone={current === 'pa' ? 'success' : current === 'pausad' ? 'warning' : 'neutral'}>
          {BOOKING_MODE_COPY[current].label}
        </Badge>
      </div>

      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {modes.map((mode) => {
          const isCurrent = mode === current
          const selectable = SWITCHABLE_MODES.includes(mode) && current !== 'av' && !isCurrent
          return (
            <button
              key={mode}
              type="submit"
              name="mode"
              value={mode}
              disabled={!selectable || pending}
              aria-current={isCurrent ? 'true' : undefined}
              style={{
                display: 'flex',
                gap: '0.7rem',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 12,
                border: `1px solid ${isCurrent ? 'var(--c-gold)' : 'var(--c-line)'}`,
                background: isCurrent ? 'var(--c-paper-2)' : 'transparent',
                cursor: selectable ? 'pointer' : 'default',
                opacity: !selectable && !isCurrent ? 0.55 : 1,
                color: 'inherit',
                font: 'inherit',
              }}
            >
              <Icon name={isCurrent ? 'checkCircle' : mode === 'pausad' ? 'pause' : mode === 'av' ? 'lock' : 'calendar'} size={18} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="h3" style={{ margin: 0 }}>
                  {BOOKING_MODE_COPY[mode].label}
                  {isCurrent ? ' — nuvarande läge' : ''}
                </span>
                <span className="body" style={{ margin: 0, color: 'var(--c-ink-2)' }}>
                  {BOOKING_MODE_COPY[mode].consequence}
                </span>
              </span>
            </button>
          )
        })}
      </form>

      {state.error ? (
        <Callout tone="warning" icon="alert">
          {state.error}
        </Callout>
      ) : null}
      {state.success ? (
        <Callout tone="success" icon="checkCircle">
          {state.success}
        </Callout>
      ) : null}
      {current === 'av' ? (
        <Callout tone="info" icon="info">
          Bokningen är avstängd för ditt konto. Kontakta Corevo för att slå på den igen.
        </Callout>
      ) : null}
    </Card>
  )
}
