import type { ReactNode } from 'react'

/** Liten pill-knapp för status-toggles i tabellrader (goal-55 steg 1).
 *  Normerar Shop ActiveToggle / Blogg StatusToggle till EN stil (Blogg-pillen):
 *  aktiv handling färgas forest, passiv ink-2. Renderas gärna som type="submit"
 *  inne i ett server-action-<form> (Blogg-mönstret); default är "button". */
export function PillToggle({
  active,
  onClick,
  children,
  title,
  ariaLabel,
  type = 'button',
  disabled,
}: {
  /** Om det NUVARANDE läget är aktivt (styr aria-pressed + färg). */
  active: boolean
  onClick?: () => void
  children: ReactNode
  title?: string
  ariaLabel?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        border: '1px solid var(--c-line)',
        background: 'var(--c-paper)',
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        color: active ? 'var(--c-ink-2)' : 'var(--c-forest)',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
