import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './calytrix.module.css'

/**
 * CALYTRIX CHROME (goal-59) — e-handelsbutikens ansikte, inte ateljéns.
 *
 * NAV: tre våningar i EN header — (1) smal vinröd annonsrad högst upp (utility-copyn
 * flyttad hit från hemmet, så den finns på VARJE sida precis som i en riktig butik),
 * (2) split-rad: länkar VÄNSTER · wordmark CENTRERAT · ikonkluster HÖGER. Ingen annan
 * florist-mall har annonsrad i navet.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll), alla modul-gatade `links` renderas, korgen renderas när shopen
 * lever, kontolänken när kundkonton är på, och huvud-CTA:n är antingen en riktig länk
 * (bransch-CTA) eller BookCta (boknings-drawern). `shell.navThemed` MÅSTE sitta kvar
 * på <header> — NavShells sticky/scroll-beteende hänger på den; mallens .calNav
 * (dubblad klass) skriver om formen ovanpå.
 */
export function CalytrixNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
  utilityText,
}: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.calNav}`}>
      {/* 1 — ANNONSRAD (vinröd, versal mikrotext) */}
      <div className={styles.calNavAnnounce}>
        <span className={styles.calNavAnnounceText}>{utilityText}</span>
      </div>

      {/* 2 — SPLIT: länkar vänster · wordmark centrerat · ikoner höger
          Desktop-navet bär max 6 länkar. Med alla moduler live blir listan 9, och nio
          versala länkar + wordmark + korg + konto + CTA får inte plats på en rad —
          de bröt till en andra våning. Resten når man via sidfoten (som listar allt)
          och via mobil-overlayn (NavShell får hela `links`, aldrig den kapade). */}
      <div className={styles.calNavBar}>
        <nav className={styles.calNavLinks} aria-label="Huvudmeny">
          {links.slice(0, 6).map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <Link href="/" className={styles.calNavWordmark} aria-label={tenant.name}>
          <Logo tenant={tenant} branding={branding} />
        </Link>

        <div className={styles.calNavCluster}>
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.calNavCta}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.calNavCta} label={primaryCta?.label} />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * FOOTER: mörk plommonplatta i TRE kolumner — stort wordmark + tagline + socialt |
 * meny | besök oss (adress, tider, kontakt). Render-on-present: saknas adressen ritas
 * inget adressblock (aldrig en påhittad adress), och sociala ikoner blir bara länkar
 * när de finns.
 */
export function CalytrixFooter({
  tenant,
  tagline,
  location,
  contact,
  social,
  links,
}: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const hasSocial = !!social.instagram || !!social.facebook || !!social.tiktok
  return (
    <footer className={styles.calFooter}>
      <div className={styles.calFooterGrid}>
        <div className={styles.calFooterBrand}>
          <div className={styles.calFooterWordmark}>{tenant.name}</div>
          <p className={styles.calFooterTagline}>{tagline}</p>
          {/* Socialt som VERSAL TEXT, inte ikoner: ikonsetet (StorefrontIcon) har bara
              instagram — facebook/tiktok hade renderat tomma svg-rutor. Text ljuger inte. */}
          {hasSocial ? (
            <div className={styles.calFooterSocials}>
              {social.instagram ? (
                <a className={styles.calFooterSocial} href={social.instagram} target="_blank" rel="noreferrer noopener">
                  Instagram
                </a>
              ) : null}
              {social.facebook ? (
                <a className={styles.calFooterSocial} href={social.facebook} target="_blank" rel="noreferrer noopener">
                  Facebook
                </a>
              ) : null}
              {social.tiktok ? (
                <a className={styles.calFooterSocial} href={social.tiktok} target="_blank" rel="noreferrer noopener">
                  TikTok
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <h2 className={styles.calFooterHead}>Meny</h2>
          <ul className={styles.calFooterLinks}>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={styles.calFooterHead}>Besök oss</h2>
          {location?.address ? <p className={styles.calFooterText}>{location.address}</p> : null}
          {contact.phone ? (
            <p className={styles.calFooterText}>
              <a className={styles.calFooterLink} href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.calFooterText}>
              <a className={styles.calFooterLink} href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </p>
          ) : null}
          {hours ? (
            <div className={styles.calFooterHours}>
              {hours.map((h) => (
                <div key={h.day} className={styles.calFooterHoursRow}>
                  <span>{h.day}</span>
                  <span>{h.time}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.calFooterBottom}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
