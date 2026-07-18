'use client'

import { useActionState } from 'react'
import { saveLegalSettings, type ActionState } from '@/lib/admin/actions'
import { Field, inputStyle } from '@/components/portal/ui'

/**
 * Kvitto- och villkorsuppgifter (goal-72 1c, plan 003): org-nr + momssats →
 * settings.legal. Bor under Inställningar → Betalning (kvittot är konsumenten).
 */
export function LegalSettingsCard({
  orgNr,
  vatRate,
}: {
  orgNr: string | null
  vatRate: number | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveLegalSettings, {})

  return (
    <form action={formAction} className="portal-card" style={{ display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15.5 }}>Kvitto &amp; villkor</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.75 }}>
          Organisationsnummer och moms visas på kvittomejlet och villkorssidan. Tomt fält =
          raden utelämnas.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <Field label="Organisationsnummer">
          <input
            name="org_nr"
            defaultValue={orgNr ?? ''}
            placeholder="556677-8899"
            autoComplete="off"
            spellCheck={false}
            style={inputStyle}
          />
        </Field>
        <Field label="Moms (%)">
          <input
            name="vat_rate"
            defaultValue={vatRate ?? ''}
            placeholder="25"
            inputMode="decimal"
            autoComplete="off"
            style={inputStyle}
          />
        </Field>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara'}
        </button>
        {state.error ? (
          <span role="alert" style={{ fontSize: 13, color: 'var(--c-danger, #b00020)' }}>
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span role="status" style={{ fontSize: 13, color: 'var(--c-success, #2e7d32)' }}>
            {state.success}
          </span>
        ) : null}
      </div>
    </form>
  )
}
