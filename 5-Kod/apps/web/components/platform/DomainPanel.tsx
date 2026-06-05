import styles from './platform.module.css'
import { listTenantDomains } from '@/lib/platform/domains'
import { DomainManager } from './DomainManager'

// Step 5 — Kundens EGNA domän (goal-23). Two states, gated by DOMAIN_PROVISIONING_ENABLED:
//
//  • flag OFF (default, prod today): the honest ⛔-banner + disabled fieldset. NO
//    Cloudflare call, NO tenant_domains write — unchanged from before goal-23.
//  • flag ON (Zivar sets it after provisioning CF_API_TOKEN/CF_ZONE_ID): the live
//    DomainManager — add a custom domain → Cloudflare for SaaS custom hostname →
//    tenant_domains row → DCV instructions → verify → status. See docs/ops/custom-domains-ops.md.
//
// The resolution read (0019 resolve_tenant_by_domain) is unaffected either way.

const ENABLED = process.env.DOMAIN_PROVISIONING_ENABLED === 'true'

export async function DomainPanel({ slug, tenantId }: { slug: string; tenantId: string }) {
  if (ENABLED) {
    const domains = await listTenantDomains(tenantId)
    return <DomainManager slug={slug} tenantId={tenantId} initialDomains={domains} />
  }

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
