import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './eloria.module.css'

/**
 * ELORIA — chrome (goal-64, exakt kopia ur .dc.html).
 *
 * SIDHUVUDET är filens KRÖN: en mörkgrön guldremsa högst upp (mallen ritar den själv →
 * ownsUtility), sedan ett CENTRERAT, staplat huvud — wordmark i 46px spärrad versal-garamond
 * (0.3em), husets kursiva undertitel under, och menyn i EN rad mellan två hårlinjer med "|"
 * som avdelare. Under raden står "Er beställning (n)" som kursiv guldlänk. Ingen mall i
 * sviten har ett centrerat krön; det ÄR Elorias ansikte.
 *
 * SIDFOTEN är filens: mörkgrön helbredd, stort wordmark, tre guldlinjerade kolumner
 * (Besök · Kontakt · Öppettider), menyn som guldhoverande mikroversal, copyright sist.
 * Render-on-present: saknas adress/kontakt/tider ritas kolumnen inte alls.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function EloriaNav(p: ThemeNavProps) {
  return (
    <>
      {/* Guldremsan — mallens egen, därav ownsUtility i temat (annars två staplade remsor). */}
      {p.utilityText ? (
        <div className={styles.elUtility}>
          <p>{p.utilityText}</p>
        </div>
      ) : null}

      <header className={`${shell.navThemed} ${styles.elNav}`}>
        <Link
          href="/"
          className={`${shell.navWordmark} ${styles.elNavWordmark}`}
          aria-label={p.tenant.name}
        >
          <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
        </Link>
        {/* Krönets kursiva undertitel. ThemeNavProps bär ingen tagline (bara sidfoten gör
            det), så filens egen rad står här verbatim — samma sträng som temats
            content.tagline, alltså ingen ny copy. */}
        <p className={styles.elNavSub}>blomsterhandel i klassisk stil</p>

        <nav className={`${shell.navLinks} ${styles.elNavLinks}`} aria-label="Huvudmeny">
          {p.links.map((l, i) => (
            <span key={l.href} className={styles.elNavItem}>
              <Link href={l.href}>{l.label}</Link>
              {/* Filens `item.sep`: "|" mellan posterna, tomt efter den sista. */}
              {i < p.links.length - 1 ? <span className={styles.elNavSep}>|</span> : null}
            </span>
          ))}
        </nav>

        <div className={`${shell.navCluster} ${styles.elNavCluster}`}>
          {p.customerAccountsEnabled ? (
            <Link href="/login" className={styles.elNavAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {/* Filens huvud har EN handling: "Er beställning (n)". Går shopen inte att nå
              faller vi tillbaka på plattformens huvud-CTA — annars hade mallen tappat
              vägen in i bokningen helt. */}
          {p.cartEnabled ? (
            <CartNavButton className={styles.elNavCta} />
          ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
            <Link href={p.primaryCta.href} className={styles.elNavCta}>
              {p.primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.elNavCta} label={p.primaryCta?.label} />
          )}
        </div>
      </header>
    </>
  )
}

export function EloriaFooter(p: ThemeFooterProps) {
  const hours = p.location?.hours ?? null
  const hasContact = !!p.contact.phone || !!p.contact.email

  return (
    <footer className={styles.elFoot}>
      <div className={styles.elFootInner}>
        <p className={styles.elFootMark}>{p.tenant.name}</p>

        {p.location?.address || hasContact || hours ? (
          <div className={styles.elFootCols}>
            <div>
              {p.location?.address ? (
                <>
                  <p className={styles.elFootHead}>Besök</p>
                  <p className={styles.elFootText}>{p.location.address}</p>
                </>
              ) : null}
            </div>
            <div className={styles.elFootColMid}>
              {hasContact ? (
                <>
                  <p className={styles.elFootHead}>Kontakt</p>
                  <p className={styles.elFootText}>
                    {p.contact.phone ? (
                      <>
                        <a href={`tel:${p.contact.phone.replace(/\s+/g, '')}`}>{p.contact.phone}</a>
                        <br />
                      </>
                    ) : null}
                    {p.contact.email ? (
                      <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a>
                    ) : null}
                  </p>
                </>
              ) : null}
            </div>
            <div>
              {hours ? (
                <>
                  <p className={styles.elFootHead}>Öppettider</p>
                  <p className={styles.elFootText}>
                    {hours.map((h) => (
                      <span key={h.day}>
                        {h.day} {h.time}
                        <br />
                      </span>
                    ))}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        <nav className={styles.elFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <p className={styles.elFootMeta}>
          © {new Date().getFullYear()} {p.tenant.name} · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
