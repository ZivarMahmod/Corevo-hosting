import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getStats, isPeriod, periodRange, PERIODS, PERIOD_LABEL, type Period, type Stats } from '@/lib/admin/stats'
import { formatPrice } from '@/lib/admin/format'
import { PageHead, Stat, Card } from '@/components/portal/ui'
import styles from '@/components/admin/stats.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Statistik · Adminpanel' }

/** Siffran är hjälten. Varje kort ska gå att FÖRSTÅ utan att läsas — etikett, tal,
 *  förändring. Ingen förklarande brödtext, ingen dekor-yta, inget tal som inte styr
 *  ett beslut. */

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

function pctLabel(v: number): string {
  return `${Math.round(v * 100)} %`
}

function Delta({ value, lowerIsBetter = false }: { value: number | null; lowerIsBetter?: boolean }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={`${styles.delta} ${styles.deltaFlat}`}>Ny period</span>
  }
  const rounded = Math.round(value)
  if (rounded === 0) return <span className={`${styles.delta} ${styles.deltaFlat}`}>0 %</span>
  const good = lowerIsBetter ? rounded < 0 : rounded > 0
  return (
    <span className={`${styles.delta} ${good ? styles.deltaUp : styles.deltaDown}`}>
      {rounded > 0 ? '↑' : '↓'} {Math.abs(rounded)} %
    </span>
  )
}

function TopList({
  entries,
  gold = false,
}: {
  entries: Stats['topServices']
  gold?: boolean
}) {
  const max = Math.max(1, ...entries.map((e) => e.realizedValueCents))
  return (
    <div className={styles.bars}>
      {entries.map((e) => (
        <div key={e.name} className={styles.bar}>
          <span className={styles.barName}>{e.name}</span>
          <span className={`num ${styles.barValue}`}>{formatPrice(e.realizedValueCents)}</span>
          <div className={styles.barTrack}>
            <div
              className={`${styles.barFill} ${gold ? styles.barFillGold : ''}`}
              style={{ width: `${Math.max(3, (e.realizedValueCents / max) * 100)}%` }}
            />
          </div>
          <span className={styles.barMeta}>{e.count} genomförda</span>
        </div>
      ))}
    </div>
  )
}

function Columns({
  bars,
}: {
  bars: { label: string; count: number }[]
}) {
  const max = Math.max(1, ...bars.map((b) => b.count))
  return (
    <div className={styles.columns}>
      {bars.map((b) => (
        <div key={b.label} className={styles.column}>
          <span className={`num ${styles.columnCount}`}>{b.count}</span>
          <div
            className={`${styles.columnBar} ${b.count === 0 ? styles.columnBarQuiet : ''}`}
            style={{ height: `${(b.count / max) * 100}%` }}
          />
          <span className={styles.columnLabel}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}

export default async function StatistikPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  // Områdesgrind, inte bara portalgolv: statistik läser verksamhetens bokningsdata och
  // kräver ägare (6) ELLER personligt beviljad can_view_daily_metrics (goal-71).
  const user = await requireAdminArea('statistik')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Statistik</h1>
        <p className="prose">Inget företag är kopplat till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const period: Period = isPeriod(sp.period) ? sp.period : '30d'
  const { from, to } = periodRange(period)
  const s = await getStats(tenant.id, from, to, tenant.timeZone)

  const hasData = s.bookings > 0 || s.cancellations > 0 || s.noShows > 0
  const customersTotal = s.newCustomers + s.returningCustomers
  const newShare = customersTotal > 0 ? (s.newCustomers / customersTotal) * 100 : 0

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Statistik">
        <div className={styles.periods}>
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/statistik?period=${p}`}
              className={`${styles.period} ${p === period ? styles.periodOn : ''}`}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </PageHead>

      {!hasData ? (
        <div className={styles.empty}>
          <strong>Inga bokningar i perioden.</strong>
          Välj en längre period, eller kom tillbaka när tiderna börjar fyllas.
        </div>
      ) : (
        <>
          <div className="bo-stat-grid">
            <Stat
              label="Bokningsvärde"
              value={formatPrice(s.bookedValueCents)}
              icon="trendUp"
              hint={<Delta value={s.deltas.bookedValue} />}
            />
            <Stat
              label="Bokningar"
              value={s.bookings}
              icon="calendar"
              hint={<Delta value={s.deltas.bookings} />}
            />
            <Stat
              label="Beläggning"
              value={pctLabel(s.occupancyRate)}
              icon="clock"
              hint={<Delta value={s.deltas.occupancy} />}
            />
            <Stat
              label="Genomfört tjänstevärde"
              value={formatPrice(s.realizedValueCents)}
              icon="dollar"
              hint={<Delta value={s.deltas.realizedValue} />}
            />
            <Stat
              label="Avbokat"
              value={pctLabel(s.cancellationRate)}
              icon="alert"
              hint={<Delta value={s.deltas.cancellationRate} lowerIsBetter />}
            />
            {/* Uteblivna räknas på riktigt (status 'no_show', 0063). Talet bredvid är den
                UTEBLIVNA BOKNINGSVÄRDET — inte påstådd betalning eller intäkt. */}
            <Stat
              label="Uteblivna"
              value={s.noShows}
              icon="clock"
              hint={`${formatPrice(s.noShowBookedValueCents)} bokningsvärde`}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="h2">Genomförda tjänster</h2>
              <span className={`num ${styles.barValue}`}>
                {formatPrice(s.avgPerHourCents)} tjänstevärde / genomförd timme
              </span>
            </div>
            <div className={styles.split}>
              <Card>
                <span className="eyebrow">Tjänster</span>
                <div style={{ marginTop: 14 }}>
                  <TopList entries={s.topServices} />
                </div>
              </Card>
              <Card>
                <span className="eyebrow">Personal</span>
                <div style={{ marginTop: 14 }}>
                  <TopList entries={s.topStaff} gold />
                </div>
              </Card>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="h2">När är det fullt</h2>
              <span className={styles.barMeta}>
                {s.peakHours.length > 0
                  ? `Toppar ${s.peakHours.map((h) => `${h.hour}`).join(', ')} · Lugnast ${s.quietHours.map((h) => `${h.hour}`).join(', ')}`
                  : ''}
              </span>
            </div>
            <div className={styles.split}>
              <Card>
                <span className="eyebrow">Veckodag</span>
                <div style={{ marginTop: 14 }}>
                  <Columns
                    bars={s.byWeekday.map((count, i) => ({ label: WEEKDAYS[i]!, count }))}
                  />
                </div>
              </Card>
              <Card>
                <span className="eyebrow">Timme</span>
                <div style={{ marginTop: 14 }}>
                  <Columns
                    bars={s.byHour.map((h) => ({ label: `${h.hour}`, count: h.count }))}
                  />
                </div>
              </Card>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="h2">Kunderna</h2>
              <span className={`num ${styles.barValue}`}>
                {pctLabel(s.retentionRate)} bokar om
              </span>
            </div>
            <Card>
              <div className={styles.share}>
                <div className={styles.shareNew} style={{ width: `${newShare}%` }} />
                <div className={styles.shareReturning} style={{ width: `${100 - newShare}%` }} />
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendDot} ${styles.shareNew}`}
                    aria-hidden="true"
                  />
                  <strong className="num">{s.newCustomers}</strong> nya
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={`${styles.legendDot} ${styles.shareReturning}`}
                    aria-hidden="true"
                  />
                  <strong className="num">{s.returningCustomers}</strong> återkommande
                </span>
                <span className={styles.legendItem}>
                  <strong className="num">{s.avgDurationMin} min</strong> snittlängd
                </span>
              </div>
            </Card>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className="h2">12 månader</h2>
            </div>
            <Card>
              <Columns
                bars={s.byMonth.map((m) => ({ label: m.month.slice(5), count: m.bookings }))}
              />
            </Card>
          </div>
        </>
      )}
    </section>
  )
}
