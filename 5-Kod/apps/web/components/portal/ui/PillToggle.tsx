import type { ReactNode } from 'react'
import s from './portal-ui.module.css'

/** Pill-knappen är kund-adminens ENDA status-växel (goal-62 G3).
 *
 *  REGELN — normera på BETYDELSE, inte på widget:
 *   · binär synlighet (boolean `active`)  → mode="action", verben Dölj/Visa
 *   · publicerings-status (draft|published) → mode="action", Publicera/Avpublicera
 *   · fler-läges-status (t.ex. kurs open|cancelled|done) → mode="state", en pill
 *     per läge i en segmenterad grupp — aldrig en enda toggle, den kan inte
 *     uttrycka tre lägen.
 *  Ingen yta får bygga en egen switch. Tjänster gjorde det (en inline 42×24-switch
 *  med identisk semantik som Butiks pill) — skillnaden var historisk, inte
 *  betydelsebärande, och är riven.
 *
 *  A11Y — därför två lägen (buggen som fanns här):
 *   `aria-pressed` beskriver KNAPPENS eget tillstånd. Sattes den på en knapp vars
 *   etikett är HANDLINGEN blev det raka motsatsen till sanningen: en publicerad
 *   post fick <button aria-pressed="true">Avpublicera</button> → skärmläsaren läste
 *   "Avpublicera, intryckt". Därför:
 *    · mode="action" (etiketten = verbet)   → INGET aria-pressed. Knappen är en
 *      handlingsknapp; nuvarande läge bärs av ariaLabel + färgen (data-active) +
 *      Badgen bredvid.
 *    · mode="state"  (etiketten = tillståndet) → aria-pressed={active}. Där ÄR
 *      etiketten knappens tillstånd, och aria-pressed är korrekt.
 *
 *  Stil (44px-golv, hover/fokus/tryck, disabled via färg) bor i
 *  portal-ui.module.css — inline kan inte bära pseudoklasser.
 */
export function PillToggle({
  active,
  mode = 'action',
  onClick,
  children,
  title,
  ariaLabel,
  type = 'button',
  disabled,
}: {
  /** Om det NUVARANDE läget är aktivt/valt. Styr färgen alltid, aria-pressed bara i mode="state". */
  active: boolean
  /** "action" = etiketten är verbet (default). "state" = etiketten är tillståndet (segmenterad grupp). */
  mode?: 'action' | 'state'
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
      aria-pressed={mode === 'state' ? active : undefined}
      data-active={active ? 'true' : 'false'}
      data-mode={mode}
      className={s.pill}
    >
      {children}
    </button>
  )
}
