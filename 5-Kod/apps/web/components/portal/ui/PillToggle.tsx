import type { ReactNode } from 'react'
import s from './portal-ui.module.css'

/** Liten pill-knapp för status-toggles i tabellrader (goal-55 steg 1).
 *  Normerar Shop ActiveToggle / Blogg StatusToggle till EN stil (Blogg-pillen):
 *  aktiv handling färgas forest, passiv ink-2. Renderas gärna som type="submit"
 *  inne i ett server-action-<form> (Blogg-mönstret); default är "button".
 *  goal-61: stil i portal-ui.module.css — hover/fokus/tryck fanns inte inline,
 *  disabled tecknas med färg (inte bara opacity). */
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
      className={s.pill}
    >
      {children}
    </button>
  )
}
