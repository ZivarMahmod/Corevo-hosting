import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens: wordmarket i 28px Lora italic till vänster (gemener — det ÄR
 * mallens röst), menyn centrerad i en rad, och längst ut TVÅ handlingar: den kursiva
 * hårlinje-korgen ("korgen (0)") och den fyllda terracotta-knappen "Boka tid". Ingen
 * ikonknapp, ingen pill — filen har varken.
 *
 * SIDFOTEN är filens: en blush-platta (surface), allt centrerat — ett stort kursivt
 * wordmark, adressraden, länkarna i en radbrytande rad, och copyright längst ner.
 * Inga kolumner. Render-on-present: saknas adress/kontakt skrivs bara det som finns.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function AuroraNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.auNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.auNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.auNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.auNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Korgen bär filens kursiva hårlinje-form, inte plattformens ikon. */}
        {p.cartEnabled ? <CartNavButton className={styles.auNavCart} /> : null}
        {p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.auNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.auNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function AuroraFooter(p: ThemeFooterProps) {
  // Filens adressrad: "blomsterstudio · Blomstergatan 4, Stockholm · 08-123 456 78".
  // Vi hittar ALDRIG på en adress — raden byggs av det tenanten faktiskt har.
  const meta = [p.tagline, p.location?.address, p.contact.phone].filter(Boolean).join(' · ')

  return (
    <footer className={styles.auFoot}>
      <p className={styles.auFootMark}>{p.tenant.name}</p>
      {meta ? <p className={styles.auFootMeta}>{meta}</p> : null}

      <nav className={styles.auFootNav} aria-label="Sidfotsmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <p className={styles.auFootLegal}>
        © {new Date().getFullYear()} {p.tenant.name} · Byggd med Corevo
      </p>
    </footer>
  )
}
