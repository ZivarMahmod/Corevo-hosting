import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import type { ThemeNavProps, ThemeFooterProps } from '../florist/types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './zentum.chrome.module.css'

/**
 * ZENTUM CHROME — overlay-header + blackish sidfot, portade ur den verifierade
 * statiska kopian (public/mallar/zentum/, cleanfin header-style-4).
 *
 * NAVET: transparent och absolut placerat ÖVER heron (bottenlinje 1px vit .2),
 * logga vänster · länkar · sök/CTA höger. Outline-pill-CTA (2px vit ram, hård
 * färgväxling vid hover). FUNKTIONEN är plattformens: markupen renderas som
 * children i NavShell (mobilmeny, fokusfälla, korg) — `shell.navThemed` MÅSTE
 * sitta kvar på <header>. ownsUtility: designen har ingen annonsrad alls, så
 * naven konsumerar medvetet inte utilityText.
 *
 * `links` är modulstyrda: väver zentum inga moduler blir det Hem/Tjänster/Om/
 * Kontakt — vilket är precis designens meny.
 */
export function ZentumNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.nav}`}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navLogo} aria-label={tenant.name}>
          <Logo tenant={tenant} branding={branding} />
        </Link>

        <nav className={styles.navLinks} aria-label="Huvudmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.navRight}>
          {cartEnabled ? (
            <CartNavButton className={`${shell.navAccount} ${styles.navIcon}`} />
          ) : null}
          {customerAccountsEnabled ? (
            <Link
              href="/login"
              className={`${shell.navAccount} ${styles.navIcon}`}
              aria-label="Logga in"
            >
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          <Link href={primaryCta?.href ?? '/kontakt'} className={styles.navCta}>
            {primaryCta?.label ?? 'Kontakta oss'}
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <line x1="5" y1="19" x2="19" y2="5" />
              <polyline points="9 5 19 5 19 15" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}

/**
 * FOOTER — blackish platta i tre kolumner (designens exakta uppsättning):
 * Kontakta oss (mejl) · Org. nummer / F-skattsedel · Våra tjänster (menyn).
 * Render-on-present: saknas mejlen ritas inget mejlblock.
 */
export function ZentumFooter({ tenant, tagline, location, contact, links }: ThemeFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerGrid}>
          <div>
            <h2 className={styles.footerHead}>Kontakta oss</h2>
            {contact.email ? (
              <p className={styles.footerText}>
                <a className={styles.footerMail} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </p>
            ) : null}
            {contact.phone ? (
              <p className={styles.footerText}>
                <a
                  className={styles.footerLink}
                  href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                >
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {location?.address ? <p className={styles.footerText}>{location.address}</p> : null}
          </div>

          <div>
            <h2 className={styles.footerHead}>Om byrån</h2>
            <p className={styles.footerText}>{tagline}</p>
            <p className={styles.footerText}>Innehar F-skattsedel</p>
          </div>

          <div>
            <h2 className={styles.footerHead}>Våra tjänster</h2>
            <ul className={styles.footerLinks}>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
