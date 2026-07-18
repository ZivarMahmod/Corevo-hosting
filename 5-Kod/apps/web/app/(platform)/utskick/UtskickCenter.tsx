import type { Database } from '@corevo/db'
import { Badge, Button, Card, EmptyState, PageHead, Stat, type BadgeTone } from '@/components/portal/ui'
import styles from './utskick.module.css'

export type OutboxSummaryRow =
  Database['public']['Functions']['platform_outbox_summary']['Returns'][number]
export type OutboxRow =
  Database['public']['Functions']['platform_outbox_rows']['Returns'][number]

export type UtskickFilters = {
  tenant: string
  channel: string
  status: string
  category: string
}

const NUMBER = new Intl.NumberFormat('sv-SE')
const KR = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function UtskickCenter({
  summary,
  rows,
  filters,
  summaryError,
  rowsError,
}: {
  summary: OutboxSummaryRow[] | null
  rows: OutboxRow[] | null
  filters: UtskickFilters
  summaryError: boolean
  rowsError: boolean
}) {
  const totals = (summary ?? []).reduce(
    (sum, row) => ({
      sent: sum.sent + row.sent_30d,
      failed: sum.failed + row.failed_30d,
      skipped: sum.skipped + row.skipped_30d,
      costOre: sum.costOre + row.sms_cost_ore_30d,
    }),
    { sent: 0, failed: 0, skipped: 0, costOre: 0 },
  )
  const filtered = Object.values(filters).some(Boolean)
  const channels = dimensions(rows, filters.channel, (row) => row.chosen_channel)
  const statuses = dimensions(rows, filters.status, (row) => row.status)
  const categories = dimensions(rows, filters.category, (row) => row.category)

  return (
    <div>
      <PageHead
        eyebrow="Insyn"
        title="Utskick"
        lede="Följ leveransstatus, kostnad och kanalval tvärs alla företag utan att visa mottagardata."
      />

      <div className="bo-stat-grid">
        <Stat
          label="Skickade 30 dagar"
          value={<span className="num">{summaryError ? '—' : NUMBER.format(totals.sent)}</span>}
          icon="checkCircle"
        />
        <Stat
          label="Misslyckade 30 dagar"
          value={<span className="num">{summaryError ? '—' : NUMBER.format(totals.failed)}</span>}
          icon="alert"
        />
        <Stat
          label="Överhoppade 30 dagar"
          value={<span className="num">{summaryError ? '—' : NUMBER.format(totals.skipped)}</span>}
          icon="block"
        />
        <Stat
          label="SMS-kostnad 30 dagar"
          value={<span className="num">{summaryError ? '—' : formatOre(totals.costOre)}</span>}
          icon="dollar"
          hint="Outboxens registrerade kostnad"
        />
      </div>

      <section className={styles.section}>
        <SectionHead
          title="Adoption per företag"
          text="Preferensrader och aktiva push-prenumerationer mot aktiva slutkunder."
        />
        {summaryError ? (
          <EmptyState
            icon="alert"
            title="Kunde inte läsa utskickssammanställningen"
            text="Detaljraderna nedan kan fortfarande vara tillgängliga. Försök igen senare."
          />
        ) : summary?.length ? (
          <Card pad={0}>
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Företag</th>
                    <th>Skickade</th>
                    <th>Misslyckade</th>
                    <th>Överhoppade</th>
                    <th>SMS-kostnad</th>
                    <th>Preferenser</th>
                    <th data-last="">Aktiv push</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.tenant_id}>
                      <td>
                        <strong>{row.name}</strong>
                        <span className={styles.sub}>{row.slug}</span>
                      </td>
                      <td className="num">{NUMBER.format(row.sent_30d)}</td>
                      <td className="num">{NUMBER.format(row.failed_30d)}</td>
                      <td className="num">{NUMBER.format(row.skipped_30d)}</td>
                      <td className="num">{formatOre(row.sms_cost_ore_30d)}</td>
                      <td>
                        <span className="num">{NUMBER.format(row.prefs_rows)} / {NUMBER.format(row.customers_total)}</span>
                        <span className={styles.sub}>{adoptionPercent(row.prefs_rows, row.customers_total)}</span>
                      </td>
                      <td data-last="" className="num">{NUMBER.format(row.push_subs_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon="building"
            title="Ingen adoption att sammanställa"
            text="När det finns aktiva företag visas deras preferens- och push-adoption här."
          />
        )}
      </section>

      <section className={styles.section}>
        <SectionHead
          title="Senaste utskicksraderna"
          text="Filtreringen körs på servern och visar högst 100 senast skapade rader."
        />
        <form method="get" className={styles.filters} aria-label="Filtrera utskick">
          <label className={styles.field}>
            <span className={styles.label}>Företag</span>
            <select className={styles.control} name="tenant" defaultValue={filters.tenant}>
              <option value="">Alla företag</option>
              {(summary ?? []).map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>{tenant.name}</option>
              ))}
            </select>
          </label>
          <FilterInput label="Kanal" name="channel" value={filters.channel} values={channels} />
          <FilterInput label="Status" name="status" value={filters.status} values={statuses} />
          <FilterInput label="Kategori" name="category" value={filters.category} values={categories} />
          <div className={styles.actions}>
            <Button type="submit" variant="ghost" icon="search">Filtrera</Button>
            {filtered ? <Button href="/utskick" variant="subtle" icon="undo">Rensa filter</Button> : null}
          </div>
        </form>

        {rowsError ? (
          <EmptyState
            icon="alert"
            title="Kunde inte läsa utskicksraderna"
            text="Kontrollera filtren eller försök igen senare. Sammanställningen ovan påverkas inte."
          />
        ) : rows?.length ? (
          <Card pad={0}>
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Företag</th>
                    <th>Händelse</th>
                    <th>Kanal</th>
                    <th>Status</th>
                    <th>Kostnad</th>
                    <th data-last="">Orsak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = deliveryStatus(row.status)
                    return (
                      <tr key={row.id}>
                        <td className="num">{formatDate(row.created_at)}</td>
                        <td>
                          <strong>{row.tenant_name}</strong>
                          <span className={styles.sub}>{row.tenant_slug}</span>
                        </td>
                        <td>
                          <strong>{row.event_type}</strong>
                          <span className={styles.sub}>{row.category}</span>
                          {row.provider_ref ? <span className={styles.sub}>Provider: {row.provider_ref}</span> : null}
                        </td>
                        <td>{row.chosen_channel ?? 'Ej vald'}</td>
                        <td><Badge tone={status.tone}>{status.label}</Badge></td>
                        <td className="num">{row.cost_ore == null ? '—' : formatOre(row.cost_ore)}</td>
                        <td data-last=""><code className={styles.reason}>{row.skip_reason ?? '—'}</code></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon="message"
            title={filtered ? 'Inga utskick matchar filtren' : 'Inga utskick ännu'}
            text={
              filtered
                ? 'Prova ett annat företag, kanal, status eller kategori.'
                : 'När notifieringar skapas visas deras kanal, leveransstatus och kostnad här.'
            }
          />
        )}
      </section>
    </div>
  )
}

function SectionHead({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.sectionHead}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <p className={styles.sectionText}>{text}</p>
      </div>
    </div>
  )
}

function FilterInput({
  label,
  name,
  value,
  values,
}: {
  label: string
  name: 'channel' | 'status' | 'category'
  value: string
  values: string[]
}) {
  const listId = `utskick-${name}`
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.control}
        name={name}
        defaultValue={value}
        list={listId}
        placeholder="Alla"
        autoCapitalize="none"
      />
      <datalist id={listId}>
        {values.map((option) => <option key={option} value={option} />)}
      </datalist>
    </label>
  )
}

function dimensions(
  rows: OutboxRow[] | null,
  selected: string,
  read: (row: OutboxRow) => string | null,
): string[] {
  return [...new Set([selected, ...(rows ?? []).map(read)].filter((value): value is string => Boolean(value)))].sort()
}

function adoptionPercent(adopted: number, total: number): string {
  return total > 0 ? `${Math.round((adopted / total) * 100)} %` : 'Inga aktiva slutkunder'
}

function formatOre(ore: number): string {
  return KR.format(ore / 100)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  })
}

function deliveryStatus(status: string): { label: string; tone: BadgeTone } {
  const known: Record<string, { label: string; tone: BadgeTone }> = {
    routing: { label: 'Kanalval pågår', tone: 'warning' },
    queued: { label: 'Köad', tone: 'warning' },
    attempting: { label: 'Försöker', tone: 'warning' },
    delivery_started: { label: 'Leverans startad', tone: 'info' },
    sent: { label: 'Skickat', tone: 'success' },
    delivered: { label: 'Levererat', tone: 'success' },
    simulated: { label: 'Simulerat', tone: 'info' },
    failed: { label: 'Misslyckades', tone: 'danger' },
    skipped: { label: 'Överhoppat', tone: 'neutral' },
  }
  return known[status] ?? { label: status, tone: 'neutral' }
}
