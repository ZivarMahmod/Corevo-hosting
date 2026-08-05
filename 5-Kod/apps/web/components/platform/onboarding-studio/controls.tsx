'use client'

// Onboarding-studio (goal-48) — shared presentational controls the 12 leaf panels
// reuse. Inline-styled against the [data-world="backoffice"] --c-* tokens. These are
// the onboardingstudions delade formulärkontroller.
import { useId, useState, type CSSProperties } from 'react'
import { type ModuleState } from '@/lib/tenant-modules'

/** Svenska etiketter per modul-läge; livscykeln ägs av tenant-modules. */
export const MODULE_STATE_LABELS: Record<ModuleState, string> = {
  off: 'Av',
  live: 'På',
}

const fieldLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
}

/**
 * Labelled text input (label fs12.5 / input fs14 / focus ring var(--c-forest)).
 * Focus is wired with a small `focused`
 * state because inline styles can't express `:focus`.
 */
export function Field({
  label,
  hint,
  error,
  ph,
  type = 'text',
  required = false,
  value,
  onChange,
}: {
  label: string
  hint?: string
  error?: string
  ph?: string
  type?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  const descriptionId = hint || error ? `${id}-description` : undefined
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label htmlFor={id} style={fieldLabel}>{label}</label>
      <input
        id={id}
        type={type}
        required={required}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={ph}
        autoCapitalize={type === 'email' ? 'none' : undefined}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '11px 13px',
          border: `1px solid ${focused ? 'var(--c-forest)' : 'var(--c-line)'}`,
          borderRadius: 10,
          background: 'var(--c-paper)',
          fontFamily: 'var(--font-ui)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
          color: 'var(--c-ink)',
        }}
      />
      {hint || error ? (
        <div
          id={descriptionId}
          role={error ? 'alert' : undefined}
          style={{ fontSize: 12, color: error ? 'var(--c-danger)' : 'var(--c-ink-3)', marginTop: 6 }}
        >
          {error ?? hint}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The off/live pill control for onboarding modules.
 * The active
 * pill is forest-bordered on paper-2, the rest muted. Pure presentational.
 */
export function ModuleStatePills({
  value,
  choices,
  onChange,
  label,
}: {
  value: ModuleState
  choices: ModuleState[]
  onChange: (state: ModuleState) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {choices.map((st) => {
        const on = value === st
        return (
          <button
            key={st}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(st)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              border: `1.5px solid ${on ? 'var(--c-forest)' : 'var(--c-line)'}`,
              background: on ? 'var(--c-paper-2)' : 'var(--c-paper)',
              color: on ? 'var(--c-ink)' : 'var(--c-ink-3)',
            }}
          >
            {MODULE_STATE_LABELS[st]}
          </button>
        )
      })}
    </div>
  )
}
