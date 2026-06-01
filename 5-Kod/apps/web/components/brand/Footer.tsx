import Link from 'next/link'
import { NAV_LINKS } from './NavLinks'
import { BookCta } from './BookCta'
import styles from './brand.module.css'

/** White-label footer — tenant name only, never any Corevo branding.
 *  Adds a quiet link row + the gold Boka CTA so the page closes with the
 *  primary action; still tenant-themed (all colour via tokens). */
export function Footer({ tenant }: { tenant: { name: string } }) {
  return (
    <footer className={`footer ${styles.footer}`}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <span className={styles.footerName}>{tenant.name}</span>
          <BookCta />
        </div>
        <nav className={styles.footerLinks} aria-label="Sidfot">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className={styles.footerLegal}>
        © {new Date().getFullYear()} {tenant.name}
      </p>
    </footer>
  )
}
