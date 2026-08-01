import styles from './platform.module.css'
import type { DomainOverview as Overview, DomainRow } from '@/lib/platform/domain-overview'

// goal-32 F3 — super-admin "Domäner" overview. Lists the 3 fixed infra hosts + every
// tenantens <slug>.boka.corevo.se with an honest status pill. Presentational only;
// reuses the platform.module.css domain primitives (.domainList/.domainRow/.pillOk/
// .pillPending) that the per-tenant DomänPanel already uses.

function StatusPill({ status }: { status: DomainRow['status'] }) {
  if (status === 'live') return <span className={styles.pillOk}>Live</span>
  if (status === 'cert_pending') return <span className={styles.pillPending}>Cert väntar</span>
  // 'managed' — DB-driven, re-asserted on every deploy. We can't read CF without a
  // token, so we don't claim "live"; check_domains verifies live HTTP offline.
  return <span className={styles.pillOk}>Hanteras · deploy</span>
}

export function DomainOverview({ overview }: { overview: Overview }) {
  const { rows, fixedHosts } = overview

  return (
    <div>
      <div className={styles.section}>
        <p className={styles.muted} style={{ marginTop: 0 }}>
          Standardadresserna går genom den committade, POS-isolerade wildcard-routen
          <code className={styles.code}> *.boka.corevo.se</code>. Live-HTTP verifieras av
          check_domains efter deploy.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Fasta infra-hosts</h2>
        </div>
        <ul className={styles.domainList}>
          {fixedHosts.map((host) => (
            <li key={host} className={styles.domainRow}>
              <code className={styles.code}>{host}</code>
              <span style={{ flex: 1 }} />
              <span className={styles.pillOk}>Infra · alltid</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Kunddomäner ({rows.length})</h2>
        </div>
        {rows.length === 0 ? (
          <p className={styles.muted}>Inga aktiva kunder ännu.</p>
        ) : (
          <ul className={styles.domainList}>
            {rows.map((r) => (
              <li key={r.slug} className={styles.domainRow}>
                <code className={styles.code}>{r.domain}</code>
                <span className={styles.muted}>{r.name}</span>
                <span style={{ flex: 1 }} />
                {r.tenantStatus === 'suspended' && (
                  <span className={`${styles.badge} ${styles.badgeSuspended}`}>Pausad</span>
                )}
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
