'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  addStaffTimeOff,
  removeStaffTimeOff,
  type ActionState,
} from '@/lib/admin/schedule-actions'
import { Badge, Button, Card, Icon, useToast } from '@/components/portal/ui'

/**
 * Frånvaro-admin för HELA teamet — avvikelserna från veckoschemats mall.
 * Personalen kan redan anmäla sin egen frånvaro (/personal/franvaro); här får
 * ägaren samma kraft för alla, eftersom det i praktiken oftast är ägaren som
 * lägger in semestern. Samma sanningslager (time_off) → motorn stänger tiderna
 * identiskt oavsett vem som skrev raden.
 */

export type StaffOption = { id: string; name: string }

export type TimeOffItem = {
  id: string
  staffName: string
  /** Färdigformatterat intervall (tenantens tz) — servern äger all datum-matte. */
  rangeLabel: string
  reason: string | null
  /** True när perioden täcker "nu" (härlett läge, ingen godkännande-status finns). */
  ongoing: boolean
}

export function TimeOffManager({
  items,
  staffOptions,
  staffNoun,
}: {
  items: TimeOffItem[]
  staffOptions: StaffOption[]
  staffNoun: string
}) {
  const router = useRouter()
  return (
    <Card>
      <AddTimeOffForm staffOptions={staffOptions} staffNoun={staffNoun} onDone={() => router.refresh()} />

      {items.length === 0 ? (
        <p className="small" style={{ margin: '14px 0 0', color: 'var(--c-ink-3)' }}>
          <strong style={{ fontWeight: 600, color: 'var(--c-ink-2)' }}>
            Ingen kommande frånvaro.
          </strong>{' '}
          Lägg till semester eller ledighet ovan — tiderna stängs automatiskt i boka-flödet och
          syns som overlay i veckoöversikten.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: '14px 0 0',
            padding: 0,
            borderTop: '1px solid var(--c-line)',
          }}
        >
          {items.map((item) => (
            <TimeOffRowItem key={item.id} item={item} onDone={() => router.refresh()} />
          ))}
        </ul>
      )}
    </Card>
  )
}

// Inline-tillägg: medarbetare + från/till-datum + valfri orsak → addStaffTimeOff.
// Datumen är rena kalenderdagar (type="date") — heldags-tolkningen i tenantens tz
// görs av server-actionen, aldrig av klientens lokala tz.
function AddTimeOffForm({
  staffOptions,
  staffNoun,
  onDone,
}: {
  staffOptions: StaffOption[]
  staffNoun: string
  onDone: () => void
}) {
  const { notify } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addStaffTimeOff, {})

  // Vakta på resultat-OBJEKTET (inte strängen): två identiska succéer i rad ger
  // nya objekt men samma text — en sträng-dep skulle svälja andra toasten.
  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(state.success, 'success')
      formRef.current?.reset()
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, notify, onDone])

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--c-line)',
        background: 'var(--c-paper-2)',
      }}
    >
      <label style={fieldStyle}>
        <span>{staffNoun}</span>
        <select name="staff_id" defaultValue={staffOptions[0]?.id ?? ''} required style={inputStyle}>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Från (dag)</span>
        <input name="from" type="date" required style={inputStyle} />
      </label>
      <label style={fieldStyle}>
        <span>Till (dag, inkl.)</span>
        <input name="to" type="date" required style={inputStyle} />
      </label>
      <label style={{ ...fieldStyle, flex: '1 1 160px' }}>
        <span>Orsak (valfritt)</span>
        <input
          name="reason"
          type="text"
          placeholder="t.ex. Semester"
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
        />
      </label>
      <Button variant="ghost" size="sm" icon="plus" type="submit" disabled={pending}>
        {pending ? 'Sparar…' : 'Lägg till frånvaro'}
      </Button>
    </form>
  )
}

// Hårfin rad: namn + intervall + orsak till vänster, härledd status-badge +
// dämpad borttagning till höger — samma grammatik som arbetstids-listan.
function TimeOffRowItem({ item, onDone }: { item: TimeOffItem; onDone: () => void }) {
  const { notify } = useToast()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeStaffTimeOff, {})

  const lastHandled = useRef(state)
  useEffect(() => {
    if (state === lastHandled.current) return
    lastHandled.current = state
    if (state.success) {
      notify(state.success, 'success')
      onDone()
    } else if (state.error) {
      notify(state.error, 'warning')
    }
  }, [state, notify, onDone])

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '11px 2px',
        borderBottom: '1px solid var(--c-line)',
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            fontSize: 13.5,
            color: 'var(--c-ink)',
            flexWrap: 'wrap',
          }}
        >
          <Icon name="user" size={15} style={{ color: 'var(--c-ink-3)', flex: 'none' }} />
          <span style={{ fontWeight: 600 }}>{item.staffName}</span>
          <span className="num" style={{ color: 'var(--c-ink-2)' }}>
            {item.rangeLabel}
          </span>
        </span>
        {item.reason && (
          <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)', marginTop: 2, marginLeft: 24 }}>
            {item.reason}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <Badge tone={item.ongoing ? 'gold' : 'info'}>
          {item.ongoing ? 'Pågår nu' : 'Kommande'}
        </Badge>
        <form action={formAction} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            disabled={pending}
            aria-label={`Ta bort frånvaro för ${item.staffName} (${item.rangeLabel})`}
            title="Ta bort denna frånvaro"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: 'none',
              background: 'transparent',
              color: 'var(--c-ink-3)',
              cursor: pending ? 'default' : 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 12.5,
              fontWeight: 600,
              padding: '4px 6px',
            }}
          >
            <Icon name="trash" size={14} /> Ta bort
          </button>
        </form>
      </div>
    </li>
  )
}

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  fontSize: 12,
  color: 'var(--c-ink-3)',
  fontFamily: 'var(--font-ui)',
}

const inputStyle = {
  font: 'inherit' as const,
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '6px 9px',
  borderRadius: 8,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
}
