import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './eloria.module.css'

/**
 * ELORIA — TEMA-PAKETETS SIDHUVUD + SIDFOT (goal-59).
 *
 * FORMEN är mallens, FUNKTIONEN är plattformens: markupen nedan renderas som children
 * i NavShell (mobilmeny, fokusfälla, scroll-beteende), och länklistan + huvud-CTA:n är
 * modul-gatade av app/(public)/layout.tsx. Därför renderas ALLA `links` (utelämnar vi en
 * försvinner kundens butik ur menyn), korgen när `cartEnabled` och kontot när
 * `customerAccountsEnabled` — annars tappar mallen funktion utan att någon märker det.
 *
 * NAV-SIGNATUR (ingen syskonmall har den): en HEL mörkgrön platta över hela bredden med
 * wordmarket CENTRERAT i en guldram, och menyn delad i TVÅ GRUPPER — vänster om ramen och
 * höger om den. Ovanför plattan ligger en tunn guldlinjerad topbar med utility-texten.
 * Det är ett klassiskt boktitelblad, inte en sidhuvudsrad.
 *
 * FOOTER-SIGNATUR: samma mörkgröna platta, tre kolumner separerade av vertikala guldlinjer
 * (Butiken / Besök oss / Öppettider), med menylänkarna på en guldlinjerad bottenrad.
 * Render-on-present: saknas adress/tider/kontakt ritas de inte — aldrig en påhittad adress.
 */
export function EloriaNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
  utilityText,
}: ThemeNavProps) {
  // Menyn delas i två grupper kring det centrerade wordmarket. Udda antal → den
  // extra länken hamnar till vänster (läsordningen börjar där).
  const half = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, half)
  const rightLinks = links.slice(half)

  return (
    <header className={`${shell.navThemed} ${styles.elNav}`}>
      {utilityText ? (
        <p className={styles.elNavUtility}>{utilityText}</p>
      ) : null}

      <div className={styles.elNavRow}>
        <nav className={`${styles.elNavGroup} ${styles.elNavGroupL}`} aria-label="Huvudmeny">
          {leftLinks.map((l) => (
            <Link key={l.href} href={l.href} className={styles.elNavLink}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Wordmarket i guldram — mallens signatur, mitt i den mörkgröna plattan. */}
        <Link href="/" className={`${shell.navWordmark} ${styles.elNavMark}`} aria-label={tenant.name}>
          <Logo tenant={tenant} branding={branding} />
        </Link>

        <div className={styles.elNavRight}>
          <nav className={`${styles.elNavGroup} ${styles.elNavGroupR}`} aria-label="Mer i menyn">
            {rightLinks.map((l) => (
              <Link key={l.href} href={l.href} className={styles.elNavLink}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className={styles.elNavCluster}>
            {cartEnabled ? <CartNavButton className={`${shell.navAccount} ${styles.elNavIcon}`} /> : null}
            {customerAccountsEnabled ? (
              <Link href="/login" className={`${shell.navAccount} ${styles.elNavIcon}`} aria-label="Logga in">
                <StorefrontIcon name="user" size={18} />
              </Link>
            ) : null}
            {primaryCta && primaryCta.href !== '/boka' ? (
              <Link href={primaryCta.href} className={`btn-accent ${styles.elNavCta}`}>
                {primaryCta.label}
              </Link>
            ) : (
              <BookCta className={styles.elNavCta} label={primaryCta?.label} />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export function EloriaFooter({ tenant, tagline, location, contact, social, links }: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const hasContact = !!contact.email || !!contact.phone
  const hasSocial = !!social.instagram || !!social.facebook || !!social.tiktok

  return (
    <footer className={styles.elFoot}>
      <div className={styles.elFootGrid}>
        <div className={styles.elFootCol}>
          <p className={styles.elFootMark}>{tenant.name}</p>
          <p className={styles.elFootTagline}>{tagline}.</p>
          {hasSocial ? (
            <div className={styles.elFootSocials}>
              {social.instagram ? (
                <a
                  href={social.instagram}
                  className={styles.elFootSocial}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Instagram"
                >
                  <StorefrontIcon name="instagram" size={18} />
                </a>
              ) : null}
              {social.facebook ? (
                <a
                  href={social.facebook}
                  className={styles.elFootSocial}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Facebook"
                >
                  <StorefrontIcon name="facebook" size={18} />
                </a>
              ) : null}
              {social.tiktok ? (
                <a
                  href={social.tiktok}
                  className={styles.elFootSocialText}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  TikTok
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {location?.address || hasContact ? (
          <div className={styles.elFootCol}>
            <h2 className={styles.elFootHead}>Besök oss</h2>
            {location?.address ? <p className={styles.elFootText}>{location.address}</p> : null}
            {contact.phone ? (
              <p className={styles.elFootText}>
                <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.elFootLink}>
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.email ? (
              <p className={styles.elFootText}>
                <a href={`mailto:${contact.email}`} className={styles.elFootLink}>
                  {contact.email}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {hours ? (
          <div className={styles.elFootCol}>
            <h2 className={styles.elFootHead}>Öppettider</h2>
            {hours.map((h) => (
              <p key={h.day} className={styles.elFootHoursRow}>
                <span>{h.day}</span>
                <span className={styles.elFootDots} aria-hidden="true" />
                <span>{h.time}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.elFootBottom}>
        <nav className={styles.elFootNav} aria-label="Sidfotsmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={styles.elFootNavLink}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className={styles.elFootCopy}>
          © {new Date().getFullYear()} {tenant.name}
        </p>
      </div>
    </footer>
  )
}
