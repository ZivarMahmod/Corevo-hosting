import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './siluett.module.css'

/**
 * SILUETT — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * MASTHEADET är filens: wordmark i Bodoni-versal till vänster, menyn CENTRERAD i en rad med
 * 22px mellanrum och 2px understruken aktiv post, och längst ut den fyllda bläckplattan
 * "Kasse (n)" som blir elviolett vid hover. Under huvudet en 2px bläcklinje — magasinets
 * enda avgränsning.
 *
 * SIDFOTEN är filens: bläcksvart platta, wordmark + taglinje till vänster, fyra länkar i
 * mitten (den första — klubben — i elviolett), och "© 2026 · Byggd med Corevo" till höger.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på. Mallen
 * bestämmer formen, aldrig funktionen.
 */
export function SiluettNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.siNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.siNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.siNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.siNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens enda huvud-handling är kassen. Går shopen inte att nå faller vi tillbaka
            på huvud-CTA:n — annars hade mallen tappat vägen in i bokningen helt. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.siNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.siNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.siNavCta} label={p.primaryCta?.label ?? 'Boka en stol'} />
        )}
      </div>
    </header>
  )
}

export function SiluettFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.siFoot}>
      <div className={styles.siFootRow}>
        <div>
          <p className={styles.siFootMark}>{p.tenant.name}</p>
          <p className={styles.siFootTagline}>
            {p.tagline}
            {p.location?.address ? ` · ${p.location.address}` : ''}
          </p>
        </div>
        <nav className={styles.siFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className={i === 0 ? styles.siFootNavAccent : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={styles.siFootMeta}>
          © {new Date().getFullYear()} {p.tenant.name} · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
