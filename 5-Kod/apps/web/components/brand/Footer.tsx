import styles from './brand.module.css'

/**
 * MiniFooter — the compact, centered footer used by four of the five themes
 * (leander / zigge / linnea / edit) AND by the booking + cancel routes
 * (app/boka, app/avboka) which import this component directly.
 *
 * Signature is load-bearing: boka/avboka render `<Footer tenant={{ name }} />`,
 * so the props MUST stay `{ tenant: { name } }`. It is theme-flexed purely via CSS
 * ([data-theme] in brand.module.css) — no theme prop needed. White-label always:
 * tenant name only, never any Corevo branding.
 *
 * Salvia's home page uses the richer 3-column FooterFull instead (chosen in
 * app/(public)/layout.tsx, where the full bundle incl. location is available).
 */
export function Footer({ tenant }: { tenant: { name: string } }) {
  return (
    <footer className={`footer ${styles.miniFooter}`}>
      <div className={styles.miniWordmark}>{tenant.name}</div>
      <div className={styles.miniTagline}>Boka tid online · {tenant.name}</div>
      <div className={styles.miniSign}>Designad med omsorg</div>
      <p className={styles.miniLegal}>
        © {new Date().getFullYear()} {tenant.name}
      </p>
    </footer>
  )
}
