import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import type { NavProps } from './types'

/** Nav variant B — split row: logo left, uppercase links + CTA right, accent rule. */
export function NavB({ customerAccountsEnabled, ...props }: NavProps) {
  return (
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
  )
}
