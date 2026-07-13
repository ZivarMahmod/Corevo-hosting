import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './solsalt.module.css'

/**
 * SOL & SALT — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens: en KOBOLTBLÅ remsa, wordmarket i DM Serif 27px till vänster, menyn
 * CENTRERAD som transparenta pills (som blir terrakotta vid hover) och längst ut den solgula
 * korg-pillen ("Korg · 0"). Ingen hårlinje, ingen skugga — bara den blå ytan mot papperet.
 *
 * SIDFOTEN är filens: samma koboltplatta, wordmark + adressrad till vänster, en rad pills i
 * mitten (den första solgul, resten ram-pills) och copyright till höger.
 *
 * ownsUtility: filens gula annonsremsa ligger på HEMMET (under heron), inte ovanför navet.
 * Layouten ritar den ur `utilityText`/content.utility, så NavShell hoppar över sin egen — annars
 * hade samma mening stått två gånger på startsidan.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny, fokusfälla,
 * scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade `links` ritas,
 * korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function SolSaltNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.slNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.slNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.slNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.slNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={styles.slNavAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens sidhuvud har EN handling längst ut: den solgula korg-pillen. Går shopen inte
            att nå faller vi tillbaka på plattformens huvud-CTA — annars hade mallen tappat
            vägen in i bokningen helt. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.slNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.slNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.slNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function SolSaltFooter(p: ThemeFooterProps) {
  // Render-on-present: saknas adressen skriver mallen bara taglinen — aldrig en påhittad gata.
  const sub = p.location?.address ? `${p.tagline} · ${p.location.address}` : p.tagline

  return (
    <footer className={styles.slFoot}>
      <div className={styles.slFootRow}>
        <div>
          <p className={styles.slFootMark}>{p.tenant.name}</p>
          <p className={styles.slFootTagline}>{sub}</p>
        </div>

        <nav className={styles.slFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <p className={styles.slFootMeta}>
          © {new Date().getFullYear()} {p.tenant.name} · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
