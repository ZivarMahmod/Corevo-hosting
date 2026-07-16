import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { BookCta } from '@/components/brand/BookCta'
import { StorefrontIcon } from '@/components/storefront/StorefrontIcon'
import { CartNavButton } from '@/components/storefront/shop/CartNavButton'
import { SocialButtons, socialLinks } from '@/components/storefront/SocialButtons'
import shell from '@/components/brand/nav-shell.module.css'
import type { ThemeNavProps, ThemeFooterProps } from './types'
import styles from './snitt.module.css'

/**
 * SNITT — CHROME (goal-64, exakt kopia ur "Snitt - Svart Studio.dc.html").
 *
 * TOPPSTRIPEN är filens: en lime remsa över hela bredden med SVART spärrad mikroversal
 * ("Boka enkelt online · Drop-in putsning fredagar 15–18"). Den ritas HÄR, av mallens
 * eget nav, och därför sätter temat `ownsUtility: true` — annars staplar NavShell sin
 * egen mörka remsa ovanpå och mallen får två.
 *
 * SIDHUVUDET är filens: ordmärket "Snitt." med lime punkt till vänster, menyn centrerad
 * i spärrad mikroversal, och till höger korg-etiketten (inramad) + "Boka nu" (lime yta,
 * svart text). Hårlinjen under huvudet är sidans enda avgränsning.
 *
 * SIDFOTEN är filens: mörkare yta (#0E0E0C), ordmärke + taglinje till vänster, länkarna
 * som etiketter i mitten (den första fylld lime), copyright till höger.
 *
 * FUNKTIONEN är plattformens: markupen renderas som children i NavShell (mobilmeny,
 * fokusfälla, scroll-skin — därav shell.navThemed/navLinks/navCluster), ALLA modul-gatade
 * `links` ritas, korgen när shopen är live, kontolänken när kundkonton är på.
 */
export function SnittNav(p: ThemeNavProps) {
  return (
    <>
      {/* Lime bär ALLTID svart text — hela mallens enda hårda färgregel. */}
      {p.utilityText ? (
        <div className={styles.snUtility}>
          <p className={styles.snUtilityText}>{p.utilityText}</p>
        </div>
      ) : null}

      <header className={`${shell.navThemed} ${styles.snNav}`}>
        <Link
          href="/"
          className={`${shell.navWordmark} ${styles.snNavWordmark}`}
          aria-label={p.tenant.name}
        >
          <Logo tenant={{ id: '', name: p.tenant.name, slug: '' }} branding={p.branding} />
          <span className={styles.snDot}>.</span>
        </Link>

        <nav className={`${shell.navLinks} ${styles.snNavLinks}`} aria-label="Huvudmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={`${shell.navCluster} ${styles.snNavCluster}`}>
          {p.customerAccountsEnabled ? (
            <Link href="/login" className={shell.navAccount} aria-label="Logga in">
              <StorefrontIcon name="user" size={18} />
            </Link>
          ) : null}
          {/* Modul-gatingen är HELIG: korgen ritas bara när shopen är live. */}
          {p.cartEnabled ? <CartNavButton className={styles.snNavCart} /> : null}
          {p.primaryCta ? (
            <Link href={p.primaryCta.href} className={styles.snNavCta}>
              {p.primaryCta.label}
            </Link>
          ) : (
            <BookCta className={styles.snNavCta} label="Boka nu" />
          )}
        </div>
      </header>
    </>
  )
}

export function SnittFooter(p: ThemeFooterProps) {
  return (
    <footer className={styles.snFoot}>
      <div className={styles.snFootRow}>
        <div>
          <p className={styles.snFootMark}>
            <span data-tenant-name data-corevo-editor-field="tenant.name"
              data-corevo-editor-stable-field="tenant.name">{p.tenant.name}</span>
            <span className={styles.snDot}>.</span>
          </p>
          <p className={styles.snFootTagline}>
            <span data-corevo-editor-field="tagline"
              data-corevo-editor-stable-field="tagline">{p.tagline}</span>
            <span data-corevo-fact-group="location.address" hidden={!p.location?.address}>
              {' · '}
              <span data-corevo-editor-field="location.address"
                data-corevo-editor-stable-field="location.address">{p.location?.address ?? ''}</span>
            </span>
          </p>
          <SocialButtons links={socialLinks(p.social, true)} editorStable />
        </div>

        <nav className={styles.snFootNav} aria-label="Sidfotsmeny">
          {p.links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        <p className={styles.snFootMeta}>
          © {new Date().getFullYear()}{' '}
          <span data-tenant-name data-corevo-editor-field="tenant.name"
            data-corevo-editor-stable-field="tenant.name">{p.tenant.name}</span> · Byggd med Corevo
        </p>
      </div>
    </footer>
  )
}
