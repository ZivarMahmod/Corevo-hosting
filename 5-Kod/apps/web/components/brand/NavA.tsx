import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import type { NavProps } from './types'

/** Nav variant A — centered: logo on top, links + CTA centered below. */
export function NavA({ customerAccountsEnabled, ...props }: NavProps) {
  return (
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
  )
}
