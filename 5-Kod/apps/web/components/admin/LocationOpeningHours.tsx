'use client'

import { useActionState, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { LocationOpeningHourRow } from '@/lib/admin/schedule-data'
import {
  saveLocationBookingSettings,
  type ActionState,
} from '@/lib/admin/schedule-actions'
import { Badge, Button, Callout, Card, Icon, useToast } from '@/components/portal/ui'

const DAYS = [
  { weekday: 1, name: 'Måndag' },
  { weekday: 2, name: 'Tisdag' },
  { weekday: 3, name: 'Onsdag' },
  { weekday: 4, name: 'Torsdag' },
  { weekday: 5, name: 'Fredag' },
  { weekday: 6, name: 'Lördag' },
  { weekday: 0, name: 'Söndag' },
] as const

type Segment = {
  key: string
  weekday: number
  start: string
  end: string
}

export type LocationBookingSettings = {
  id: string
  name: string
  slotStepMin: number
  minNoticeMin: number
  maxAdvanceDays: number
}

function hm(value: string) {
  return value.slice(0, 5)
}

/** Platsens ram ligger före personalens schema i tillgänglighetskedjan. Delade
 *  pass bevaras som separata intervall så en verklig lunchlucka aldrig öppnas. */
export function LocationOpeningHours({
  location,
  rows,
}: {
  location: LocationBookingSettings
  rows: LocationOpeningHourRow[]
}) {
  const router = useRouter()
  const { notify } = useToast()
  const nextKey = useRef(0)
  const [segments, setSegments] = useState<Segment[]>(() =>
    rows.map((row) => ({
      key: row.id,
      weekday: row.weekday,
      start: hm(row.start_time),
      end: hm(row.end_time),
    })),
  )
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveLocationBookingSettings,
    {},
  )
  const lastHandled = useRef(state)

  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, notify, router])

  const imported = rows.length === 0 || rows.some((row) => !row.confirmed_at)
  const addSegment = (weekday: number) => {
    nextKey.current += 1
    setSegments((current) => [
      ...current,
      {
        key: `new-${weekday}-${nextKey.current}`,
        weekday,
        start: '',
        end: '',
      },
    ])
  }
  const updateSegment = (key: string, field: 'start' | 'end', value: string) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.key === key ? { ...segment, [field]: value } : segment,
      ),
    )
  }
  const removeSegment = (key: string) => {
    setSegments((current) => current.filter((segment) => segment.key !== key))
  }

  return (
    <section style={{ marginBottom: '2.25rem' }} aria-labelledby="location-hours-title">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
            Bokningsram
          </span>
          <h2 id="location-hours-title" className="h2" style={{ margin: '6px 0 0' }}>
            Platsens öppettider
          </h2>
          <p className="small" style={{ margin: '4px 0 0', maxWidth: 620, color: 'var(--c-ink-3)' }}>
            Här anger du när platsen kan ta bokningar. Personalens arbetstider längre ner
            måste också rymma tiden.
          </p>
        </div>
        <Badge tone={imported ? 'gold' : 'success'}>{location.name}</Badge>
      </div>

      {imported && (
        <div style={{ marginBottom: 12 }}>
          <Callout tone="warning" icon="info">
            <strong>Importerade tider.</strong> Kontrollera dem och spara en gång för att
            bekräfta att de är platsens riktiga öppettider. Ny personal publiceras inte från
            obekräftade tider.
          </Callout>
        </div>
      )}

      <Card>
        <form action={formAction}>
          <input type="hidden" name="location_id" value={location.id} />

          <div style={{ display: 'grid', gap: 2 }}>
            {DAYS.map(({ weekday, name: day }) => {
              const daySegments = segments.filter((segment) => segment.weekday === weekday)
              return (
                <div
                  key={day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '11px 0',
                    borderBottom: '1px solid var(--c-line)',
                  }}
                >
                  <strong
                    style={{
                      width: 88,
                      flex: '0 0 88px',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13.5,
                      color: 'var(--c-ink)',
                    }}
                  >
                    {day}
                  </strong>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: '1 1 360px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {daySegments.length === 0 ? (
                      <span className="small" style={{ color: 'var(--c-ink-3)', minWidth: 105 }}>
                        Stängt
                      </span>
                    ) : (
                      daySegments.map((segment, index) => (
                        <div
                          key={segment.key}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                        >
                          <input type="hidden" name="weekday" value={weekday} />
                          <input
                            type="time"
                            name="start_time"
                            value={segment.start}
                            required
                            aria-label={`${day}, pass ${index + 1}, öppnar`}
                            onChange={(event) =>
                              updateSegment(segment.key, 'start', event.target.value)
                            }
                            style={timeInputStyle}
                          />
                          <span aria-hidden="true" style={{ color: 'var(--c-ink-3)' }}>
                            –
                          </span>
                          <input
                            type="time"
                            name="end_time"
                            value={segment.end}
                            required
                            aria-label={`${day}, pass ${index + 1}, stänger`}
                            onChange={(event) =>
                              updateSegment(segment.key, 'end', event.target.value)
                            }
                            style={timeInputStyle}
                          />
                          <button
                            type="button"
                            onClick={() => removeSegment(segment.key)}
                            aria-label={`Ta bort pass ${index + 1} på ${day}`}
                            style={removeStyle}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      ))
                    )}

                    {daySegments.length < 4 && (
                      <button
                        type="button"
                        onClick={() => addSegment(weekday)}
                        style={addStyle}
                        aria-label={`Lägg till öppet pass på ${day}`}
                      >
                        <Icon name="plus" size={14} /> Lägg till pass
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <fieldset
            style={{
              border: 0,
              padding: 0,
              margin: '20px 0 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <legend className="eyebrow" style={{ marginBottom: 10 }}>
              Bokningsregler
            </legend>
            <label style={fieldStyle}>
              <span>Tidsintervall</span>
              <select
                name="slot_step_min"
                defaultValue={location.slotStepMin}
                style={inputStyle}
              >
                {[5, 10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    Var {minutes}:e minut
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Minsta framförhållning (minuter)</span>
              <input
                type="number"
                name="min_notice_min"
                min={0}
                max={525600}
                step={15}
                defaultValue={location.minNoticeMin}
                required
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span>Bokningshorisont (dagar)</span>
              <input
                type="number"
                name="max_advance_days"
                min={1}
                max={1095}
                defaultValue={location.maxAdvanceDays}
                required
                style={inputStyle}
              />
            </label>
          </fieldset>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 18,
            }}
          >
            <p className="small" style={{ margin: 0, color: 'var(--c-ink-3)' }}>
              Dagar utan pass är stängda. Delade pass behåller luckan mellan tiderna.
            </p>
            <Button type="submit" variant="primary" icon="check" disabled={pending}>
              {pending ? 'Sparar…' : 'Spara och bekräfta'}
            </Button>
          </div>
          <p role="status" aria-live="polite" className="small" style={{ margin: '8px 0 0' }}>
            {state.error ?? state.success ?? ''}
          </p>
        </form>
      </Card>
    </section>
  )
}

const timeInputStyle: CSSProperties = {
  minHeight: 42,
  padding: '7px 9px',
  borderRadius: 9,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
}

const inputStyle: CSSProperties = {
  minHeight: 42,
  padding: '8px 10px',
  borderRadius: 9,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  color: 'var(--c-ink-3)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12.5,
}

const addStyle: CSSProperties = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 9px',
  border: '1px dashed var(--c-line-strong)',
  borderRadius: 9,
  background: 'transparent',
  color: 'var(--c-ink-2)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 12.5,
  fontWeight: 600,
}

const removeStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: 'inline-grid',
  placeItems: 'center',
  border: 0,
  borderRadius: 9,
  background: 'transparent',
  color: 'var(--c-ink-3)',
  cursor: 'pointer',
}
