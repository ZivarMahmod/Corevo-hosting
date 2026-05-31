import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import type { BrandProps } from './types'

/** Nav variant B — split row: logo left, uppercase links + CTA right, accent rule. */
export function NavB(props: BrandProps) {
  return (
    <header className="nav nav-b">
      <div className="nav-inner nav-b-inner">
        <Link href="/" className="nav-logo">
          <Logo {...props} />
        </Link>
        <div className="nav-b-row">
          <NavLinks />
          <BookCta />
        </div>
      </div>
    </header>
  )
}
