import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import { NavShell } from './NavShell'
import type { NavProps } from './types'

/** Nav variant B — Atelier: split row, uppercase links, accent rule, square.
 *  Wrapped in NavShell for sticky transparent-over-hero + mobile menu. */
export function NavB({ customerAccountsEnabled, ...props }: NavProps) {
  return (
    <NavShell variant="B" customerAccountsEnabled={customerAccountsEnabled}>
      <header className="nav nav-b">
        <div className="nav-inner nav-b-inner">
          <Link href="/" className="nav-logo">
            <Logo {...props} />
          </Link>
          <div className="nav-b-row">
            <NavLinks />
            {/* G12: storefront customer login — only when the owner enabled it. */}
            {customerAccountsEnabled ? (
              <Link href="/login" className="nav-account">
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
