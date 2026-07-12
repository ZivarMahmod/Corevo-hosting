import Link from 'next/link'
import { SocialButtons } from '../../SocialButtons'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './isalara.module.css'

/**
 * ISALARA — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * FORMEN är mallens, FUNKTIONEN plattformens: markupen renderas som children i
 * NavShell (mobilmeny, fokusfälla, korg, konto, scroll-skinn) och `links`/
 * `primaryCta` kommer modul-gatade från (public)/layout.tsx — därför renderas
 * ALLA links, och korgen ALLTID när cartEnabled.
 *
 * NAV-STRUKTUR (ingen annan mall i sviten har den): en SOLID MARINBLÅ FULLBREDDS-
 * RAD, aldrig transparent, aldrig ljus. Syskonen ligger genomskinliga/ljusa över
 * sin hero; Isalara möter besökaren med kvällsblått från första pixeln. Wordmarket
 * står VÄNSTER i handskriven skript (mallens signatur, samma hand som hero-rubriken
 * och sidrubrikerna), menyn HÖGER i versal mikrotext, och längst till höger
 * funktionsklustret: korg · konto · CTA (ljus pill mot det blå).
 *
 * `utilityText` renderas INTE här: NavShell äger redan toppremsan (UtilityBar) och
 * skulle annars säga samma sak två gånger.
 */
export function IsalaraNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får ALDRIG tas bort).
    // .islNav (dubblad i CSS:en) skriver om dess grid till en fullbredds blå platta.
    <header className={`${shell.navThemed} ${styles.islNav}`}>
      <div className={styles.islNavInner}>
        <Link href="/" className={styles.islNavWordmark} aria-label={tenant.name}>
          {/* Logo tar BrandTenant men läser bara .name — id/slug är oanvända. */}
          <Logo tenant={{ id: '', name: tenant.name, slug: '' }} branding={branding} />
        </Link>

        {/* Desktop-navet bär MAX 6 länkar (goal-60). Med alla moduler live blir listan
            9, och nio versaler + wordmark + korg + konto + CTA fick inte plats på en
            rad — navet bröt till två våningar. NavShell får fortfarande HELA `links`
            (mobil-overlayn) och sidfoten listar allt, så inget blir oåtkomligt. */}
        <nav className={styles.islNavLinks} aria-label="Huvudmeny">
          {links.slice(0, 6).map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.islNavCluster}>
          {/* Korgen är modulens, inte mallens: shell.navAccount behålls (NavShell
              räknar på den) och mallens ljusa skinn läggs BREDVID. */}
          {cartEnabled ? (
            <CartNavButton className={`${shell.navAccount} ${styles.islNavIcon}`} />
          ) : null}
          {customerAccountsEnabled ? (
            <Link
              href="/login"
              className={`${shell.navAccount} ${styles.islNavIcon}`}
              aria-label="Logga in"
            >
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link
              href={primaryCta.href}
              className={`btn-accent ${styles.islBtn} ${styles.islBtnLight} ${styles.islNavBtn}`}
            >
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta
              className={`${styles.islBtn} ${styles.islBtnLight} ${styles.islNavBtn}`}
              label={primaryCta?.label}
            />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * SIDFOT — MARINBLÅ PLATTA med skript-wordmarket överst (sajtens signatur stänger
 * den, precis som den öppnade den), en hårlinje, och därunder TRE kolumner:
 * besök oss · öppettider · meny. Render-on-present: adress, telefon, mejl, tider
 * och sociala länkar ritas BARA när de finns — ingen påhittad adress, inga döda
 * ikoner.
 */
export function IsalaraFooter({
  tenant,
  tagline,
  location,
  contact,
  social,
  links,
}: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const hasVisit = !!(location?.address || contact.phone || contact.email)
  const socials = [
    { key: 'instagram' as const, href: social.instagram, icon: 'instagram' as const, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, icon: 'facebook' as const, label: 'Facebook' },
  ].filter((s) => !!s.href)

  return (
    <footer className={styles.islFooter}>
      <p className={styles.islFooterWordmark}>{tenant.name}</p>
      <p className={styles.islFooterTagline}>{tagline}.</p>

      <div className={styles.islFooterCols}>
        {hasVisit ? (
          <div>
            <h2 className={styles.islFooterHead}>Besök oss</h2>
            {location?.address ? (
              <p className={styles.islFooterText}>{location.address}</p>
            ) : null}
            {contact.phone ? (
              <p className={styles.islFooterText}>
                <a
                  href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                  className={styles.islFooterLink}
                >
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.islFooterText}>
                <a href={`mailto:${contact.email}`} className={styles.islFooterLink}>
                  {contact.email}
                </a>
              </p>
            ) : null}
            {socials.length > 0 ? (
              <div className={styles.islFooterSocials}>
                <SocialButtons links={socials} />
              </div>
            ) : null}
          </div>
        ) : null}

        {hours ? (
          <div>
            <h2 className={styles.islFooterHead}>Öppettider</h2>
            {hours.map((h) => (
              <div key={h.day} className={styles.islFooterHoursRow}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <h2 className={styles.islFooterHead}>Meny</h2>
          <nav className={styles.islFooterNav} aria-label="Sidfotsmeny">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={styles.islFooterLink}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className={styles.islFooterBottom}>
        © {new Date().getFullYear()} {tenant.name}
      </div>
    </footer>
  )
}
