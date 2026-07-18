import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UtskickCenter, type OutboxRow, type OutboxSummaryRow } from './UtskickCenter'

const summary: OutboxSummaryRow[] = [
  {
    tenant_id: 'tenant-a',
    slug: 'foretag-a',
    name: 'Företag A',
    sent_30d: 10,
    failed_30d: 1,
    skipped_30d: 3,
    sms_cost_ore_30d: 1234,
    customers_total: 10,
    prefs_rows: 8,
    push_subs_active: 3,
  },
  {
    tenant_id: 'tenant-b',
    slug: 'foretag-b',
    name: 'Företag B',
    sent_30d: 2,
    failed_30d: 0,
    skipped_30d: 0,
    sms_cost_ore_30d: 66,
    customers_total: 0,
    prefs_rows: 0,
    push_subs_active: 0,
  },
]

const rows: OutboxRow[] = [
  {
    id: 'row-a',
    tenant_id: 'tenant-a',
    tenant_slug: 'foretag-a',
    tenant_name: 'Företag A',
    event_type: 'booking.reminder',
    category: 'transactional',
    chosen_channel: 'sms',
    status: 'failed',
    cost_ore: 125,
    skip_reason: 'provider_rejected',
    provider_ref: 'provider.sms.123',
    created_at: '2026-07-18T08:30:00.000Z',
    sent_at: null,
    delivered_at: null,
  },
]

const noFilters = { tenant: '', channel: '', status: '', category: '' }

describe('UtskickCenter', () => {
  it('renders honest 30-day totals, adoption and PII-free delivery detail', () => {
    const html = renderToStaticMarkup(
      <UtskickCenter
        summary={summary}
        rows={rows}
        filters={noFilters}
        summaryError={false}
        rowsError={false}
      />,
    )

    expect(html).toContain('Skickade 30 dagar')
    expect(html).toContain('>12<')
    expect(html).toContain('Misslyckade 30 dagar')
    expect(html).toContain('>1<')
    expect(html).toContain('Överhoppade 30 dagar')
    expect(html).toContain('>3<')
    expect(html).toContain('13,00')
    expect(html).toContain('Adoption per företag')
    expect(html).toContain('Företag A')
    expect(html).toContain('8 / 10')
    expect(html).toContain('3 / 10')
    expect(html).toContain('30 %')
    expect(html).toContain('booking.reminder')
    expect(html).toContain('transactional')
    expect(html).toContain('sms')
    expect(html).toContain('Misslyckades')
    expect(html).toContain('var(--c-danger-bg)')
    expect(html).toContain('1,25')
    expect(html).toContain('provider_rejected')
    expect(html).toContain('provider.sms.123')
  })

  it('keeps server-side filter values in the GET form', () => {
    const html = renderToStaticMarkup(
      <UtskickCenter
        summary={summary}
        rows={rows}
        filters={{ tenant: 'tenant-a', channel: 'sms', status: 'failed', category: 'transactional' }}
        summaryError={false}
        rowsError={false}
      />,
    )

    expect(html).toContain('method="get"')
    expect(html).toContain('value="tenant-a" selected=""')
    expect(html).toContain('name="channel" value="sms"')
    expect(html).toContain('name="status" value="failed"')
    expect(html).toContain('name="category" value="transactional"')
    expect(html).toContain('Rensa filter')
  })

  it('shows distinct honest empty and error states', () => {
    const empty = renderToStaticMarkup(
      <UtskickCenter
        summary={[]}
        rows={[]}
        filters={noFilters}
        summaryError={false}
        rowsError={false}
      />,
    )
    const filtered = renderToStaticMarkup(
      <UtskickCenter
        summary={summary}
        rows={[]}
        filters={{ ...noFilters, status: 'failed' }}
        summaryError={false}
        rowsError={false}
      />,
    )
    const errors = renderToStaticMarkup(
      <UtskickCenter
        summary={null}
        rows={null}
        filters={noFilters}
        summaryError
        rowsError
      />,
    )

    expect(empty).toContain('Inga utskick ännu')
    expect(filtered).toContain('Inga utskick matchar filtren')
    expect(errors).toContain('Kunde inte läsa utskickssammanställningen')
    expect(errors).toContain('Kunde inte läsa utskicksraderna')
  })
})
