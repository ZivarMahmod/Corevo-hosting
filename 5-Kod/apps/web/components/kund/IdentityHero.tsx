import type { KundBooking } from '@/lib/kund/bookings'
import styles from './account.module.css'

/**
 * Identity hero (§4.8): round avatar (first initial) on --color-primary, the
 * "VÄLKOMMEN TILLBAKA" eyebrow + display-font greeting ("Hej {firstName}") + an
 * italic teaser derived from the next upcoming booking ("Vi ses {when} hos
 * {staff} — {service}").
 *
 * firstName comes from auth user_metadata.full_name (the only person name a kund
 * account carries). When absent the greeting falls back to a generic
 * "Välkommen tillbaka" (no fabricated name). The teaser is omitted gracefully
 * when there is no upcoming booking.
 */
export function IdentityHero({
  firstName,
  next,
}: {
  firstName: string | null
  next: KundBooking | null
}) {
  const initial = (firstName ?? '').trim().charAt(0).toUpperCase() || '·'
  const greeting = firstName?.trim() ? `Hej ${firstName.trim()}` : 'Välkommen tillbaka'

  let teaser: string | null = null
  if (next) {
    const when = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: next.timeZone,
    }).format(new Date(next.startTs))
    const svc = (next.serviceName ?? 'din tid').toLowerCase()
    const who = next.staffTitle ? ` hos ${next.staffTitle}` : ''
    teaser = `Vi ses ${when}${who} — ${svc}.`
  }

  return (
    <section className={styles.hero}>
      <div className={styles.heroAvatar} aria-hidden>
        {initial}
      </div>
      <div className={styles.heroText}>
        <div className={styles.eyebrow}>Välkommen tillbaka</div>
        <h1 className={styles.greeting}>{greeting}</h1>
        {teaser ? <div className={styles.teaser}>{teaser}</div> : null}
      </div>
    </section>
  )
}
