import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import { NavShell } from './NavShell'
import type { NavProps } from './types'
import styles from './brand.module.css'

/** Nav variant C — Studio: logo left, links grouped in a single pill, gold
 *  "Boka tid" far right. Wrapped in NavShell for transparent-over-hero +
 *  mobile menu; keeps its frosted pill personality on top. */
export function NavC({ customerAccountsEnabled, ...props }: NavProps) {
  return (
    <NavShell variant="C" customerAccountsEnabled={customerAccountsEnabled}>
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
    </NavShell>
  )
}
