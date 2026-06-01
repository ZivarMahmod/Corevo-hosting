import styles from './platform.module.css'

// Step 5 — Kundens EGNA domän. SPÄRRAD (domän-spärr, G08).
//
// Tenants run live ONLY on *.corevo.se subdomains. Provisioning a customer's own
// domain (CNAME / Cloudflare custom hostname) is HARD-DISABLED behind
// DOMAIN_PROVISIONING_ENABLED. This panel is UI ONLY: it shows the planned CNAME
// instruction + a status placeholder and fires NO Cloudflare call and writes NO
// tenant_domains row (that table has no status column to represent
// blocked/pending_manual anyway). The fields are disabled; there is no submit.

const ENABLED = process.env.DOMAIN_PROVISIONING_ENABLED === 'true'

export function DomainPanel({ slug }: { slug: string }) {
  return (
    <div>
      <div className={styles.banner}>
        <p className={styles.bannerTitle}>⛔ DO NOT RUN YET — egen domän är spärrad</p>
        <p className={styles.muted} style={{ margin: 0 }}>
          Salongen körs live på <code className={styles.code}>{slug}.corevo.se</code>. Kundens egna
          domän (CNAME / custom hostname) provisioneras <strong>inte</strong> automatiskt. Inget
          Cloudflare-anrop går iväg och ingen domänrad skapas. Flagga{' '}
          <code className={styles.code}>DOMAIN_PROVISIONING_ENABLED</code> ={' '}
          <strong>{String(ENABLED)}</strong> (kräver manuell drift av Zivar även när den är på).
        </p>
      </div>

      <fieldset className={`${styles.form} ${styles.lockedField}`} disabled aria-disabled="true">
        <label className={styles.field}>
          <span>Kundens domän</span>
          <input name="custom_domain" placeholder="boka.salongnamn.se" disabled />
        </label>
        <label className={styles.field}>
          <span>Planerad CNAME (sätts hos kundens DNS-leverantör)</span>
          <input
            readOnly
            disabled
            value={`${slug}.corevo.se`}
            aria-label="CNAME-mål"
          />
          <span className={styles.hint}>
            CNAME <code className={styles.code}>boka</code> →{' '}
            <code className={styles.code}>{slug}.corevo.se</code>. Verifiering + custom hostname körs
            manuellt först när spärren hävs.
          </span>
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} disabled>
            Status: blocked / pending_manual
          </button>
        </div>
      </fieldset>
    </div>
  )
}
