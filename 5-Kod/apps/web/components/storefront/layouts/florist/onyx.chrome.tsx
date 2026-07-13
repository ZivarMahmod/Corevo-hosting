import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './onyx.module.css'

/**
 * ONYX — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens vänsterrail: svart yta, hårlinje mot innehållet, wordmark i
 * spärrad 24px med en MÄSSINGSPRICK efter namnet, menyposterna i Space Grotesk 14.5px
 * som tänds mot #1C1C1C vid hover, och längst ut den inramade mässingsetiketten
 * "KASSE [n]" som fylls med mässing och vänder texten svart.
 *
 * AVVIKELSE (medveten): filen sätter railen i en 224px-spalt (position:sticky, hela
 * skärmhöjden). Plattformens NavShell är en FIXERAD toppremsa över hela bredden — den
 * är gemensam för mobilmeny, fokusfälla, korg och kundkonto, och en mall får aldrig
 * byta ut FUNKTIONEN. Railens FORM (svart, hårlinje, mono, mässingsram, pricken) flyttar
 * därför upp i toppraden. navHeight (68/56px) kommer ur manifestet och bor i theme.ts.
 *
 * SIDFOTEN är filens: en enda rad över en hårlinje — ONYX. · © 2026 … BYGGD MED COREVO ·
 * länk i mässing längst till höger.
 */
export function OnyxNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.onNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.onNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.onNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.onNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Railens enda handling är KASSE-etiketten. Går shopen inte att nå faller vi
            tillbaka på plattformens huvud-CTA, annars tappar mallen vägen in i bokningen. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.onNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.onNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.onNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function OnyxFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.onFoot}>
      <p className={styles.onFootMark}>
        {p.tenant.name}
        <span className={styles.onDot}>.</span>
      </p>
      <nav className={styles.onFootNav} aria-label="Sidfotsmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <p className={styles.onFootMeta}>
        © {new Date().getFullYear()} {p.tenant.name.toUpperCase()}
        {p.location?.address ? ` · ${p.location.address.toUpperCase()}` : ''} · BYGGD MED COREVO
      </p>
    </footer>
  )
}
