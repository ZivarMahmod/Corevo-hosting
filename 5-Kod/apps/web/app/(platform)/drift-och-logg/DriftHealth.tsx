import type { Database } from '@corevo/db'
import { Badge, Card, EmptyState, Stat } from '@/components/portal/ui'
import styles from './drift.module.css'

export type CronHealthRow = Database['public']['Functions']['platform_cron_health']['Returns'][number]
export type DriftHealthSnapshot = Database['public']['Functions']['platform_drift_health']['Returns'][number]

const fmtTime = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Stockholm',
})
const fmtDecimal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 })

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

function duration(value: number | null): string {
  if (value === null) return '–'
  if (value < 1000) return `${value} ms`
  return `${fmtDecimal.format(value / 1000)} s`
}

function safeMessage(value: string | null): string | null {
  if (!value) return null
  const firstLine = value.split(/\r?\n/, 1)[0] ?? ''
  return firstLine
    .replace(/https?:\/\/\S+/gi, '[url maskerad]')
    .replace(/\b(bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, '$1: [maskerat]')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 160) || null
}

function heartbeatStatus(snapshot: DriftHealthSnapshot): {
  label: string
  tone: 'success' | 'danger'
} {
  if (!snapshot.scheduler_name || !snapshot.scheduler_last_status) {
    return { label: 'Heartbeat saknas', tone: 'danger' }
  }
  if (snapshot.scheduler_healthy) return { label: 'Aktuell heartbeat', tone: 'success' }
  if (snapshot.scheduler_last_status === 'failed') {
    return { label: 'Misslyckad heartbeat', tone: 'danger' }
  }
  if (snapshot.scheduler_age_seconds === null || snapshot.scheduler_age_seconds > 2100) {
    return { label: 'Sen heartbeat', tone: 'danger' }
  }
  return { label: 'Heartbeat ej kvitterad', tone: 'danger' }
}

function QueueHealth({ snapshot }: { snapshot: DriftHealthSnapshot }) {
  const activeCount =
    snapshot.routing_count +
    snapshot.queued_count +
    snapshot.attempting_count +
    snapshot.delivery_started_count
  const attentionCount = snapshot.stalled_count + snapshot.failed_24h_count

  return (
    <section className={styles.healthBlock} aria-labelledby="outbox-halsa">
      <div className={styles.subhead}>
        <div>
          <h3 id="outbox-halsa" className="h3">Outbox-kö</h3>
          <p className={styles.healthLede}>Aktuell leveranskö utan mottagare eller payload.</p>
        </div>
        {attentionCount > 0 && <Badge tone="danger">{attentionCount} kräver kontroll</Badge>}
      </div>

      <div className="bo-stat-grid" style={{ marginBottom: 14 }}>
        <Stat label="Redo nu" value={snapshot.queued_count} icon="mail" />
        <Stat label="Pågående" value={snapshot.attempting_count} icon="repeat" />
        <Stat label="Fastnade" value={snapshot.stalled_count} icon="alert" />
        <Stat label="Misslyckade 24 h" value={snapshot.failed_24h_count} icon="alert" />
      </div>

      {activeCount === 0 && snapshot.failed_24h_count === 0 ? (
        <EmptyState
          icon="mail"
          title="Outbox-kön är tom"
          text="Inga aktiva leveranser eller misslyckanden senaste 24 timmarna."
        />
      ) : (
        <Card>
          <dl className={styles.healthFacts}>
            <div><dt>Väntar på routing</dt><dd className="num">{snapshot.routing_count}</dd></div>
            <div><dt>Leverans startad</dt><dd className="num">{snapshot.delivery_started_count}</dd></div>
            <div><dt>Äldsta redo</dt><dd>{startTime(snapshot.oldest_ready_at)}</dd></div>
          </dl>
        </Card>
      )}
    </section>
  )
}

function SchedulerHealth({ snapshot }: { snapshot: DriftHealthSnapshot }) {
  const status = heartbeatStatus(snapshot)
  return (
    <section className={styles.healthBlock} aria-labelledby="scheduler-halsa">
      <div className={styles.subhead}>
        <div>
          <h3 id="scheduler-halsa" className="h3">Cloudflare-svep</h3>
          <p className={styles.healthLede}>Senaste heartbeat från plattformens reminder-scheduler.</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <Card>
        <dl className={styles.healthFacts}>
          <div><dt>Status</dt><dd>{snapshot.scheduler_last_status ?? '–'}</dd></div>
          <div><dt>Senast startad</dt><dd>{startTime(snapshot.scheduler_last_started_at)}</dd></div>
          <div><dt>Senast lyckad</dt><dd>{startTime(snapshot.scheduler_last_succeeded_at)}</dd></div>
          <div><dt>Senast misslyckad</dt><dd>{startTime(snapshot.scheduler_last_failed_at)}</dd></div>
          <div><dt>Felkod</dt><dd><code>{snapshot.scheduler_last_error_code ?? '–'}</code></dd></div>
        </dl>
      </Card>
    </section>
  )
}

function CronHealth({ rows }: { rows: readonly CronHealthRow[] }) {
  const needsAttention = rows.filter((row) => statusFor(row).tone === 'danger').length
  return (
    <section className={styles.healthBlock} aria-labelledby="cron-halsa">
      <div className={styles.subhead}>
        <div>
          <h3 id="cron-halsa" className="h3">Databasjobb</h3>
          <p className={styles.healthLede}>Senaste körningen för registrerade pg_cron-jobb.</p>
        </div>
      </div>
      <div className="bo-stat-grid" style={{ marginBottom: 14 }}>
        <Stat label="Schemalagda jobb" value={rows.length} icon="repeat" />
        <Stat
          label="Kräver kontroll"
          value={needsAttention}
          delta={rows.length > 0 && needsAttention === 0 ? 'Alla registrerade jobb har senaste lyckade körning.' : undefined}
          deltaTone={rows.length > 0 && needsAttention === 0 ? 'success' : 'muted'}
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
              <span role="columnheader">Senaste körning</span>
            </div>
            {rows.map((row) => {
              const status = statusFor(row)
              const message = safeMessage(row.last_message)
              return (
                <div key={row.jobname} className={`${styles.healthRow} ${styles.healthColumns}`} role="row">
                  <strong role="cell">{row.jobname}</strong>
                  <code role="cell" className={styles.schedule}>{row.schedule}</code>
                  <span role="cell"><Badge tone={status.tone}>{status.label}</Badge></span>
                  <span role="cell" className={styles.runDetail}>
                    <span className={`num ${styles.healthTime}`}>{startTime(row.last_start)} · {duration(row.last_duration_ms)}</span>
                    {message && (
                      <span className={styles.healthMessage}>
                        <span className={styles.visuallyHidden}>Meddelande: </span>
                        {message}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </section>
  )
}

/** Server-safe read model for platform-admin-only drift RPCs. */
export function DriftHealth({
  rows,
  snapshot,
}: {
  rows: readonly CronHealthRow[] | null
  snapshot: DriftHealthSnapshot | null
}) {
  if (rows === null && snapshot === null) {
    return (
      <section className={styles.healthSection} aria-labelledby="drift-halsa">
        <Card>
          <h2 id="drift-halsa" className="h2">Kunde inte läsa drift-hälsan</h2>
          <p className={styles.healthError}>Försök igen om en stund. Audit-loggen påverkas inte av detta.</p>
        </Card>
      </section>
    )
  }

  const partial = rows === null || snapshot === null
  return (
    <section className={styles.healthSection} aria-labelledby="drift-halsa">
      <div className={styles.healthHead}>
        <div>
          <p className="eyebrow">Plattform</p>
          <h2 id="drift-halsa" className="h2">Drift-hälsa</h2>
          <p className={styles.healthLede}>Kö, scheduler-heartbeat och databasjobb i en serverläst vy.</p>
        </div>
      </div>
      {partial && (
        <Card>
          <h3 className="h3">Drift-hälsan är delvis tillgänglig</h3>
          <p className={styles.healthError}>En hälsokälla kunde inte läsas. Audit-loggen påverkas inte av detta.</p>
        </Card>
      )}
      {snapshot ? (
        <>
          <QueueHealth snapshot={snapshot} />
          <SchedulerHealth snapshot={snapshot} />
        </>
      ) : (
        <Card><p className={styles.healthError}>Kö- och scheduler-hälsan kunde inte läsas.</p></Card>
      )}
      {rows ? (
        <CronHealth rows={rows} />
      ) : (
        <Card><p className={styles.healthError}>Cron-hälsan kunde inte läsas.</p></Card>
      )}
    </section>
  )
}
