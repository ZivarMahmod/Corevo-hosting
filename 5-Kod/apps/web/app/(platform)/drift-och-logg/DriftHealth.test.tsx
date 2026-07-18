import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DriftHealth } from './DriftHealth'

describe('DriftHealth', () => {
  it('renders successful and failed cron runs with honest status badges', () => {
    const html = renderToStaticMarkup(
      <DriftHealth
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
  })

  it('uses an honest empty state when cron has no registered jobs', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={[]} />)

    expect(html).toContain('Inga cron-jobb hittades')
    expect(html).toContain('Det finns inga registrerade jobb att visa just nu.')
  })

  it('keeps the audit log available when the health read fails', () => {
    const html = renderToStaticMarkup(<DriftHealth rows={null} />)

    expect(html).toContain('Kunde inte läsa drift-hälsan')
    expect(html).toContain('Audit-loggen påverkas inte av detta.')
  })
})
