import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './onyx.module.css'

/**
 * ONYX — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * FORMEN är mallens, FUNKTIONEN är plattformens: markupen nedan renderas som
 * children i NavShell (mobilmeny, fokusfälla, korg, konto, scroll-skinn), och
 * `links`/`primaryCta` kommer modul-gatade från (public)/layout.tsx — därför
 * renderas ALLA links och korgen ALLTID när cartEnabled.
 *
 * NAV-STRUKTUR (ingen annan mall i sviten har den): ett KRÖN och en RAD.
 *   • Krönet: wordmarket CENTRERAT, stort, med ett dekorativt EST-emblem under
 *     (rent stilgrepp — ingen sifferclaim, inget påhittat årtal).
 *   • Raden: en korall-hårlinje, sedan menyn CENTRERAD och funktions-klustret
 *     (korg · konto · CTA) förankrat till höger i samma rad.
 * Naven ligger dessutom TRANSPARENT över hemmets mörka hero (layouten sätter
 * `.hero`-sentinelen) och blir svart platta på scroll — resten av sviten har en
 * solid nav i normalflödet.
 *
 * `utilityText` renderas INTE här: NavShell äger redan toppremsan (UtilityBar)
 * och skulle annars säga samma sak två gånger.
 */
export function OnyxNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får aldrig tas bort).
    // .onxNav (dubblad i CSS:en) skriver om dess grid till krön + rad.
    <header className={`${shell.navThemed} ${styles.onxNav}`}>
      <div className={styles.onxNavCrest}>
        <Link href="/" className={styles.onxNavWordmark} aria-label={tenant.name}>
          {/* Logo tar BrandTenant men läser bara .name — id/slug är oanvända. */}
          <Logo tenant={{ id: '', name: tenant.name, slug: '' }} branding={branding} />
        </Link>
        <span className={styles.onxNavEmblem} aria-hidden="true">
          Est
        </span>
      </div>

      <div className={styles.onxNavBar}>
        <nav className={styles.onxNavLinks} aria-label="Huvudmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.onxNavCluster}>
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.onxBtn}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.onxBtn} label={primaryCta?.label} />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * SIDFOT — en HELSVART PLATTA med ett gigantiskt wordmark som brutet överst
 * (typografin ÄR ytan), en korall-hårlinje, och därunder tre smala kolumner:
 * besök · öppettider · meny. Render-on-present: adress, telefon, mejl, tider och
 * sociala länkar ritas BARA när de finns — ingen påhittad adress, inga döda ikoner.
 */
export function OnyxFooter({ tenant, tagline, location, contact, social, links }: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const socials = [
    { key: 'instagram' as const, href: social.instagram, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, label: 'Facebook' },
    { key: 'tiktok' as const, href: social.tiktok, label: 'TikTok' },
  ].filter((s) => !!s.href)

  return (
    <footer className={styles.onxFooter}>
      <div className={styles.onxFooterSlab}>
        <p className={styles.onxFooterWordmark}>{tenant.name}</p>
        <p className={styles.onxFooterTagline}>{tagline}.</p>
      </div>

      <div className={styles.onxFooterCols}>
        <div className={styles.onxFooterCol}>
          <h2 className={styles.onxFooterHead}>Besök oss</h2>
          {location?.address ? <p className={styles.onxFooterText}>{location.address}</p> : null}
          {contact.phone ? (
            <p className={styles.onxFooterText}>
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.onxFooterLink}>
                {contact.phone}
              </a>
            </p>
          ) : null}
          {contact.email ? (
            <p className={styles.onxFooterText}>
              <a href={`mailto:${contact.email}`} className={styles.onxFooterLink}>
                {contact.email}
              </a>
            </p>
          ) : null}
          {/* Socialt = TEXT, inte ikoner: den svarta plattan är typografisk, och
              en ikon-uppsättning som saknar en glyf (tiktok) skulle rendera en tom
              ruta. Bara ifyllda länkar ritas. */}
          {socials.length > 0 ? (
            <div className={styles.onxFooterSocials}>
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href as string}
                  className={styles.onxFooterSocial}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {hours ? (
          <div className={styles.onxFooterCol}>
            <h2 className={styles.onxFooterHead}>Öppettider</h2>
            {hours.map((h) => (
              <div key={h.day} className={styles.onxFooterHoursRow}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.onxFooterCol}>
          <h2 className={styles.onxFooterHead}>Meny</h2>
          <nav className={styles.onxFooterNav} aria-label="Sidfotsmeny">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={styles.onxFooterLink}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className={styles.onxFooterBottom}>
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
