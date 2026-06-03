'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { addTimeOff, type ActionState } from '@/lib/personal/actions'
import type { TimeOffRow } from '@/lib/personal/schedule'
import { Card, Button, Callout, Badge, useToast } from '@/components/portal/ui'
import { DeleteAbsenceButton } from './DeleteAbsenceButton'

/** Frånvaro-typer (mock §4.5 StaffAbsence). There is no `type` column on
 *  time_off — the chosen pill is written to the existing free-text `reason`
 *  field (the action accepts `reason`), so this is a pure UI selector over the
 *  real model, not a fabricated column. "Annat" reveals a free-text reason. */
const TYPES = ['Semester', 'Sjuk', 'Ledig dag', 'Annat'] as const
type AbsenceType = (typeof TYPES)[number]

type Upcoming = {
  row: TimeOffRow
  /** When-label (location tz). */
  when: string
  /** Type/reason text for the row. */
  kind: string
  /** True when the period covers "now" (real derived state, not an approval). */
  active: boolean
}

export function AbsencePanel({
  upcoming,
  timeZone,
}: {
  upcoming: Upcoming[]
  timeZone: string
}) {
  const [type, setType] = useState<AbsenceType>('Semester')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addTimeOff, {})
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  // Consequence toast (§4.10). Depend on the whole state OBJECT so two identical
  // successes still refire (a new object each submit), then reset the form.
  useEffect(() => {
    if (state.success) {
      notify('Frånvaro registrerad — tiderna stängs i boka-flödet', 'success')
      formRef.current?.reset()
      setType('Semester')
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, notify])

  return (
    <div>
      <Card>
        <h2 className="h2" style={{ marginBottom: 18 }}>
          Anmäl frånvaro
        </h2>

        <form ref={formRef} action={formAction}>
          {/* Type pills — the selected one is submitted as `reason` (or the
              free-text value when "Annat"). */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {TYPES.map((t) => {
              const on = type === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={on}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 999,
                    border: `1.5px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
                    background: on ? 'var(--c-forest)' : 'var(--c-paper)',
                    color: on ? 'var(--c-on-forest)' : 'var(--c-ink-2)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>

          {/* When "Annat", reason is the free-text input; otherwise the pill label. */}
          {type === 'Annat' ? (
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}>Orsak</span>
              <input
                name="reason"
                type="text"
                placeholder="Beskriv kort"
                style={fieldStyle}
              />
            </label>
          ) : (
            <input type="hidden" name="reason" value={type} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}>Från</span>
              {/* datetime-local: the frozen addTimeOff splits on 'T', so a bare
                  date would be rejected — keep the time component. */}
              <input name="start" type="datetime-local" required style={fieldStyle} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}>Till</span>
              <input name="end" type="datetime-local" required style={fieldStyle} />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <Callout tone="info" icon="info">
              Frånvaro stänger automatiskt dina bokbara tider på storefronten för perioden. Tider
              anges i salongens tidszon ({timeZone}).
            </Callout>
          </div>

          <Button variant="primary" icon="check" type="submit" disabled={pending} style={{ marginTop: 16 }}>
            {pending ? 'Skickar…' : 'Skicka anmälan'}
          </Button>
        </form>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <h2 className="h2" style={{ marginBottom: 6 }}>
          Kommande frånvaro
        </h2>
        {/* No approval workflow exists in the model (no Godkänd/Väntar) — so we
            honestly omit an approval status. The tone-coded badge reflects REAL
            derived state: pågår nu vs kommande. Add is immediate (the action
            inserts straight away), as shipped. */}
        {upcoming.length === 0 ? (
          <p className="small" style={{ margin: '8px 0 0', color: 'var(--c-ink-3)' }}>
            Ingen kommande frånvaro registrerad. Anmäl semester eller ledighet ovan så blockeras
            tiderna automatiskt i boka-flödet.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
            {upcoming.map(({ row, when, kind, active }, i) => (
              <li
                key={row.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  padding: '13px 0',
                  borderBottom: i < upcoming.length - 1 ? '1px solid var(--c-line)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="num" style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-ink)' }}>
                    {when}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2 }}>{kind}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                  <Badge tone={active ? 'gold' : 'info'}>{active ? 'Pågår nu' : 'Kommande'}</Badge>
                  <DeleteAbsenceButton id={row.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

const fieldStyle = {
  width: '100%',
  marginTop: 6,
  padding: '11px 13px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  color: 'var(--c-ink)',
  outline: 'none',
  boxSizing: 'border-box' as const,
}
