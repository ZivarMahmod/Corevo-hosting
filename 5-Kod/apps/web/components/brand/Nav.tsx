import Link from 'next/link'
import { Logo } from './Logo'
import { NAV_LINKS } from './NavLinks'
import { BookCta } from './BookCta'
import { NavShell } from './NavShell'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
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
  cartEnabled,
  utilityText,
  links,
  primaryCta,
  ...props
}: NavProps & {
  utilityText?: string
  links?: readonly { href: string; label: string }[]
  /** goal-55 7B: shop-modul på → korg-ikon i klustret + korg-rad i mobil-overlayn.
      Kräver att navens call site är omsluten av CartProvider (useCart). */
  cartEnabled?: boolean
  /** goal-55 8A: bransch-styrd huvud-CTA (t.ex. "Beställ blommor" → /shop).
      Layouten skickar ENDAST en färdig, modul-gatad cta — null/undefined =
      dagens BookCta ('Boka tid' + drawer) exakt som förr. */
  primaryCta?: { label: string; href: string } | null
}) {
  // Modulstyrd meny: layouten skickar länkar som växer med kundens live-moduler
  // (Butik/Blogg får plats när modulerna är på); utan prop = de fyra klassiska.
  const navLinks = links ?? NAV_LINKS
  return (
    <NavShell
      customerAccountsEnabled={customerAccountsEnabled}
      cartEnabled={cartEnabled}
      utilityText={utilityText}
      links={navLinks}
      primaryCta={primaryCta}
    >
      <header className={shell.navThemed}>
        {/* DOM order = wordmark (home) → links → cluster (logical reading order);
            visual column placement is handled per-theme by CSS grid-column. */}
        <Link href="/" className={shell.navWordmark} aria-label={props.tenant.name}>
          <Logo {...props} />
        </Link>

        <nav className={shell.navLinks} aria-label="Huvudmeny">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={shell.navCluster}>
          {/* goal-55 7B: alltid synlig korg-ikon när shop-modulen är på
              (badge först vid count > 0). Länkar till /varukorg (goal-57). */}
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {/* G12: storefront customer login — only when the owner enabled it. */}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {/* goal-55 8A: bransch-styrd huvud-CTA — vanlig länk med samma pill-klass
              när branschen pekar bort från /boka; annars BookCta (drawer) som förr. */}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${shell.navBook}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={shell.navBook} label={primaryCta?.label} />
          )}
        </div>
      </header>
    </NavShell>
  )
}
