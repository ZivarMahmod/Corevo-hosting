'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './platform.module.css'

const LINKS = [
  { href: '/platform', label: 'Översikt' },
  { href: '/platform/tenants', label: 'Salonger' },
  { href: '/platform/fakturering', label: 'Fakturering' },
]

export function PlatformNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => {
        const active = l.href === '/platform' ? pathname === '/platform' : pathname.startsWith(l.href)
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
