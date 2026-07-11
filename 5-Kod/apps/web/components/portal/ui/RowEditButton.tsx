import { Icon, type IconName } from './Icon'

/** Transparent ikon-knapp för tabellernas sista kolumn (KursAdmin-mönstret,
 *  goal-55 steg 1). Alltid med aria-label — ikonen ensam bär ingen text. */
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
      style={{
        border: 'none',
        background: 'transparent',
        color: 'var(--c-ink-3)',
        cursor: disabled ? 'default' : 'pointer',
        padding: 4,
        display: 'inline-grid',
        placeItems: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon name={icon} size={17} />
    </button>
  )
}
