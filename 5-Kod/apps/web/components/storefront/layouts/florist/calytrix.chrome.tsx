import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { SocialButtons, socialLinks } from '@/components/storefront/SocialButtons'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './calytrix.module.css'

/**
 * CALYTRIX CHROME — ombyggt i packbordets anda (goal-62, Zivars uiverse-element):
 * SOLID PLOMMON. Navet och sidfoten är samma mörka bord som varukorgen — butikens
 * ansikte är mörkt och varan (guldet) är det enda som glimmar.
 *
 * NAV: två våningar — (1) VINRÖD annonsrad (utility-copyn på varje sida, som i en
 * riktig butik), (2) plommon-split: länkar VÄNSTER · wordmark CENTRERAT · ikoner
 * HÖGER. FUNKTIONEN är plattformens: markupen renderas som children i NavShell
 * (mobilmeny, fokusfälla, scroll) — burgaren ärver färg (color: inherit) så den
 * blir vit av .calNav. `shell.navThemed` MÅSTE sitta kvar på <header>.
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
          Desktop-navet bär max 6 länkar (nio versala länkar + wordmark + kluster
          bröt till en andra våning). Resten nås via sidfoten (listar allt) och
          mobil-overlayn (NavShell får hela `links`, aldrig den kapade). */}
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
          {/* Ikonknapparna får mallens mörk-nav-färger via en klass BREDVID
              shell.navAccount (onyx-mönstret) — den delade filen röres aldrig. */}
          {cartEnabled ? <CartNavButton className={`${shell.navAccount} ${styles.calNavIcon}`} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={`${shell.navAccount} ${styles.calNavIcon}`} aria-label="Logga in">
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

/** Sidfotens meny-pil — ritad inline (CSP: inga fjärr-assets). Dekor: aria-hidden. */
function FootArrow() {
  return (
    <span className={styles.calFootIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </span>
  )
}

/**
 * FOOTER: solid plommonplatta i TRE kolumner — wordmark + tagline + SOCIALKNAPPARNA
 * (SocialButtons-komponenten: riktiga ikoner, 44px, hover som fyller med guld) |
 * meny där varje länk bär uiverse-menyanatomin (rad 12105: fast ikon + platta som
 * glider in bakom vid hover — men texten är ALLTID synlig; hover-only affordance
 * på en navlänk är förbjudet) | besök oss, där mejlen är ett PAPPERSKORT med
 * knappen hängande ut över kanten (subscribe-anatomin, rad 16190 — utan fejkat
 * inputfält: det finns ingen nyhetsbrevs-motor, och ett fält som inte gör något
 * ljuger. Kortet bjuder in till mejl i stället — samma kropp, ärlig funktion).
 * Render-on-present: saknas adressen ritas inget adressblock.
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
  const socials = socialLinks(social)
  return (
    <footer className={styles.calFooter}>
      <div className={styles.calFooterGrid}>
        <div className={styles.calFooterBrand}>
          <div className={styles.calFooterWordmark}>{tenant.name}</div>
          <p className={styles.calFooterTagline}>{tagline}</p>
          {socials.length > 0 ? <SocialButtons links={socials} className={styles.calFooterSocials} /> : null}
        </div>

        <div>
          <h2 className={styles.calFooterHead}>Meny</h2>
          <ul className={styles.calFooterLinks}>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.calFootLink}>
                  <FootArrow />
                  <span className={styles.calFootLinkText}>{l.label}</span>
                </Link>
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
          {contact.email ? (
            <div className={styles.calMailCard}>
              <p className={styles.calMailKicker}>Frågor om en bukett?</p>
              <span className={styles.calMailAddr}>{contact.email}</span>
              <a className={styles.calMailBtn} href={`mailto:${contact.email}`}>
                Skriv till oss
              </a>
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
