import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { SocialButtons, socialLinks } from '@/components/storefront/SocialButtons'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './kalla.module.css'

/**
 * KÄLLA — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens: wordmark i Marcellus med 0.32em spärr till vänster, menyn CENTRERAD
 * i mikroversal, och längst ut den fyllda teal-knappen "Varukorg (n)". Hårlinjen (#DAD3C2)
 * under huvudet är sidans enda avgränsning; bakgrunden är sanden, inte vitt.
 *
 * SIDFOTEN är filens: en djup teal-platta över hela bredden med wordmark + tagline till
 * vänster, pillerlänkarna i mitten (den första fylld ljus, resten konturade) och
 * copyright-raden till höger. Inga kolumner, ingen adressplatta.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på. En avstängd
 * modul finns aldrig i `links` → mallen kan inte länka till en sida som inte finns.
 */
export function KallaNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.kaNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.kaNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.kaNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.kaNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens sidhuvud slutar i "Varukorg (n)". Går shopen inte att nå faller vi tillbaka
            på huvud-CTA:n — annars hade mallen tappat vägen in i bokningen helt. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.kaNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.kaNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.kaNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function KallaFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.kaFoot}>
      <div className={styles.kaFootRow}>
        <div>
          <p className={styles.kaFootMark}>
            <span data-tenant-name data-corevo-editor-field="tenant.name"
              data-corevo-editor-stable-field="tenant.name">{p.tenant.name}</span>
          </p>
          <p className={styles.kaFootTagline} data-corevo-editor-field="tagline"
            data-corevo-editor-stable-field="tagline">{p.tagline}</p>
          <SocialButtons links={socialLinks(p.social, true)} editorStable />
        </div>
        <nav className={styles.kaFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={styles.kaFootMeta}>
          © {new Date().getFullYear()}{' '}
          <span data-tenant-name data-corevo-editor-field="tenant.name"
            data-corevo-editor-stable-field="tenant.name">{p.tenant.name}</span> · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
