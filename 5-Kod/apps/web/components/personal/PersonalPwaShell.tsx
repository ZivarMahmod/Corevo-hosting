'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import styles from './personal-pwa.module.css'

export function PersonalPwaShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const profile = pathname !== '/personal'
  return (
    <div className={styles.stage} data-accept="personal-pwa">
      <main className={styles.app}>{children}</main>
      <nav className={styles.bottomNav} aria-label="Personal">
        <Link href="/personal" className={!profile ? styles.navActive : undefined}>
          <span>Kalender</span><i aria-hidden="true" />
        </Link>
        <Link href="/personal/profil" className={profile ? styles.navActive : undefined}>
          <span>Min profil</span><i aria-hidden="true" />
        </Link>
      </nav>
    </div>
  )
}
