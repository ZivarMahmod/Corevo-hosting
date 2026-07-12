import Link from 'next/link'
import { SocialButtons } from '../../SocialButtons'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './wildthistle.module.css'

/**
 * WILD THISTLE — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * FORMEN är mallens, FUNKTIONEN är plattformens: markupen renderas som children
 * i NavShell (mobil-burger/overlay, fokusfälla, scroll-skinn), och `links` +
 * `primaryCta` kommer modul-gatade från (public)/layout.tsx — därför renderas
 * ALLA links, och korgen ALLTID när cartEnabled (annars försvinner kundens butik
 * ur menyn utan att någon märker det).
 *
 * NAV-STRUKTUR (ingen annan mall i sviten har den): EN RÅ RAD med en TJOCK
 * underlinje (4px ink) — ingen hårlinje, ingen sticky-elegans, ingen centrering.
 *   • wordmark VÄNSTER i tung serif (30px, inte en 24px-etikett)
 *   • menyn HÖGER i GEMENER (rått, inte versal-"elegant"), understruken på hover
 *   • klustret (korg · konto · CTA) längst ut till höger, fyrkantig fylld CTA
 * `utilityText` renderas INTE här: NavShell äger redan toppremsan (UtilityBar).
 */
export function WildThistleNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får ALDRIG tas bort).
    // .wtNav skriver om dess grid till mallens råa rad.
    <header className={`${shell.navThemed} ${styles.wtNav}`}>
      <Link href="/" className={styles.wtNavWordmark} aria-label={tenant.name}>
        {/* Logo tar BrandTenant men läser bara .name — id/slug är oanvända. */}
        <Logo tenant={{ id: '', name: tenant.name, slug: '' }} branding={branding} />
      </Link>

      {/* goal-60: desktopnavet bär max 6 länkar — 9 moduler-länkar + wordmark + korg
          + konto + CTA fick inte plats på raden och bröt till två våningar. NavShell
          får HELA `links` (mobil-overlayn); sidfoten listar allt. */}
      <nav className={styles.wtNavLinks} aria-label="Huvudmeny">
        {links.slice(0, 6).map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.wtNavCluster}>
        {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
        {customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {primaryCta && primaryCta.href !== '/boka' ? (
          <Link href={primaryCta.href} className={`btn-accent ${styles.wtInkCta}`}>
            {primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.wtInkCta} label={primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

/**
 * SIDFOT — RÅPAPPER med grov typografi: ett gigantiskt wordmark (hero-nivån, 84px)
 * överst mot papperssurfacen, en streckad linje, sedan tre spalter som en
 * fältanteckning: besök · öppettider · meny (i gemener). Ingen mörk platta, inga
 * ikoner — sociala länkar är TEXT (samma råa register som resten av mallen).
 *
 * Render-on-present: adress, telefon, mejl, tider och sociala länkar ritas BARA
 * när de finns — aldrig en påhittad adress, aldrig en död ikon.
 */
export function WildThistleFooter({
  tenant,
  tagline,
  location,
  contact,
  social,
  links,
}: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const socials = [
    { key: 'instagram' as const, href: social.instagram, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, label: 'Facebook' },
    { key: 'tiktok' as const, href: social.tiktok, label: 'TikTok' },
  ].filter((s) => !!s.href)
  const hasVisit = !!(location?.address || contact.phone || contact.email || socials.length > 0)

  return (
    <footer className={styles.wtFooter}>
      <div className={styles.wtFooterInner}>
        <p className={styles.wtFooterWordmark}>{tenant.name}</p>
        <p className={styles.wtFooterTagline}>{tagline}.</p>

        <div className={styles.wtFooterCols}>
          {hasVisit ? (
            <div>
              <h2 className={styles.wtFooterHead}>Besök oss</h2>
              {location?.address ? <p className={styles.wtFooterText}>{location.address}</p> : null}
              {contact.phone ? (
                <p className={styles.wtFooterText}>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.wtFooterLink}>
                    {contact.phone}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p className={styles.wtFooterText}>
                  <a href={`mailto:${contact.email}`} className={styles.wtFooterLink}>
                    {contact.email}
                  </a>
                </p>
              ) : null}
              {socials.length > 0 ? (
                <div className={styles.wtFooterSocials}>
                  <SocialButtons links={socials} />
                </div>
              ) : null}
            </div>
          ) : null}

          {hours ? (
            <div>
              <h2 className={styles.wtFooterHead}>Öppettider</h2>
              {hours.map((h) => (
                <div key={h.day} className={styles.wtFooterHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <h2 className={styles.wtFooterHead}>Meny</h2>
            <nav className={styles.wtFooterNav} aria-label="Sidfotsmeny">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className={styles.wtFooterLink}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className={styles.wtFooterBottom}>
        © {new Date().getFullYear()} {tenant.name}
      </div>
    </footer>
  )
}
