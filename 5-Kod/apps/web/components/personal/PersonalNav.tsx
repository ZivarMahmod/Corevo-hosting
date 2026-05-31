'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './personal.module.css'

const LINKS = [
  { href: '/personal', label: 'Idag' },
  { href: '/personal/arbetstider', label: 'Arbetstider' },
  { href: '/personal/franvaro', label: 'Frånvaro' },
]

export function PersonalNav() {
  const pathname = usePathname()
  return (
    <nav className={styles.nav}>
      {LINKS.map((l) => {
        const active = l.href === '/personal' ? pathname === '/personal' : pathname.startsWith(l.href)
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
