import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './aurora.module.css'

/**
 * AURORA — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * NAV: klassisk topprad, men wordmarket är ett STORT rundat script (var(--font-script),
 * korall) längst till vänster, länkarna ligger som mjuka piller mitt i raden, och
 * huvud-CTA:n är en RUND korall-cirkel längst till höger — samma cirkel-gest som
 * hemmets "Handla nu"-knapp. Ingen annan mall har en cirkel i naven.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin), ALLA modul-gatade `links` renderas, korgen renderas när
 * shop-modulen är live och kontolänken när kundkonton är på. shell.navThemed /
 * shell.navLinks / shell.navCluster behålls som BAS-klasser — det är dem NavShells
 * mobil-media-query stänger av — och Auroras egna klasser läggs PÅ dem (dubblade
 * selektorer i CSS:en vinner på specificitet).
 *
 * FOOTER: en mjuk korall-platta, allt centrerat kring ett JÄTTESTORT script-wordmark;
 * under det en rad piller-länkar och tre kolumner (besök / öppettider / kontakt).
 * Render-on-present: adress, tider, telefon, mejl och socialt ritas bara när de finns.
 */
export function AuroraNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.auNav}`}>
      <Link href="/" className={`${shell.navWordmark} ${styles.auNavWordmark}`} aria-label={p.tenant.name}>
        <Logo tenant={p.tenant} branding={p.branding} />
      </Link>

      {/* Desktop-navet bär MAX 6 länkar (goal-60). Med alla moduler live blir listan 9,
          och nio piller + script-wordmark + korg + konto + CTA-cirkel får inte plats på
          en rad — de spillde till en andra våning. NavShell får fortfarande HELA `links`
          (mobil-overlayn), och sidfoten listar allt: inget blir oåtkomligt. */}
      <nav className={`${shell.navLinks} ${styles.auNavLinks}`} aria-label="Huvudmeny">
        {p.links.slice(0, 6).map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.auNavCluster}`}>
        {p.cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={`btn-accent ${styles.auNavCircle}`}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.auNavCircle} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function AuroraFooter(p: ThemeFooterProps) {
  const hours = p.location?.hours ?? null
  const hasContact = !!p.contact.phone || !!p.contact.email
  const socials = [
    { href: p.social.instagram, label: 'Instagram', icon: 'instagram' as const },
    { href: p.social.facebook, label: 'Facebook', icon: 'facebook' as const },
  ].filter((s) => !!s.href)

  return (
    <footer className={styles.auFoot}>
      <div className={styles.auFootTop}>
        <p className={styles.auFootWordmark}>{p.tenant.name}</p>
        <p className={styles.auFootTagline}>{p.tagline}</p>
        <nav className={styles.auFootLinks} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.auFootCols}>
        {p.location?.address ? (
          <div className={styles.auFootCol}>
            <h2 className={styles.auFootHead}>Besök oss</h2>
            <p className={styles.auFootText}>{p.location.address}</p>
          </div>
        ) : null}

        {hours ? (
          <div className={styles.auFootCol}>
            <h2 className={styles.auFootHead}>Öppettider</h2>
            {hours.map((h) => (
              <p key={h.day} className={styles.auFootHoursRow}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </p>
            ))}
          </div>
        ) : null}

        {hasContact ? (
          <div className={styles.auFootCol}>
            <h2 className={styles.auFootHead}>Hör av dig</h2>
            {p.contact.phone ? (
              <p className={styles.auFootText}>
                <a className={styles.auFootLink} href={`tel:${p.contact.phone.replace(/\s+/g, '')}`}>
                  {p.contact.phone}
                </a>
              </p>
            ) : null}
            {p.contact.email ? (
              <p className={styles.auFootText}>
                <a className={styles.auFootLink} href={`mailto:${p.contact.email}`}>
                  {p.contact.email}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {socials.length > 0 ? (
        <div className={styles.auFootSocials}>
          {socials.map((s) => (
            <a
              key={s.label}
              className={styles.auFootSocial}
              href={s.href as string}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={s.label}
            >
              <StorefrontIcon name={s.icon} size={18} />
            </a>
          ))}
        </div>
      ) : null}

      <p className={styles.auFootBottom}>
        © {new Date().getFullYear()} {p.tenant.name}
      </p>
    </footer>
  )
}
