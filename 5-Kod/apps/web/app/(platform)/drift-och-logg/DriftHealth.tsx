import type { Database } from '@corevo/db'
import { Badge, Card, EmptyState, Stat } from '@/components/portal/ui'
import styles from './drift.module.css'

export type CronHealthRow = Database['public']['Functions']['platform_cron_health']['Returns'][number]

const fmtTime = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Stockholm',
})

function statusFor(row: CronHealthRow): { label: string; tone: 'success' | 'danger' } {
  if (!row.active) return { label: 'Avstängt', tone: 'danger' }
  if (row.last_status === 'succeeded') return { label: 'Senast lyckad', tone: 'success' }
  if (row.last_status === 'failed') return { label: 'Misslyckades', tone: 'danger' }
  if (!row.last_status) return { label: 'Ingen körning', tone: 'danger' }
  return { label: row.last_status, tone: 'danger' }
}

function startTime(value: string | null): string {
  return value ? fmtTime.format(new Date(value)) : 'Ingen körning registrerad'
}

/** Server-safe read model for the platform-admin-only platform_cron_health RPC. */
export function DriftHealth({ rows }: { rows: readonly CronHealthRow[] | null }) {
  if (rows === null) {
    return (
      <section className={styles.healthSection} aria-labelledby="drift-halsa">
        <Card>
          <h2 id="drift-halsa" className="h2">Kunde inte läsa drift-hälsan</h2>
          <p className={styles.healthError}>
            Försök igen om en stund. Audit-loggen påverkas inte av detta.
          </p>
        </Card>
      </section>
    )
  }

  const needsAttention = rows.filter((row) => statusFor(row).tone === 'danger').length

  return (
    <section className={styles.healthSection} aria-labelledby="drift-halsa">
      <div className={styles.healthHead}>
        <div>
          <p className="eyebrow">Plattform</p>
          <h2 id="drift-halsa" className="h2">Drift-hälsa</h2>
          <p className={styles.healthLede}>Senaste körningen för plattformens schemalagda jobb.</p>
        </div>
      </div>

      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Schemalagda jobb" value={rows.length} icon="repeat" />
        <Stat
          label="Kräver kontroll"
          value={needsAttention}
          delta={needsAttention === 0 ? 'Alla registrerade jobb har senaste lyckade körning.' : undefined}
          deltaTone={needsAttention === 0 ? 'success' : 'muted'}
          icon="alert"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="Inga cron-jobb hittades"
          text="Det finns inga registrerade jobb att visa just nu."
        />
      ) : (
        <Card pad={0}>
          <div className={styles.healthTable} role="table" aria-label="Cron-jobbens hälsa">
            <div className={`${styles.healthRow} ${styles.healthColumns} ${styles.healthTableHead}`} role="row">
              <span role="columnheader">Jobb</span>
              <span role="columnheader">Schema</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Starttid</span>
            </div>
            {rows.map((row) => {
              const status = statusFor(row)
              return (
                <div key={row.jobname} className={`${styles.healthRow} ${styles.healthColumns}`} role="row">
                  <strong role="cell">{row.jobname}</strong>
                  <code role="cell" className={styles.schedule}>{row.schedule}</code>
                  <span role="cell"><Badge tone={status.tone}>{status.label}</Badge></span>
                  <span role="cell" className={`num ${styles.healthTime}`}>{startTime(row.last_start)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </section>
  )
}
