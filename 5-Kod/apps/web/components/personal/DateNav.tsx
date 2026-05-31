import Link from 'next/link'
import { addDays, mondayOf } from '@/lib/personal/format'
import styles from './personal.module.css'

/** Prev/today/next + dag/vecka toggle for the calendar, as plain links (no JS). */
export function DateNav({
  dateStr,
  view,
  today,
}: {
  dateStr: string
  view: 'dag' | 'vecka'
  today: string
}) {
  const step = view === 'vecka' ? 7 : 1
  const anchor = view === 'vecka' ? mondayOf(dateStr) : dateStr
  const mk = (d: string, v: string) => `/personal?date=${d}&view=${v}`

  return (
    <div className={styles.dateNav}>
      <Link href={mk(addDays(anchor, -step), view)}>← Föregående</Link>
      <Link href={mk(today, view)}>Idag</Link>
      <Link href={mk(addDays(anchor, step), view)}>Nästa →</Link>
      <span className={styles.dateNavSpacer} />
      <span className={styles.viewToggle}>
        <Link href={mk(dateStr, 'dag')} className={view === 'dag' ? styles.viewToggleActive : ''}>
          Dag
        </Link>{' '}
        <Link href={mk(dateStr, 'vecka')} className={view === 'vecka' ? styles.viewToggleActive : ''}>
          Vecka
        </Link>
      </span>
    </div>
  )
}
