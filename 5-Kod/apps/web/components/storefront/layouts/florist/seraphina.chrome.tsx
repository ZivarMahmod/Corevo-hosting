import type { ReactNode } from 'react'
import { SocialButtons } from '../../SocialButtons'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import shell from '@/components/brand/nav-shell.module.css'
import styles from './seraphina.module.css'

/**
 * SERAPHINA — mallens EGET sidhuvud + sidfot (goal-59 tema-paket).
 *
 * FORMEN är mallens, FUNKTIONEN plattformens: markupen renderas som children i
 * NavShell (mobilmeny, fokusfälla, korg, konto, scroll-skinn), och `links` +
 * `primaryCta` kommer modul-gatade från (public)/layout.tsx — därför renderas
 * ALLA links och korgen ALLTID när cartEnabled.
 *
 * NAV-STRUKTUR (ingen annan mall i sviten har den): en INBJUDNINGSKORT-nav,
 * tre staplade rader, allt centrerat som på ett bröllopskort:
 *   1. en tunn guldlinje över hela bredden (kortets övre kant),
 *   2. wordmarket CENTRERAT i stora spärrade versaler — funktionsklustret
 *      (korg · konto · CTA) ligger absolut förankrat i högerkanten på SAMMA rad,
 *      så wordmarket är optiskt viewport-centrerat, inte "resten av gridet",
 *   3. menyn CENTRERAD i små spärrade versaler mellan TVÅ guldhårlinjer —
 *      mallens dubbel-guldram, samma grepp som heron.
 * Ingen annan syskonmall har wordmark över meny; ingen har guldband kring menyn.
 *
 * `utilityText` renderas INTE här: NavShell äger redan toppremsan (UtilityBar).
 */
export function SeraphinaNav({
  tenant,
  branding,
  links,
  primaryCta,
  cartEnabled,
  customerAccountsEnabled,
}: ThemeNavProps) {
  return (
    // shell.navThemed = NavShells sticky/scroll-kontrakt (får aldrig tas bort).
    // .seraNav skriver om dess grid till tre staplade, centrerade rader.
    <header className={`${shell.navThemed} ${styles.seraNav}`}>
      <div className={styles.seraNavRule} aria-hidden="true" />

      <div className={styles.seraNavCrest}>
        <Link href="/" className={styles.seraNavWordmark} aria-label={tenant.name}>
          {/* Logo tar BrandTenant men läser bara .name — id/slug är oanvända. */}
          <Logo tenant={{ id: '', name: tenant.name, slug: '' }} branding={branding} />
        </Link>

        <div className={styles.seraNavCluster}>
          {cartEnabled ? <CartNavButton className={shell.navAccount} /> : null}
          {customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {primaryCta && primaryCta.href !== '/boka' ? (
            <Link href={primaryCta.href} className={`btn-accent ${styles.seraNavBtn}`}>
              {primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.seraNavBtn} label={primaryCta?.label} />
          )}
        </div>
      </div>

      {/* goal-60: menyraden bär max 6 länkar. Med alla moduler live blir listan 9 och
          guldbandet bröt till två rader. NavShell får HELA `links` (mobil-overlayn),
          sidfoten listar allt. */}
      <nav className={styles.seraNavLinks} aria-label="Huvudmeny">
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
 * SIDFOT — LJUS och CENTRERAD (svit-syskonen har mörka plattor eller kolumner).
 * En guldlinje, ett stort kursivt wordmark, taglinen, sedan detaljerna som EN
 * centrerad rad separerad av gulddiamanter (adress · telefon · mejl), öppettiderna
 * som en smal centrerad lista, menyn i spärrade versaler och de sociala som text.
 * Render-on-present: varje fält ritas BARA när det finns — aldrig en påhittad
 * adress, aldrig en död ikon.
 */
export function SeraphinaFooter({
  tenant,
  tagline,
  location,
  contact,
  social,
  links,
}: ThemeFooterProps) {
  const hours = location?.hours ?? null
  const socials = [
    { key: 'instagram' as const, href: social.instagram, label: 'Instagram' },
    { key: 'facebook' as const, href: social.facebook, label: 'Facebook' },
    { key: 'tiktok' as const, href: social.tiktok, label: 'TikTok' },
  ].filter((s) => !!s.href)

  const details: { key: string; node: ReactNode }[] = []
  if (location?.address) details.push({ key: 'addr', node: location.address })
  if (contact.phone)
    details.push({
      key: 'tel',
      node: (
        <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className={styles.seraFootLink}>
          {contact.phone}
        </a>
      ),
    })
  if (contact.email)
    details.push({
      key: 'mail',
      node: (
        <a href={`mailto:${contact.email}`} className={styles.seraFootLink}>
          {contact.email}
        </a>
      ),
    })

  return (
    <footer className={styles.seraFooter}>
      <div className={styles.seraFootInner}>
        <span className={styles.seraFootDiamond} aria-hidden="true">
          ✦
        </span>
        <p className={styles.seraFootWordmark}>{tenant.name}</p>
        <p className={styles.seraFootTagline}>{tagline}.</p>

        {details.length > 0 ? (
          <p className={styles.seraFootDetails}>
            {details.map((d, i) => (
              <span key={d.key}>
                {i > 0 ? (
                  <span className={styles.seraFootSep} aria-hidden="true">
                    ✦
                  </span>
                ) : null}
                {d.node}
              </span>
            ))}
          </p>
        ) : null}

        {hours ? (
          <div className={styles.seraFootHours}>
            {hours.map((h) => (
              <div key={h.day} className={styles.seraFootHoursRow}>
                <span>{h.day}</span>
                <span>{h.time}</span>
              </div>
            ))}
          </div>
        ) : null}

        <nav className={styles.seraFootNav} aria-label="Sidfotsmeny">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        {socials.length > 0 ? (
          <div className={styles.seraFootSocials}>
            <SocialButtons links={socials} />
          </div>
        ) : null}

        <p className={styles.seraFootBottom}>
          © {new Date().getFullYear()} {tenant.name}
        </p>
      </div>
    </footer>
  )
}
