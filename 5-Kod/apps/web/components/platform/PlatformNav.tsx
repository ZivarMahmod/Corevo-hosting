'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './platform.module.css'

// G12: clean back-office URLs on booking.corevo.se. The dashboard is served at
// `/` (middleware rewrites it to the internal `/platform` route), so the nav and
// its active-state compare against the browser-visible paths.
const LINKS = [
  { href: '/', label: 'Översikt' },
  { href: '/salonger', label: 'Salonger' },
  { href: '/fakturering', label: 'Fakturering' },
]

export function PlatformNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`${styles.navLink}${active ? ` ${styles.navLinkActive}` : ''}`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
