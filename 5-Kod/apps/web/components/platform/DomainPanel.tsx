import styles from './platform.module.css'
import { listTenantDomains } from '@/lib/platform/domains'
import { DomainManager } from './DomainManager'
import { tenantStorefrontHost } from '@/lib/storefront-url'

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

  // Dunder-fix 2026-07-11: det gamla disabled-formuläret (input + död status-
  // knapp) såg ut som trasig UI — spärrad funktion visas som text, inte som
  // kontroller man inte kan röra.
  return (
    <div className={styles.banner}>
      <p className={styles.bannerTitle}>Egen domän — inte påkopplat ännu</p>
      <p className={styles.muted} style={{ margin: 0 }}>
        Standardadressen är <code className={styles.code}>{tenantStorefrontHost(slug)}</code>. Egen domän
        (t.ex. <code className={styles.code}>boka.exempel.se</code> via CNAME) är ett parkerat
        spår och slås på av drift (flagga{' '}
        <code className={styles.code}>DOMAIN_PROVISIONING_ENABLED</code>) — då dyker
        domänhanteraren upp här.
      </p>
    </div>
  )
}
