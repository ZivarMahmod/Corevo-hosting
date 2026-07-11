import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './mina.module.css'

/**
 * MINA — DTC-BUTIKENS chrome (goal-59 tema-paket).
 *
 * NAV: en butiksrad, inte ett "sidhuvud". Wordmark till VÄNSTER i stor Jost, sedan
 * INGENTING förrän längst till höger: menyn i mallens versala 12px-mikro-register,
 * korg/konto som ikoner och en fylld rosa pill-CTA. Platt vit remsa med EN hårlinje
 * i underkant — aldrig transparent över en hero (Mina har ingen hero-bild), aldrig
 * en utility-rad. Länkarna är komprimerade: de tre viktigaste bär full vikt, resten
 * kör i tunnare grad (`.miNavLinks a:nth-child(n+4)`), så raden läses som en butik
 * med ett par ingångar — men ALLA modul-gatade links renderas (butiken kan aldrig
 * försvinna ur menyn), och NavShells burger + overlay bär hela listan i mobil.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobil-burger,
 * overlay, fokusfälla, scroll-skin), korgen ritas när shopen är live, kontolänken när
 * kundkonton är på, och huvud-CTA:n är antingen bransch-CTA:n (btn-accent) eller
 * boknings-drawern (BookCta).
 *
 * FOOTER: EN RAD. Ingen tre-kolumners platta, inget stort wordmark-block — hela
 * sidfoten är en rosa remsa (--color-accent-soft) med wordmark + tagline vänster och
 * meny/kontakt/social som en enda inline-remsa höger, plus en tunn copyright-rad under.
 * Render-on-present: adress/tider/kontakt/social ritas bara när fälten finns.
 */
export function MinaNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.miNav}`}>
      <Link href="/" className={`${shell.navWordmark} ${styles.miNavMark}`} aria-label={p.tenant.name}>
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.miNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.miNavCluster}`}>
        {p.cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={`btn-accent ${styles.miNavCta}`}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.miNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function MinaFooter(p: ThemeFooterProps) {
  const hours = p.location?.hours ?? null
  const socials = [
    p.social.instagram ? { href: p.social.instagram, label: 'Instagram' } : null,
    p.social.facebook ? { href: p.social.facebook, label: 'Facebook' } : null,
    p.social.tiktok ? { href: p.social.tiktok, label: 'TikTok' } : null,
  ].filter((s): s is { href: string; label: string } => s !== null)

  return (
    <footer className={styles.miFoot}>
      <div className={styles.miFootRow}>
        <div className={styles.miFootBrand}>
          <span className={styles.miFootMark}>{p.tenant.name}</span>
          <span className={styles.miFootTagline}>{p.tagline}</span>
        </div>

        <nav className={styles.miFootLinks} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.miFootMeta}>
        {p.location?.address ? <span>{p.location.address}</span> : null}
        {hours ? <span>{hours.map((h) => `${h.day} ${h.time}`).join(' · ')}</span> : null}
        {p.contact.phone ? (
          <a href={`tel:${p.contact.phone.replace(/\s+/g, '')}`}>{p.contact.phone}</a>
        ) : null}
        {p.contact.email ? <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a> : null}
        {socials.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener">
            {s.label}
          </a>
        ))}
        <span className={styles.miFootCopy}>
          © {new Date().getFullYear()} {p.tenant.name}
        </span>
      </div>
    </footer>
  )
}
