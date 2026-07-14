import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { dashboardData, staffDay, type AdminBooking } from '@/lib/admin/data'
import { getAdminModuleStates, isBookingActivated } from '@/lib/admin/modules'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatTime, statusLabel } from '@/lib/admin/format'
import { PageHead, Stat, Card, Badge, Button, Callout, Icon } from '@/components/portal/ui'
import type { BadgeTone } from '@/components/portal/ui'
import styles from './dashboard.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Översikt · Adminpanel' }

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'gold',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
}

/** Översikten är ENTRÉN, inte arbetsbordet (låst beslut, codex/00 §2): den svarar på
 *  "vad händer idag", "vad kräver mitt beslut" och "vad är nästa handling" — och pekar
 *  vidare till Kalendern. Den får aldrig bli en andra kalender, visa inställningsfält
 *  eller KPI:er för moduler kunden inte har. */
export default async function AdminPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Översikt</h1>
        <p className="prose">Inget företag är kopplat till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const today = todayInTz(tenant.timeZone)
  const dayRange = dayRangeUtc(today, tenant.timeZone)
  const weekRange = weekRangeUtc(today, tenant.timeZone)
  // Veckodagen i tenantens tidszon (0=sön … 6=lör) — inte serverns lokala dag.
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()

  const [data, roster, moduleStates] = await Promise.all([
    dashboardData(tenant.id, dayRange, weekRange, tenant.timeZone),
    staffDay(tenant.id, weekday),
    getAdminModuleStates(tenant.id),
  ])

  // Dagens rader. upcomingToday BÄR redan det maskerade kundnamnet (AdminBooking
  // .customerName, samma privacy-regel som Kunder-listan) — sidan gör ingen egen
  // kundläsning.
  const done = data.upcomingToday.filter((b) => b.status === 'completed')
  const upcoming = data.upcomingToday.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed',
  )
  // Kräver uppmärksamhet = obekräftade tider. De är de enda som väntar på ETT beslut
  // av användaren; allt annat är information och hör hemma i listan nedan.
  const needsAction = data.upcomingToday.filter((b) => b.status === 'pending')
  const next = upcoming[0] ?? null

  // Driftvarning visas BARA vid ett verkligt problem — ingen rad med gröna
  // "allt fungerar"-system (codex/06: "Döda modulkort visas inte").
  const bookingPaused = !isBookingActivated(moduleStates)

  const dateLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tenant.timeZone,
  }).format(new Date())

  const nameOf = (b: AdminBooking) => b.customerName ?? 'Gäst'
  const timeOf = (b: AdminBooking) => formatTime(b.startTs, tenant.timeZone)

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        lede="Dagens läge. Arbetet utförs i kalendern."
      >
        {/* EN primär väg vidare. "Öppna min sida" bor i toppnavet — den dupliceras inte här. */}
        <Button href="/admin/bokningar" variant="primary" icon="calendar">
          Öppna kalendern
        </Button>
      </PageHead>

      {bookingPaused && (
        <Callout tone="warning" icon="alert">
          <strong>Publik bokning är pausad.</strong> Kunder kan inte boka på din sida just nu.
          Bokningar du själv lägger in i kalendern fungerar som vanligt.
        </Callout>
      )}

      {/* Dagens rad — tre tal som faktiskt styr dagen. Beläggning i procent kräver
          kapacitetsmatte som datalagret inte exponerar; hellre tre sanna tal än ett
          uppfunnet fjärde (ponytail: lägg till när slot-kapaciteten finns i B-01). */}
      <div className="bo-stat-grid">
        <Stat
          label="Bokningar idag"
          value={data.todayCount}
          icon="calendar"
          hint={
            needsAction.length > 0
              ? `${needsAction.length} obekräftade · ${done.length} klara`
              : `${done.length} klara · ${upcoming.length} kvar`
          }
        />
        <Stat
          label="Nästa besök"
          value={next ? timeOf(next) : '–'}
          icon="clock"
          hint={next ? `${nameOf(next)} · ${next.serviceName} · ${next.staffTitle}` : 'Inget mer idag'}
        />
        <Stat
          label="Denna vecka"
          value={data.weekCount}
          icon="trendUp"
          hint={`${roster.filter((s) => s.start).length} i tjänst idag`}
        />
      </div>

      <div className="bo-2col">
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Kräver uppmärksamhet — varje rad har EN konkret handling. Tomt läge är
              ärligt och lugnt, inte en tom låda. */}
          <Card pad={0}>
            <div className={styles.cardHead}>
              <h2 className="h2">Kräver uppmärksamhet</h2>
              {needsAction.length > 0 && <Badge tone="gold">{needsAction.length}</Badge>}
            </div>
            <div style={{ padding: '0 10px 10px' }}>
              {needsAction.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>Inget kräver din uppmärksamhet.</strong>
                  Obekräftade och ändrade tider dyker upp här.
                </div>
              ) : (
                needsAction.map((b) => (
                  <div key={b.id} className={styles.bookingRow}>
                    <div className={`num ${styles.rowTime}`}>{timeOf(b)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.rowName}>{nameOf(b)}</div>
                      <div className={styles.rowSub}>
                        {b.serviceName} · {b.staffTitle} · väntar på bekräftelse
                      </div>
                    </div>
                    <Button href={`/admin/bokningar?open=${b.id}`} variant="subtle" size="sm">
                      Öppna
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Kommande idag — kompakt lista, INTE en kalender. Radklick öppnar bokningen
              i kalendern (drawern i goal-66; tills dess bokningsvyn). */}
          <Card pad={0}>
            <div className={styles.cardHead}>
              <h2 className="h2">Kommande idag</h2>
              <Link href="/admin/bokningar" className={styles.cardLink}>
                Visa alla i kalendern <Icon name="arrowRight" size={15} />
              </Link>
            </div>
            <div style={{ padding: '0 10px 10px' }}>
              {upcoming.length === 0 ? (
                <div className={styles.emptyState}>
                  <strong>
                    {data.todayCount === 0 ? 'Inga bokningar idag.' : 'Inga fler tider kvar idag.'}
                  </strong>
                  {data.todayCount === 0
                    ? 'Nya bokningar dyker upp här automatiskt.'
                    : `Alla dagens tider är genomförda — ${done.length} klara.`}
                </div>
              ) : (
                upcoming.slice(0, 6).map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/bokningar?open=${b.id}`}
                    className={styles.bookingRow}
                  >
                    <div className={`num ${styles.rowTime}`}>{timeOf(b)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.rowName}>{nameOf(b)}</div>
                      <div className={styles.rowSub}>
                        {b.serviceName} · {b.staffTitle}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{statusLabel(b.status)}</Badge>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Personal idag — vem som arbetar och när. En ledig resurs visas som ledig,
            aldrig bortplockad: frånvaro är information, inte tomhet. */}
        <Card pad={0}>
          <div className={styles.cardHead}>
            <h2 className="h2">Personal idag</h2>
          </div>
          <div style={{ padding: '0 10px 10px' }}>
            {roster.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>Ingen personal upplagd.</strong>
                Lägg till medarbetare under Inställningar.
              </div>
            ) : (
              roster.map((s) => (
                <div key={s.staffId} className={styles.bookingRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.rowName}>{s.name}</div>
                  </div>
                  {s.start && s.end ? (
                    <span className={`num ${styles.rowHours}`}>
                      {s.start.slice(0, 5)}–{s.end.slice(0, 5)}
                    </span>
                  ) : (
                    <Badge tone="neutral">Ledig</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  )
}
