import Link from 'next/link'
import { Logo } from './Logo'
import { NavLinks } from './NavLinks'
import { BookCta } from './BookCta'
import type { BrandProps } from './types'

/** Nav variant A — centered: logo on top, links + CTA centered below. */
export function NavA(props: BrandProps) {
  return (
    <header className="nav nav-a">
      <div className="nav-inner nav-a-inner">
        <Link href="/" className="nav-logo">
          <Logo {...props} />
        </Link>
        <div className="nav-a-row">
          <NavLinks />
          <BookCta />
        </div>
      </div>
    </header>
  )
}
