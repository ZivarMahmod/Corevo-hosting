import { Badge, type BadgeTone } from '@/components/portal/ui'
import type { IntegrationWithCount } from '@/lib/platform/catalog'
import styles from './IntegrationsGrid.module.css'

/**
 * Integrationer card grid (goal-17 PLATFORM). Card per integration with letter-avatar
 * + name + tenants-line + derived status Badge, then desc / flow-chip.
 *
 * Plain server-renderable component: the dead "Hantera" (toast-only) and "Docs" (no
 * onClick/href) controls were removed in the ärlighetspass (#4/#5) — there is no real
 * target for either, so an honest gone beats a fake button. The server page does the
 * `getPlatformIntegrations()` read (RLS-bypass) and hands the array down here.
 *
 * HONEST COUNTS + BADGE (NEVER FAKE DATA, #13): the tenants-line shows the LIVE
 * "{connected} / {total} anslutna" ONLY where a backing column exists (connected !==
 * null — Stripe/Google/Domän). For those cards the status Badge is DERIVED from the
 * real count (connected > 0 → "Aktiv", === 0 → "Inaktiv") — never the mock's
 * hardcoded "Aktiv". Where no per-tenant column backs the integration (SMS/E-post/POS
 * → connected === null) we render the honest neutral label and NO badge at all.
 */

/** The honest tenants-line: live count where backed, neutral label otherwise. */
function tenantsLine(it: IntegrationWithCount) {
  if (it.connected === null) {
    // No per-tenant backing column — never fabricate a count.
    return <span className={styles.tenants}>Plattformsbred · ingen per-kund-status</span>
  }
  return (
    <span className={styles.tenants}>
      <span className="num">
        {it.connected} / {it.total}
      </span>{' '}
      anslutna
    </span>
  )
}

/** Derived status badge from the REAL connected count (#13). Cards with no backing
 *  column (connected === null) get NO badge — never a hardcoded "Aktiv". */
function statusBadge(it: IntegrationWithCount) {
  if (it.connected === null) return null
  const active = it.connected > 0
  const tone: BadgeTone = active ? 'success' : 'neutral'
  return <Badge tone={tone}>{active ? 'Aktiv' : 'Inaktiv'}</Badge>
}

export function IntegrationsGrid({ integrations }: { integrations: IntegrationWithCount[] }) {
  return (
    <div className={styles.grid}>
      {integrations.map((it) => (
        <div key={it.id} className={styles.card}>
          <div className={styles.head}>
            <div className={styles.ident}>
              <div className={styles.avatar} style={{ background: it.color }} aria-hidden="true">
                {it.letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.name}>{it.name}</div>
                {tenantsLine(it)}
              </div>
            </div>
            {statusBadge(it)}
          </div>

          <p className={styles.desc}>{it.desc}</p>

          <div className={styles.flow}>
            <span className={styles.chip} title={it.flow}>
              {it.flow}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
