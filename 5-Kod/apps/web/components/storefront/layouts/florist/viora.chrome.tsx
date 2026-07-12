import Link from 'next/link'
import { SocialButtons } from '../../SocialButtons'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './viora.module.css'

/**
 * VIORA — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * FORMEN är mallens, FUNKTIONEN är plattformens: markupen renderas som children i
 * NavShell (mobilmeny, fokusfälla, korg, konto, scroll-skinn) och `links`/`primaryCta`
 * kommer modul-gatade från (public)/layout.tsx — därför renderas ALLA links och korgen
 * ALLTID när cartEnabled.
 *
 * NAV-STRUKTUR (ingen syskonmall har den): TVÅ RADER, allt VÄNSTERSTÄLLT.
 *   • Rad 1: wordmarket till vänster, funktions-klustret (korg · konto · CTA) till höger.
 *   • Rad 2 (egen rad, hårlinje emellan): menyn — vänsterställd, versal-mikrotext med
 *     underline-on-hover, alltså INTE ett kluster i samma rad som logotypen.
 * Grannarna kör centrerat krön (onyx), enkelrad (aurora/sage) eller rail — Vioras
 * "logotyp uppe, meny under" är en boutique-butiksskylt: två horisontella band.
 *
 * `utilityText` renderas INTE här: NavShell äger redan toppremsan (UtilityBar) och
 * skulle annars säga samma sak två gånger.
 */
export function VioraNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får ALDRIG tas bort).
    // .vioNav (dubblad i CSS:en) skriver om dess 3-zons-grid till två staplade rader.
    <header className={`${shell.navThemed} ${styles.vioNav}`}>
      <div className={styles.vioNavTop}>
        <Link href="/" className={styles.vioNavWordmark} aria-label={tenant.name}>
          {/* Logo tar BrandTenant men läser bara .name — id/slug är oanvända. */}
          <Logo tenant={{ id: '', name: tenant.name, slug: '' }} branding={branding} />
        </Link>

        <div className={styles.vioNavCluster}>
          {cartEnabled ? (
            <CartNavButton className={`${shell.navAccount} ${styles.vioNavIcon}`} />
          ) : null}
          {customerAccountsEnabled ? (
            <Link
              href="/login"
              className={`${shell.navAccount} ${styles.vioNavIcon}`}
              aria-label="Logga in"
            >
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.vioBtn}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.vioBtn} label={primaryCta?.label} />
          )}
        </div>
      </div>

      {/* MENYN SOM EGEN RAD — vänsterställd, hårlinje över. MAX 6 länkar på desktop
          (goal-60): med alla moduler live blir listan 9 och raden bröt till två
          våningar. NavShell får fortfarande HELA `links` (mobil-overlayn) och
          sidfoten listar allt — inget blir oåtkomligt. */}
      <nav className={styles.vioNavLinks} aria-label="Huvudmeny">
        {links.slice(0, 6).map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

/**
 * SIDFOT — en VIOLETT PLATTA i TVÅ KOLUMNER (grannarnas footers är svart platta,
 * tre kolumner eller en centrerad rad). Vänster: stort wordmark + tagline + sociala
 * länkar som text. Höger: två stackade block — besök oss (adress/telefon/mejl) och
 * öppettider — plus menyn längst ner. Render-on-present: varje fält ritas BARA när
 * det finns (aldrig en påhittad adress, aldrig en död ikon).
 */
export function VioraFooter({ tenant, tagline, location, contact, social, links }: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const socials = [
    { key: 'instagram' as const, href: social.instagram, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, label: 'Facebook' },
    { key: 'tiktok' as const, href: social.tiktok, label: 'TikTok' },
  ].filter((s) => !!s.href)

  return (
    <footer className={styles.vioFooter}>
      <div className={styles.vioFooterGrid}>
        {/* KOLUMN 1 — typografin ÄR ytan */}
        <div className={styles.vioFooterBrand}>
          <p className={styles.vioFooterWordmark}>{tenant.name}</p>
          <p className={styles.vioFooterTagline}>{tagline}.</p>
          {socials.length > 0 ? (
            <div className={styles.vioFooterSocials}>
              <SocialButtons links={socials} />
            </div>
          ) : null}
        </div>

        {/* KOLUMN 2 — fakta + meny, stackade */}
        <div className={styles.vioFooterInfo}>
          <div className={styles.vioFooterBlocks}>
            {location?.address || contact.phone || contact.email ? (
              <div className={styles.vioFooterBlock}>
                <h2 className={styles.vioFooterHead}>Besök oss</h2>
                {location?.address ? <p className={styles.vioFooterText}>{location.address}</p> : null}
                {contact.phone ? (
                  <p className={styles.vioFooterText}>
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                      className={styles.vioFooterLink}
                    >
                      {contact.phone}
                    </a>
                  </p>
                ) : null}
                {contact.email ? (
                  <p className={styles.vioFooterText}>
                    <a href={`mailto:${contact.email}`} className={styles.vioFooterLink}>
                      {contact.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            {hours ? (
              <div className={styles.vioFooterBlock}>
                <h2 className={styles.vioFooterHead}>Öppettider</h2>
                {hours.map((h) => (
                  <div key={h.day} className={styles.vioFooterHoursRow}>
                    <span>{h.day}</span>
                    <span>{h.time}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <nav className={styles.vioFooterNav} aria-label="Sidfotsmeny">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={styles.vioFooterLink}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className={styles.vioFooterBottom}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
