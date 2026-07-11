import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './paisley.module.css'

/**
 * PAISLEY — TEMA-PAKETETS CHROME (goal-59). Mallen är en TIDNING, och en tidning
 * har ett tryckt sidhuvud, inte en app-nav:
 *
 *   RAD 1  topprad ("kiosk-remsan"): leveransområde till vänster, utility-texten
 *          till höger — mikroversaler, hårlinje under.
 *   RAD 2  masthead: skript-wordmarket CENTRERAT (tidningens namn), med
 *          funktionsklustret (korg · konto · huvud-CTA) infälld i högermarginalen.
 *   RAD 3  menyrad: ALLA modul-gatade länkar i spärrade versaler, hårlinjer över
 *          och under → ett tryckt "innehållsband".
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-beteende), header bär shell.navThemed, korgen renderas när
 * cartEnabled, kontolänken när customerAccountsEnabled, och primaryCta blir en
 * riktig länk när branschen pekar bort från /boka — annars boknings-drawern.
 */
export function PaisleyNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
  utilityText,
}: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.paNav}`}>
      {/* RAD 1 — kiosk-remsan */}
      <div className={styles.paNavStrip}>
        <span className={styles.paNavStripZone}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22s7-7.4 7-12.6A7 7 0 0 0 5 9.4C5 14.6 12 22 12 22Z" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="9.4" r="2.4" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Lokal leverans &amp; hämtning i butik
        </span>
        {utilityText ? <span className={styles.paNavStripUtil}>{utilityText}</span> : null}
      </div>

      {/* RAD 2 — masthead: centrerat wordmark, kluster i högermarginalen */}
      <div className={styles.paNavMast}>
        <Link href="/" className={`${shell.navWordmark} ${styles.paNavWordmark}`} aria-label={tenant.name}>
          <Logo tenant={tenant} branding={branding} />
        </Link>
        <div className={`${shell.navCluster} ${styles.paNavCluster}`}>
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.paSquareCta} ${styles.paNavCta}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={`${styles.paSquareCta} ${styles.paNavCta}`} label={primaryCta?.label} />
          )}
        </div>
      </div>

      {/* RAD 3 — innehållsbandet: ALLA modul-gatade länkar */}
      <nav className={`${shell.navLinks} ${styles.paNavMenu}`} aria-label="Huvudmeny">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.paNavLink}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

/**
 * PAISLEY-SIDFOT = tidningens KOLOFON. Ingen mjuk 3-kolumns-vy: en mörk tegelplatta
 * med en tryckt "utgivningsruta" — enormt wordmark + tagline till vänster, tre smala
 * kolofon-kolumner (Redaktion/Besök oss · Öppettider · Innehåll) till höger, och en
 * avslutande impressum-rad. Render-on-present: saknas adress/telefon/mejl/tider ritas
 * inget alls (aldrig påhittad kontaktuppgift).
 */
export function PaisleyFooter({ tenant, tagline, location, contact, social, links }: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const socials = [
    social.instagram ? { href: social.instagram, label: 'Instagram' } : null,
    social.facebook ? { href: social.facebook, label: 'Facebook' } : null,
    social.tiktok ? { href: social.tiktok, label: 'TikTok' } : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <footer className={styles.paFoot}>
      <div className={styles.paFootGrid}>
        <div className={styles.paFootMast}>
          <p className={styles.paFootWordmark}>{tenant.name}</p>
          <p className={styles.paFootTagline}>{tagline}</p>
          {socials.length > 0 ? (
            <ul className={styles.paFootSocial}>
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer noopener" className={styles.paFootLink}>
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.paFootCols}>
          {location?.address || contact.phone || contact.email ? (
            <div>
              <p className={styles.paFootHead}>Besök oss</p>
              {location?.address ? <p className={styles.paFootText}>{location.address}</p> : null}
              {contact.phone ? (
                <p className={styles.paFootText}>
                  <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.paFootLink}>
                    {contact.phone}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p className={styles.paFootText}>
                  <a href={`mailto:${contact.email}`} className={styles.paFootLink}>
                    {contact.email}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}

          {hours && hours.length > 0 ? (
            <div>
              <p className={styles.paFootHead}>Öppettider</p>
              {hours.map((h) => (
                <p key={h.day} className={styles.paFootHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </p>
              ))}
            </div>
          ) : null}

          <div>
            <p className={styles.paFootHead}>Innehåll</p>
            <ul className={styles.paFootNav}>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={styles.paFootLink}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.paFootRule} aria-hidden="true" />
      <div className={styles.paFootImpressum}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
        <span>Utgiven i {location?.address?.split(',').slice(-1)[0]?.trim() || 'butiken'}</span>
      </div>
    </footer>
  )
}
