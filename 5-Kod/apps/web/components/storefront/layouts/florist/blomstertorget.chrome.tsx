import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './blomstertorget.module.css'

/**
 * BLOMSTERTORGET — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * MASTHEADEN är filens, i tre våningar:
 *   1. Kickerraden — "Grundad 1962 · Hötorget" (utilityText) till vänster, "Korg (n)" i rött
 *      till höger, avslutad av en 1px svart linje.
 *   2. Namnvinjetten — wordmarket centrerat i 72px Archivo 900 VERSALER.
 *   3. Menyraden — mellan en 3px och en 1px linje, länkarna centrerade och åtskilda av "•".
 * Mallen ritar sin EGEN kickerrad ur `utilityText`, därför ownsUtility: true i theme.ts —
 * annars hade NavShell staplat sin UtilityBar ovanpå och tidningen fått två remsor.
 *
 * SIDFOTEN är filens: 3px-linje, sedan EN rad — wordmark · länkar · "© … Byggd med Corevo".
 * Inga kolumner, ingen adressplatta; tidningen upprepar sig inte.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navWordmark/navLinks/navCluster), ALLA
 * modul-gatade `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function BlomstertorgetNav(p: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får aldrig tas bort).
    // .btNav (dubblad i CSS:en) skriver om dess 3-zons-grid till tidningens tre våningar.
    <header className={`${shell.navThemed} ${styles.btNav}`}>
      <div className={styles.btMastTop}>
        <p className={styles.btMastMeta}>{p.utilityText}</p>
        <div className={`${shell.navCluster} ${styles.btMastCluster}`}>
          {p.customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {/* Filens masthead HAR ingen fylld CTA — "Korg (n)" är dess enda handling.
              Går shopen inte att nå faller vi tillbaka på plattformens huvud-CTA, annars
              hade tidningen tappat vägen in i bokningen helt. */}
          {p.cartEnabled ? (
            <CartNavButton className={styles.btMastCta} />
          ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
            <Link href={p.primaryCta.href} className={styles.btMastCta}>
              {p.primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.btMastCta} label={p.primaryCta?.label} />
          )}
        </div>
      </div>

      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.btMastMark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.btNavRow}`} aria-label="Huvudmeny">
        {p.links.map((l, i) => (
          <span key={l.href} className={styles.btNavItem}>
            <Link href={l.href}>{l.label}</Link>
            {i < p.links.length - 1 ? (
              <span className={styles.btSep} aria-hidden="true">
                •
              </span>
            ) : null}
          </span>
        ))}
      </nav>
    </header>
  )
}

export function BlomstertorgetFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.btFoot}>
      <div className={styles.btFootRow}>
        <p className={styles.btFootMark}>{p.tenant.name}</p>
        <nav className={styles.btFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={styles.btFootMeta}>
          © {new Date().getFullYear()}
          {p.location?.address ? ` · ${p.location.address}` : ''} · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
