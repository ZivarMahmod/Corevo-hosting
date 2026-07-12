import { Icon, type IconName } from './Icon'
import s from './portal-ui.module.css'

/** Transparent ikon-knapp för tabellernas sista kolumn (KursAdmin-mönstret,
 *  goal-55 steg 1). Alltid med aria-label — ikonen ensam bär ingen text.
 *  goal-61: stil i portal-ui.module.css (hover/fokus/tryck var omöjliga inline);
 *  aria-label blir också synlig tooltip via data-tip (portal-global.css). */
export function RowEditButton({
  onClick,
  ariaLabel,
  icon = 'edit',
  disabled,
}: {
  onClick: () => void
  ariaLabel: string
  icon?: IconName
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-tip={disabled ? undefined : ariaLabel}
      className={s.rowBtn}
    >
      <Icon name={icon} size={17} />
    </button>
  )
}
