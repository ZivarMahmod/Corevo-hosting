import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './calytrix.module.css'

/**
 * CALYTRIX — CHROME (goal-64, exakt kopia ur "Calytrix - E-handel.dc.html").
 *
 * SIDHUVUDET är filens två rader:
 *   RAD 1 — annonsraden: mörk plommon (#4a0e2e), vit mikrotext (ägarens utility-copy).
 *           chrome.ownsUtility → NavShell hoppar över plattformens egen remsa (annars
 *           två staplade rader, goal-60).
 *   RAD 2 — 1fr auto 1fr: wordmark VÄNSTER (27px serif), menyn CENTRERAD (14.5px, 30px
 *           mellanrum, 2px understruken vid hover), korgen HÖGER som en inramad svart
 *           rektangel som fylls vid hover.
 *
 * .dc.html har en tredje rad — kategori-chipsen (Alla/Buketter/Rosor/Säsong/Under 500).
 * Den är INTE byggd: shop_products bär ingen kategori, så chipsen hade varit fem knappar
 * som inte filtrerar något. En kontroll som inte gör något ljuger (goal-62).
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen bara när shopen är live, kontolänken när kundkonton är på.
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
    <header className={`${shell.navThemed} ${styles.cxNav}`}>
      {/* RAD 1 — ANNONSRADEN */}
      <div className={styles.cxAnnounce}>{utilityText}</div>

      {/* RAD 2 — logga · meny · korg */}
      <div className={styles.cxNavBar}>
        <Link
          href="/"
          className={`${shell.navWordmark} ${styles.cxNavWordmark}`}
          aria-label={tenant.name}
        >
          <Logo tenant={tenant} branding={branding} />
        </Link>

        <nav className={`${shell.navLinks} ${styles.cxNavLinks}`} aria-label="Huvudmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={`${shell.navCluster} ${styles.cxNavCluster}`}>
          {customerAccountsEnabled ? (
            <Link
              href="/login"
              className={`${shell.navAccount} ${styles.cxNavIcon}`}
              aria-label="Logga in"
            >
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {/* Filens enda handling i huvudet ÄR korgen. Går shopen inte att nå faller vi
              tillbaka på plattformens huvud-CTA — annars hade mallen tappat vägen in i
              bokningen helt. */}
          {cartEnabled ? (
            <CartNavButton className={styles.cxNavCta} />
          ) : primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={styles.cxNavCta}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.cxNavCta} label={primaryCta?.label} />
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * SIDFOTEN är filens: mörk (#241019) platta i fyra kolumner —
 *   wordmark + tagline | Handla | Hjälp | Nyhetsbrev.
 *
 * Filens två länkkolumner är hårdkodade i mocken; här kommer de ur `links`, som är
 * MODUL-GATADE (avstängd modul → noll länkar till sin sida). De delas i två spalter så
 * filens form bevaras utan att en enda död länk uppstår.
 *
 * Nyhetsbrevsfältet är INTE byggt: det finns ingen nyhetsbrevs-motor, och ett fält som
 * inte skickar något ljuger (goal-62). Samma kropp, ärlig handling — mejla butiken.
 * Render-on-present: saknas mejlen ritas kortet inte alls.
 */
export function CalytrixFooter({ tenant, tagline, contact, links }: ThemeFooterProps) {
  const half = Math.ceil(links.length / 2)
  const handla = links.slice(0, half)
  const hjalp = links.slice(half)

  return (
    <footer className={styles.cxFooter}>
      <div className={styles.cxFooterGrid}>
        <div>
          <p className={styles.cxFooterMark}>{tenant.name}</p>
          <p className={styles.cxFooterTagline}>{tagline}</p>
        </div>

        <div>
          <p className={styles.cxFooterHead}>Handla</p>
          <ul className={styles.cxFooterLinks}>
            {handla.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.cxFooterHead}>Hjälp</p>
          <ul className={styles.cxFooterLinks}>
            {hjalp.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/kontakt">Kontakt</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className={styles.cxFooterHead}>Hör av dig</p>
          <p className={styles.cxFooterText}>
            Frågor om en order? Ange ordernumret så går det fortare.
          </p>
          {contact.email ? (
            <a className={styles.cxFooterMailBtn} href={`mailto:${contact.email}`}>
              Skriv till oss
            </a>
          ) : contact.phone ? (
            <a className={styles.cxFooterMailBtn} href={`tel:${contact.phone.replace(/\s+/g, '')}`}>
              Ring oss
            </a>
          ) : null}
        </div>
      </div>

      <p className={styles.cxFooterBottom}>
        © {new Date().getFullYear()} {tenant.name} · Byggd med Corevo
      </p>
    </footer>
  )
}
