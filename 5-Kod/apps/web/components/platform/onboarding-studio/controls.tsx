'use client'

// Onboarding-studio (goal-48) — shared presentational controls the 12 leaf panels
// reuse. Inline-styled against the [data-world="backoffice"] --c-* tokens (project
// convention: CreateTenantForm is 100% inline-styled, no *.module.css). These are the
// W1 "frozen" form primitives — lifted verbatim from CreateTenantForm's inline `Field`
// + module state-pills so the studio renders identically to the proven wizard.
import { useState, type CSSProperties } from 'react'
import { type ModuleState } from '@/lib/tenant-modules'

/** Svenska etiketter per modul-läge (mirror of CreateTenantForm's MODULE_STATE_LABELS
 *  — presentational only; the lifecycle itself lives in tenant-modules). */
export const MODULE_STATE_LABELS: Record<ModuleState, string> = {
  off: 'Av',
  draft: 'Utkast',
  live: 'Live',
  paused: 'Pausad',
}

const fieldLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
}

/**
 * Labelled text input (label fs12.5 / input fs14 / focus ring var(--c-forest)).
 * Lifted from CreateTenantForm's inline Field; focus is wired with a small `focused`
 * state because inline styles can't express `:focus`.
 */
export function Field({
  label,
  hint,
  ph,
  type = 'text',
  value,
  onChange,
}: {
  label: string
  hint?: string
  ph?: string
  type?: string
  value: string
  onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input
        type={type}
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
      {hint ? <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 6 }}>{hint}</div> : null}
    </div>
  )
}

/**
 * The off/draft/live/paused pill control (mirrors CreateTenantForm's module pills).
 * `choices` lets the caller restrict the set (booking → live/paused only); the active
 * pill is forest-bordered on paper-2, the rest muted. Pure presentational.
 */
export function ModuleStatePills({
  value,
  choices,
  onChange,
}: {
  value: ModuleState
  choices: ModuleState[]
  onChange: (state: ModuleState) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
