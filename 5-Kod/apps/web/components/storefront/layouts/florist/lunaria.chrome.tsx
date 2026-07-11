import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — chrome (goal-59 tema-paket). POETISK NATTBLÅ.
 *
 * NAV = SIDO-RAIL-KÄNSLA. Wordmarket är STORT (28px display) till vänster, och menyn
 * står i en KOLUMN — inte en rad — direkt till höger om det, som en rail lagd på sidan.
 * Länkarna är högerställda mikroversaler med en tunn silverlinje (1px --color-line) som
 * löper längs kolumnens vänsterkant; hela huvudet avslutas av en hårlinje mot innehållet.
 * Kluster (korg · konto · CTA) längst till höger, vertikalt centrerat mot kolumnen.
 * Ingen syskonmall har en vertikal länkkolumn i sidhuvudet.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobil-burger,
 * overlay, fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster/navWordmark
 * på elementen), ALLA modul-gatade `links` ritas, korgen ritas när shopen är live,
 * kontolänken när kundkonton är på, huvud-CTA:n är bransch-CTA:n eller boknings-drawern.
 * utilityText ritas av NavShells egen UtilityBar — mallen dubblerar den inte.
 *
 * FOOTER = NATTBLÅ PLATTA MED STJÄRN-ORNAMENT. En mörk (--color-primary-d) helbredds-
 * platta: stjärnan högst upp, ett stort wordmark under den, taglinen — sedan tre smala
 * kolumner (Besök oss · Öppettider · Meny) i ljus text, och en avslutande hårlinje-rad
 * med copyright + social. Render-on-present: saknas adress/tider/kontakt/social ritas
 * blocket inte alls (aldrig påhittad adress).
 */
export function LunariaNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.lnNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.lnNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      {/* Menyn som KOLUMN — silverlinjen sitter på kolumnens vänsterkant. */}
      <nav className={`${shell.navLinks} ${styles.lnNavRail}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.lnNavCluster}`}>
        {p.cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={`btn-accent ${styles.lnCta}`}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.lnCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

/** Stjärn-ornamentet — sidfotens signatur (fyrspetsig, tunn). */
function StarOrnament() {
  return (
    <svg
      className={styles.lnFootStar}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <path d="M14 0c.9 7.2 6 12.2 14 14-8 1.8-13.1 6.8-14 14-.9-7.2-6-12.2-14-14 8-1.8 13.1-6.8 14-14Z" fill="currentColor" />
    </svg>
  )
}

export function LunariaFooter(p: ThemeFooterProps) {
  const hours = p.location?.hours ?? null
  const socials = [
    p.social.instagram ? { href: p.social.instagram, label: 'Instagram' } : null,
    p.social.facebook ? { href: p.social.facebook, label: 'Facebook' } : null,
    p.social.tiktok ? { href: p.social.tiktok, label: 'TikTok' } : null,
  ].filter((s): s is { href: string; label: string } => s !== null)
  const hasVisit = !!p.location?.address || !!p.contact.phone || !!p.contact.email

  return (
    <footer className={styles.lnFoot}>
      <div className={styles.lnFootInner}>
        <div className={styles.lnFootTop}>
          <StarOrnament />
          <div className={styles.lnFootMark}>{p.tenant.name}</div>
          <p className={styles.lnFootTagline}>{p.tagline}</p>
        </div>

        <div className={styles.lnFootCols}>
          {hasVisit ? (
            <div className={styles.lnFootCol}>
              <h4 className={styles.lnFootHead}>Besök oss</h4>
              {p.location?.address ? <p className={styles.lnFootText}>{p.location.address}</p> : null}
              {p.contact.phone ? (
                <p className={styles.lnFootText}>
                  <a href={`tel:${p.contact.phone.replace(/\s+/g, '')}`}>{p.contact.phone}</a>
                </p>
              ) : null}
              {p.contact.email ? (
                <p className={styles.lnFootText}>
                  <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a>
                </p>
              ) : null}
            </div>
          ) : null}

          {hours ? (
            <div className={styles.lnFootCol}>
              <h4 className={styles.lnFootHead}>Öppettider</h4>
              {hours.map((h) => (
                <div key={h.day} className={styles.lnFootHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.lnFootCol}>
            <h4 className={styles.lnFootHead}>Meny</h4>
            <nav className={styles.lnFootLinks} aria-label="Sidfotsmeny">
              {p.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className={styles.lnFootBottom}>
          <span>
            © {new Date().getFullYear()} {p.tenant.name}
          </span>
          {socials.length > 0 ? (
            <span className={styles.lnFootSocial}>
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener">
                  {s.label}
                </a>
              ))}
            </span>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
