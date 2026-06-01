import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import type { NavProps } from './types'
import styles from './brand.module.css'

/** Nav variant C — sticky, translucent (frosted) bar: logo left, links grouped
 *  inside a single pill in the centre/right, gold "Boka tid" far right.
 *  Structurally distinct from A (centered column) and B (split row + accent rule). */
export function NavC({ customerAccountsEnabled, ...props }: NavProps) {
  return (
    <header className={`nav ${styles.navC}`}>
      <div className={`nav-inner ${styles.navCInner}`}>
        <Link href="/" className="nav-logo">
          <Logo {...props} />
        </Link>
        <div className={styles.navCLinks}>
          <NavLinks />
        </div>
        <div className={styles.navCActions}>
          {/* G12: storefront customer login — only when the owner enabled it. */}
          {customerAccountsEnabled ? (
            <Link href="/login" className={styles.navCAccount}>
              Logga in
            </Link>
          ) : null}
          <BookCta />
        </div>
      </div>
    </header>
  )
}
