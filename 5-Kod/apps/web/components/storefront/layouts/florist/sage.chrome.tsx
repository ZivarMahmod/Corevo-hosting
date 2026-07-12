import Link from 'next/link'
import { SocialButtons } from '../../SocialButtons'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './sage.module.css'

/**
 * SAGE — GALLERI-STUDIONS chrome (goal-59 tema-paket).
 *
 * NAV: ett symmetriskt tre-spårs galleri-huvud — länkarna i spärrade 11px-versaler
 * till VÄNSTER, wordmarket CENTRERAT som en utställningsskylt, korg/konto/CTA till
 * HÖGER. Ingen ram, ingen platta: naven ligger transparent ÖVER hero-fotot (NavShell
 * sätter .transparent så länge `.hero`-sentinelen är otouchad och sidan är i toppen)
 * och blir solid först vid scroll. Ingen av syskonmallarna har ett centrerat wordmark
 * med vänsterställda versal-länkar.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobil-burger,
 * overlay-meny, fokusfälla, scroll-skin), ALLA modul-gatade `links` ritas, korgen ritas
 * när shopen är live, kontolänken när kundkonton är på, och huvud-CTA:n är antingen
 * bransch-CTA:n (btn-accent) eller boknings-drawern (BookCta). utilityText ritas av
 * NavShells egen UtilityBar — mallen dubblerar den inte.
 *
 * FOOTER: en galleri-PLAKETT, inte tre kolumner. Allt ligger i EN centrerad kolumn av
 * hårlinje-separerade rader: wordmark i spärrade versaler → menyraden → en enda meta-rad
 * (adress · telefon · e-post · social) → öppettiderna som en inline-remsa → copyright.
 * Render-on-present: saknas adress/tider/kontakt/social ritas raden inte alls.
 */
export function SageNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.sgNav}`}>
      {/* Länkarna först i DOM (läsordning), wordmarket placeras i mitten av griden.
          Desktop-spåret bär MAX 6 länkar (goal-60): med alla moduler live blir listan 9,
          och nio spärrade versal-länkar + centrerat wordmark + korg + konto + pill-CTA
          får inte plats på en rad — galleri-huvudet bröt till en andra våning. NavShell
          får HELA `links` (mobil-overlayn) och plaketten i sidfoten listar allt. */}
      <nav className={`${shell.navLinks} ${styles.sgNavLinks}`} aria-label="Huvudmeny">
        {p.links.slice(0, 6).map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.sgNavWordmark}`}
        aria-label={p.tenant.name}
      >
        {/* Logo tar BrandTenant (id/slug används inte för wordmarket, bara name +
            branding.logo_url) — chrome-kontraktet bär bara namnet. */}
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <div className={`${shell.navCluster} ${styles.sgNavCluster}`}>
        {p.cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={`btn-accent ${styles.sgPillCta}`}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.sgPillCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function SageFooter(p: ThemeFooterProps) {
  const hours = p.location?.hours ?? null
  const socials = [
    p.social.instagram ? { href: p.social.instagram, label: 'Instagram' } : null,
    p.social.facebook ? { href: p.social.facebook, label: 'Facebook' } : null,
    p.social.tiktok ? { href: p.social.tiktok, label: 'TikTok' } : null,
  ].filter((s): s is { href: string; label: string } => s !== null)
  const hasMeta = !!p.location?.address || !!p.contact.phone || !!p.contact.email || socials.length > 0

  return (
    <footer className={styles.sgFoot}>
      <div className={styles.sgFootInner}>
        <div className={styles.sgFootMark}>{p.tenant.name}</div>
        <p className={styles.sgFootTagline}>{p.tagline}</p>

        <nav className={styles.sgFootLinks} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        {hasMeta ? (
          <p className={styles.sgFootMeta}>
            {p.location?.address ? <span>{p.location.address}</span> : null}
            {p.contact.phone ? (
              <a href={`tel:${p.contact.phone.replace(/\s+/g, '')}`}>{p.contact.phone}</a>
            ) : null}
            {p.contact.email ? <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a> : null}
            <SocialButtons links={socials} />
          </p>
        ) : null}

        {hours ? (
          <p className={styles.sgFootHours}>
            {hours.map((h) => (
              <span key={h.day}>
                <b>{h.day}</b> {h.time}
              </span>
            ))}
          </p>
        ) : null}

        <p className={styles.sgFootBottom}>
          © {new Date().getFullYear()} {p.tenant.name}
        </p>
      </div>
    </footer>
  )
}
