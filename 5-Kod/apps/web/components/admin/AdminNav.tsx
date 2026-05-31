'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './admin.module.css'

const LINKS = [
  { href: '/admin', label: 'Översikt' },
  { href: '/admin/tjanster', label: 'Tjänster' },
  { href: '/admin/personal', label: 'Personal' },
  { href: '/admin/scheman', label: 'Scheman' },
  { href: '/admin/bokningar', label: 'Bokningar' },
  { href: '/admin/varumarke', label: 'Varumärke' },
  { href: '/admin/installningar', label: 'Inställningar' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => {
        const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href)
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
