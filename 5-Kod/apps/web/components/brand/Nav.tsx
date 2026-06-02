import Link from 'next/link'
import { Logo } from './Logo'
import { NAV_LINKS } from './NavLinks'
import { BookCta } from './BookCta'
import { NavShell } from './NavShell'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { NavProps } from './types'
import shell from './nav-shell.module.css'

/**
 * The ONE themed storefront nav. A single flat 3-zone grid — [links] [wordmark]
 * [account + Boka] — whose visual layout flexes purely off the `[data-theme]`
 * ancestor in nav-shell.module.css:
 *   • default (salvia / zigge / linnea / edit): wordmark left, links + cluster right.
 *   • leander: wordmark centered (grid-column 2), links left, cluster right.
 *   • zigge: uppercase letterspaced links + CTA (text-transform only).
 *
 * No A/B/C variant prop and no theme prop: the three call sites
 * ((public)/layout, boka/layout, avboka/[id]/page) each set data-theme on the
 * wrapper, so this renders correctly at all of them without passing anything.
 * Wrapped in NavShell for the sticky transparent-over-hero → solid-on-scroll
 * behaviour (Salvia only) + the mobile burger / overlay menu.
 */
export function Nav({
  customerAccountsEnabled,
  utilityText,
  ...props
}: NavProps & { utilityText?: string }) {
  return (
    <NavShell customerAccountsEnabled={customerAccountsEnabled} utilityText={utilityText}>
      <header className={shell.navThemed}>
        {/* DOM order = wordmark (home) → links → cluster (logical reading order);
            visual column placement is handled per-theme by CSS grid-column. */}
        <Link href="/" className={shell.navWordmark} aria-label={props.tenant.name}>
          <Logo {...props} />
        </Link>

        <nav className={shell.navLinks} aria-label="Huvudmeny">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={shell.navCluster}>
          {/* G12: storefront customer login — only when the owner enabled it. */}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          <BookCta className={shell.navBook} />
        </div>
      </header>
    </NavShell>
  )
}
