import Link from 'next/link'
import { SocialButtons } from '../../SocialButtons'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './lunaria.module.css'

/**
 * LUNARIA — chrome (goal-64, EXAKT kopia ur "Lunaria - Art Déco.dc.html").
 *
 * SIDHUVUDET är filens: bläckblå platta med en GULD hårlinje under, wordmarket till
 * vänster i 30px Poiret One spärrad 0.24em, menyn CENTRERAD i en rad med 26px mellanrum
 * (spärrade mikroversaler, guldlinje under den aktiva), och längst ut den FYLLDA
 * guldetiketten "Korg · N" som slår om till pärlvitt vid hover. Ingen backdrop-blur,
 * inga rundade hörn — deco ritar med linjal.
 *
 * SIDFOTEN är filens: guld hårlinje, stort centrerat wordmark, en rad mikroversal-länkar
 * och en avslutande copyright-rad i dämpat blågrått. Inga kolumner, ingen adressplatta —
 * mallen säger mindre än sina syskon, med avsikt.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function LunariaNav(p: ThemeNavProps) {
  return (
    <header className={`${shell.navThemed} ${styles.lnNav}`}>
      <Link
        href="/"
        className={`${shell.navWordmark} ${styles.lnNavWordmark}`}
        aria-label={p.tenant.name}
      >
        <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
      </Link>

      <nav className={`${shell.navLinks} ${styles.lnNavLinks}`} aria-label="Huvudmeny">
        {p.links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={`${shell.navCluster} ${styles.lnNavCluster}`}>
        {p.customerAccountsEnabled ? (
          <Link href="/login" className={shell.navAccount} aria-label="Logga in">
            <StorefrontIcon name="user" size={18} />
          </Link>
        ) : null}
        {/* Filens sidhuvud har EN handling längst ut: den fyllda guldetiketten "Korg · N".
            Går shopen inte att nå faller vi tillbaka på plattformens huvud-CTA i samma
            form — annars hade mallen tappat vägen in i bokningen helt. */}
        {p.cartEnabled ? (
          <CartNavButton className={styles.lnNavCta} />
        ) : p.primaryCta && p.primaryCta.href !== '/boka' ? (
          <Link href={p.primaryCta.href} className={styles.lnNavCta}>
            {p.primaryCta.label}
          </Link>
        ) : (
          <BookCta className={styles.lnNavCta} label={p.primaryCta?.label} />
        )}
      </div>
    </header>
  )
}

export function LunariaFooter(p: ThemeFooterProps) {
  const socials = [
    p.social.instagram ? { href: p.social.instagram, label: 'Instagram' } : null,
    p.social.facebook ? { href: p.social.facebook, label: 'Facebook' } : null,
    p.social.tiktok ? { href: p.social.tiktok, label: 'TikTok' } : null,
  ].filter((s): s is { href: string; label: string } => s !== null)

  // Filens copyright-rad: "© 2026 LUNARIA · STRANDVÄGEN 7 · BYGGD MED COREVO".
  // Render-on-present: saknas adressen hoppar vi över den — aldrig en påhittad gata.
  const meta = [
    `© ${new Date().getFullYear()} ${p.tenant.name}`,
    p.location?.address ?? null,
    'Byggd med Corevo',
  ]
    .filter((s): s is string => !!s)
    .join(' · ')

  return (
    <footer className={styles.lnFoot}>
      <div className={styles.lnFootInner}>
        <p className={styles.lnFootMark}>{p.tenant.name}</p>
        <nav className={styles.lnFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        {socials.length > 0 ? (
          <div className={styles.lnFootSocial}>
            <SocialButtons links={socials} />
          </div>
        ) : null}
        <p className={styles.lnFootMeta}>{meta}</p>
      </div>
    </footer>
  )
}
