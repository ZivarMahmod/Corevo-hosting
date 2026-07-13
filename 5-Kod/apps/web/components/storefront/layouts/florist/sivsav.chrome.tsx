import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './sivsav.module.css'

/**
 * SIV & SÄV — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens: wordmark i Fraunces 23px till vänster, menyn CENTRERAD i en rad
 * med 28px mellanrum (salvia text, mörk vid hover) och längst ut den konturade pill-
 * etiketten "Korg · N" som fylls mörk vid hover. Ingen fylld CTA i huvudet — filen har
 * ingen. Genomskinligt varmvitt + blur(10px), ingen hårlinje under.
 *
 * SIDFOTEN är filens: en hårlinje, sedan EN rad — wordmark + adressrad till vänster,
 * länkar i mitten, "© byggd med Corevo" till höger. Inga kolumner, ingen tidtabell.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på. utilityText
 * ritas av NavShells egen UtilityBar — mallen dubblerar den inte.
 */
export function SivSavNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.ssNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.ssNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.ssNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.ssNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens enda handling i huvudet ÄR korg-pillen. Går shopen inte att nå faller vi
            tillbaka på plattformens huvud-CTA — annars tappar mallen vägen in i bokningen. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.ssNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.ssNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.ssNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function SivSavFooter(p: ThemeFooterProps) {
  // Render-on-present: saknas adressen skriver mallen bara taglinen — aldrig en påhittad
  // gata (filens rad är "Blomsterateljé · Norr Mälarstrand 18, Stockholm").
  const sub = p.location?.address ? `${p.tagline} · ${p.location.address}` : p.tagline

  return (
    <footer className={styles.ssFoot}>
      <div className={styles.ssFootRow}>
        <div>
          <p className={styles.ssFootMark}>{p.tenant.name}</p>
          <p className={styles.ssFootSub}>{sub}</p>
        </div>
        <nav className={styles.ssFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={styles.ssFootMeta}>
          © {new Date().getFullYear()} {p.tenant.name} · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
