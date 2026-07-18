import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DriftHealth } from './DriftHealth'

const healthySnapshot = {
  tenant_id: null,
  routing_count: 0,
  queued_count: 2,
  attempting_count: 1,
  delivery_started_count: 0,
  stalled_count: 0,
  failed_24h_count: 0,
  oldest_ready_at: '2026-07-18T08:20:00.000Z',
  scheduler_name: 'cloudflare-reminders-primary',
  scheduler_last_status: 'succeeded',
  scheduler_last_started_at: '2026-07-18T08:29:00.000Z',
  scheduler_last_succeeded_at: '2026-07-18T08:30:00.000Z',
  scheduler_last_failed_at: null,
  scheduler_last_error_code: null,
  scheduler_updated_at: '2026-07-18T08:30:00.000Z',
  scheduler_age_seconds: 60,
  scheduler_healthy: true,
} as const

describe('DriftHealth', () => {
  it('renders successful and failed cron runs with honest status badges', () => {
    const html = renderToStaticMarkup(
      <DriftHealth
        snapshot={healthySnapshot}
        rows={[
          {
            jobname: 'scheduler',
            schedule: '* * * * *',
            active: true,
            last_status: 'succeeded',
            last_start: '2026-07-18T08:30:00.000Z',
            last_duration_ms: 1200,
            last_message: 'ok',
          },
          {
            jobname: 'notifications',
            schedule: '*/5 * * * *',
            active: true,
            last_status: 'failed',
            last_start: '2026-07-18T08:25:00.000Z',
            last_duration_ms: 900,
            last_message: 'provider unavailable',
          },
        ]}
      />,
    )

    expect(html).toContain('Drift-hälsa')
    expect(html).toContain('Senast lyckad')
    expect(html).toContain('Misslyckades')
    expect(html).toContain('scheduler')
    expect(html).toContain('notifications')
    expect(html).toContain('1,2 s')
    expect(html).not.toContain('provider unavailable')
    expect(html).toContain('Köade totalt')
    expect(html).toContain('Cloudflare-svep')
    expect(html).toContain('Aktuell heartbeat')
  })

  it('shows an in-progress sweep without downgrading a canonically healthy heartbeat', () => {
    const html = renderToStaticMarkup(
      <DriftHealth
        rows={[]}
        snapshot={{ ...healthySnapshot, scheduler_last_status: 'started' }}
      />,
    )

    expect(html).toContain('Svep pågår')
    expect(html).not.toContain('Aktuell heartbeat')
    expect(html).not.toContain('Heartbeat ej kvitterad')
  })

  it('uses an honest empty state when cron has no registered jobs', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={[]} snapshot={healthySnapshot} />)

    expect(html).toContain('Inga cron-jobb hittades')
    expect(html).toContain('Det finns inga registrerade jobb att visa just nu.')
    expect(html).not.toContain('Alla registrerade jobb har senaste lyckade körning.')
  })

  it('keeps the audit log available when the health read fails', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={null} snapshot={healthySnapshot} />)

    expect(html).toContain('Drift-hälsan är delvis tillgänglig')
    expect(html).toContain('Audit-loggen påverkas inte av detta.')
    expect(html).toContain('Cloudflare-svep')
  })

  it.each([
    ['misslyckad', { ...healthySnapshot, scheduler_last_status: 'failed', scheduler_healthy: false }],
    ['sen', { ...healthySnapshot, scheduler_age_seconds: 3600, scheduler_healthy: false }],
    [
      'saknad',
      {
        ...healthySnapshot,
        scheduler_name: null,
        scheduler_last_status: null,
        scheduler_last_succeeded_at: null,
        scheduler_updated_at: null,
        scheduler_age_seconds: null,
        scheduler_healthy: false,
      },
    ],
  ])('never presents a %s scheduler heartbeat as green', (_case, snapshot) => {
    const html = renderToStaticMarkup(<DriftHealth rows={[]} snapshot={snapshot} />)

    expect(html).not.toContain('Aktuell heartbeat')
    expect(html).toMatch(/Misslyckad heartbeat|Sen heartbeat|Heartbeat saknas/)
  })

  it('uses an honest empty state when the outbox queue has no work or recent failures', () => {
    const html = renderToStaticMarkup(
      <DriftHealth
        rows={[]}
        snapshot={{
          ...healthySnapshot,
          queued_count: 0,
          attempting_count: 0,
          failed_24h_count: 0,
        }}
      />,
    )

    expect(html).toContain('Outbox-kön är tom')
    expect(html).not.toContain('Kön är frisk')
  })

  it('keeps cron and audit-log guidance available when the queue read fails', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={[]} snapshot={null} />)

    expect(html).toContain('Drift-hälsan är delvis tillgänglig')
    expect(html).toContain('Inga cron-jobb hittades')
    expect(html).toContain('Audit-loggen påverkas inte av detta.')
  })

  it('renders an explicit error while leaving the audit log available when all health reads fail', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={null} snapshot={null} />)

    expect(html).toContain('Kunde inte läsa drift-hälsan')
    expect(html).toContain('Audit-loggen påverkas inte av detta.')
  })
})
