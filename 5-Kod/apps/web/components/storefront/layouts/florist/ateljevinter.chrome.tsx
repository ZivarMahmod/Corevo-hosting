import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './ateljevinter.module.css'

/**
 * ATELJÉ VINTER — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens: wordmark i spärrad mikroversal till vänster, meny högerställd i en
 * rad med 16px mellanrum, och längst ut den INRAMADE korg-etiketten ("korg — 0") som fylls
 * svart vid hover. Ingen fylld CTA-knapp — mallen har ingen. Hårlinjen under huvudet är
 * sidans enda avgränsning.
 *
 * SIDFOTEN är filens: hårlinje, sedan en enda rad — wordmark · länkar · "© byggd med corevo".
 * Inga kolumner, ingen adressplatta. Mallen säger mindre än sina syskon, med avsikt.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
/**
 * Filens nav-etiketter (manifestets `verbatim`-lista): mallen döper om plattformens
 * modul-gatade länkar till sin egen redaktionella röst — "samlingen" i stället för
 * "Butik", "seminarier" i stället för "Kurser". VIKTIGT: vi döper bara OM de länkar
 * plattformen redan gett oss (de är modul-gatade), vi hittar aldrig på nya — annars
 * återuppstår 404-fällan (en länk till en modul som inte är live). Okänd href faller
 * tillbaka på plattformens etikett i gemener, så mallens grammatik håller ändå.
 */
const AV_NAV_LABELS: Record<string, string> = {
  '/': 'hem',
  '/shop': 'samlingen',
  '/boka': 'besök',
  '/tjanster': 'tjänster',
  '/kurser': 'seminarier',
  '/galleri': 'arkivet',
  '/blogg': 'anteckningar',
  '/offert': 'beställningsverk',
  '/presentkort': 'gåvobrev',
  '/klubb': 'vänkretsen',
  '/team': 'team',
  '/om': 'ateljén',
  '/kontakt': 'kontakt',
}

function avNavLabel(link: { href: string; label: string }): string {
  return AV_NAV_LABELS[link.href] ?? link.label.toLowerCase()
}

export function AteljeVinterNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.avNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.avNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.avNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {avNavLabel(l)}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.avNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens sidhuvud HAR ingen egen CTA-knapp — korg-etiketten är dess enda handling.
            Går shopen inte att nå faller vi tillbaka på plattformens huvud-CTA, annars
            hade mallen tappat vägen in i bokningen helt. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.avNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.avNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.avNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function AteljeVinterFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.avFoot}>
      <div className={styles.avFootRule} />
      <div className={styles.avFootRow}>
        <p className={styles.avFootMark}>{p.tenant.name}</p>
        <nav className={styles.avFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {avNavLabel(l)}
            </Link>
          ))}
        </nav>
        <p className={styles.avFootMeta}>
          © {new Date().getFullYear()} · byggd med corevo
        </p>
      </div>
    </footer>
  )
}
