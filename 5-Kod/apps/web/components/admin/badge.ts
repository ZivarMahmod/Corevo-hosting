import styles from './admin.module.css'

const STATUS_CLASS: Record<string, string | undefined> = {
  confirmed: styles.badgeConfirmed,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
  no_show: styles.badgeNo_show,
}

/** Combined `<span>` class for a booking-status badge. */
export function badgeClass(status: string): string {
  const base = styles.badge ?? ''
  const variant = STATUS_CLASS[status]
  return variant ? `${base} ${variant}` : base
}
