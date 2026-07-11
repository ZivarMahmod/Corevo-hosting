import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './oliviathyme.module.css'

/**
 * OLIVIA & THYME — TEMA-PAKETETS SIDHUVUD + SIDFOT (goal-59).
 *
 * NAVEN är kvarterbutikens SKYLT, inte en app-header. Tre staplade rader i stället
 * för plattformens 3-zons-grid:
 *   1. en tunn BEIGE REMSA (--color-surface) med butikens utility-rad, centrerad
 *   2. WORDMARKET CENTRERAT och stort — butikens namn på skylten
 *   3. MENYN i EN egen rad under, centrerad, med korg/konto/CTA förankrade till höger
 * Rad 2+3 skiljs av en hårlinje; hela huvudet vilar på creme. Ingen mall i sviten har
 * ett centrerat wordmark ovanpå en menyrad — det är den här mallens ansikte.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin), ALLA modul-gatade `links` renderas, korgen renderas när
 * shop är live, kontolänken när kundkonton är på, och huvud-CTA:n går via BookCta när
 * branschen pekar på /boka. `shell.navThemed` MÅSTE ligga kvar på <header> — NavShells
 * skin-byte hänger på den; .otNav.otNav (0,2,0) skriver över dess grid deterministiskt.
 *
 * FOOTERN är en MÖRKBRUN PLATTA i tre kolumner (butik · öppettider · hitta hit) med en
 * menyrad + copyright på en avslutande hårlinje. Render-on-present: adress, telefon,
 * mejl, öppettider och sociala länkar ritas BARA när de finns — aldrig en påhittad rad.
 */
export function OliviaThymeNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
  utilityText,
}: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.otNav}`}>
      {/* 1 — TUNN BEIGE REMSA */}
      {utilityText ? <p className={styles.otNavStrip}>{utilityText}</p> : null}

      {/* 2 — WORDMARK, CENTRERAT */}
      <div className={styles.otNavMark}>
        <Link href="/" className={styles.otNavWordmark} aria-label={tenant.name}>
          <Logo tenant={tenant} branding={branding} />
        </Link>
      </div>

      {/* 3 — MENYN I EN RAD UNDER, kluster till höger.
          goal-60: max SEX länkar på skyltens menyrad. Med alla moduler live blir
          `links` nio, och nio versala länkar + korg + konto + CTA fick inte plats —
          raden bröt till en andra våning (`flex-wrap: wrap` lät den spilla). En
          kvartersbutik har aldrig fler än sex topplänkar; resten bor i sidfoten,
          som listar allihop. NavShell får fortfarande HELA `links` till mobil-
          overlayn, så ingen modul kan försvinna ur menyn — den flyttar bara ned. */}
      <div className={styles.otNavBar}>
        <nav className={styles.otNavLinks} aria-label="Huvudmeny">
          {links.slice(0, 6).map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.otNavCluster}>
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.otNavCta}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.otNavCta} label={primaryCta?.label} />
          )}
        </div>
      </div>
    </header>
  )
}

export function OliviaThymeFooter({
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
    <footer className={styles.otFoot}>
      <div className={styles.otFootGrid}>
        {/* KOLUMN 1 — butiken */}
        <div className={styles.otFootCol}>
          <p className={styles.otFootMark}>{tenant.name}</p>
          <p className={styles.otFootTagline}>{tagline}.</p>
          {hasSocial ? (
            <p className={styles.otFootSocial}>
              {social.instagram ? (
                <a href={social.instagram} target="_blank" rel="noreferrer noopener">
                  Instagram
                </a>
              ) : null}
              {social.facebook ? (
                <a href={social.facebook} target="_blank" rel="noreferrer noopener">
                  Facebook
                </a>
              ) : null}
              {social.tiktok ? (
                <a href={social.tiktok} target="_blank" rel="noreferrer noopener">
                  TikTok
                </a>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* KOLUMN 2 — öppettider (butikens viktigaste rad) */}
        {hours ? (
          <div className={styles.otFootCol}>
            <h2 className={styles.otFootHead}>Öppettider</h2>
            <dl className={styles.otFootHours}>
              {hours.map((h) => (
                <div key={h.day} className={styles.otFootHoursRow}>
                  <dt>{h.day}</dt>
                  <dd>{h.time}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {/* KOLUMN 3 — hitta hit */}
        {location?.address || contact.phone || contact.email ? (
          <div className={styles.otFootCol}>
            <h2 className={styles.otFootHead}>Hitta hit</h2>
            {location?.address ? <p className={styles.otFootText}>{location.address}</p> : null}
            {contact.phone ? (
              <p className={styles.otFootText}>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.otFootText}>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
            ) : null}
            {location?.address ? (
              <p className={styles.otFootText}>
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Visa på karta <span aria-hidden="true">→</span>
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.otFootBottom}>
        <nav className={styles.otFootLinks} aria-label="Sidfotsmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className={styles.otFootCopy}>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
