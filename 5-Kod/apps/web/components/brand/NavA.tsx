import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import { NavShell } from './NavShell'
import type { NavProps } from './types'

/** Nav variant A — Salong: centered logo + links/CTA, soft & airy. Wrapped in
 *  NavShell for sticky transparent-over-hero → solid-on-scroll + mobile menu. */
export function NavA({ customerAccountsEnabled, ...props }: NavProps) {
  return (
    <NavShell variant="A" customerAccountsEnabled={customerAccountsEnabled}>
      <header className="nav nav-a">
        <div className="nav-inner nav-a-inner">
          <Link href="/" className="nav-logo">
            <Logo {...props} />
          </Link>
          <div className="nav-a-row">
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
