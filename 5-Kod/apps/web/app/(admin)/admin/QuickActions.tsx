import Link from 'next/link'
import { Icon, type IconName } from '@/components/portal/ui'
import styles from './dashboard.module.css'

/**
 * Snabbåtgärder — the row of quick-action cards on the dashboard (Salong-admin
 * §4.7). Exact copy of the mock's QuickAction composition (38px tinted icon chip +
 * title + sub), but each card is a real navigation target (next/link) instead of
 * the prototype's onClick stubs — the dashboard's most-used jumps, always one click
 * away. The "Se din sida" card opens the PUBLIC storefront in a new tab, so it is a
 * plain anchor. Hover lift lives in the co-located CSS module (server-safe, reduced-
 * motion-guarded). Gold-toned tone = the single most-used action (Dagens bokningar).
 */
type QuickActionProps = {
  icon: IconName
  title: string
  sub: string
  href: string
  tone?: 'gold' | 'default'
  /** External (storefront) link → new tab. */
  external?: boolean
}

function Body({ icon, title, sub }: Pick<QuickActionProps, 'icon' | 'title' | 'sub'>) {
  return (
    <>
      <span className={styles.quickIcon}>
        <Icon name={icon} size={19} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.quickTitle}>{title}</div>
        <div className={styles.quickSub}>{sub}</div>
      </div>
    </>
  )
}

export function QuickAction({ icon, title, sub, href, tone = 'default', external }: QuickActionProps) {
  const cls = `${styles.quick}${tone === 'gold' ? ` ${styles.quickGold}` : ''}`
  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        <Body icon={icon} title={title} sub={sub} />
      </a>
    )
  }
  return (
    <Link className={cls} href={href}>
      <Body icon={icon} title={title} sub={sub} />
    </Link>
  )
}

export function QuickActions({ children }: { children: React.ReactNode }) {
  return <div className={styles.quickRow}>{children}</div>
}
