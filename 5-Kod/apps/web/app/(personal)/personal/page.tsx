import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff, getMyServices } from '@/lib/personal/staff'
import {
  getBookingsInRange,
  dayRangeUtc,
  weekRangeUtc,
  type StaffBooking,
} from '@/lib/personal/calendar'
import { addDays, mondayOf, todayInTz, fmtTime } from '@/lib/personal/format'
import { Calendar, type CalendarGroup } from '@/components/personal/Calendar'
import { DateNav } from '@/components/personal/DateNav'
import { WalkInForm } from '@/components/personal/WalkInForm'
import { MarkDoneButton } from '@/components/personal/MarkDoneButton'
import { PageHead, Stat, Badge, Card } from '@/components/portal/ui'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal — idag' }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Personal" title="Idag" />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Ditt konto är inte kopplat till en personalrad ännu. Kontakta salongsadmin så kopplas du
            till din profil — sedan dyker dina bokningar och tider upp här.
          </p>
        </div>
      </section>
    )
  }

  const primaryTz = staff[0]?.timeZone ?? 'Europe/Stockholm'
  const staffIds = staff.map((s) => s.id)
  const services = await getMyServices(staffIds)
  const today = todayInTz(primaryTz)
  const dateStr = sp.date && DATE_RE.test(sp.date) ? sp.date : today
  const view: 'dag' | 'vecka' = sp.view === 'vecka' ? 'vecka' : 'dag'

  // Viewed calendar (day or week), bucketed by local calendar day.
  let groups: CalendarGroup[] = []
  if (view === 'vecka') {
    const monday = mondayOf(dateStr)
    const { fromUtc, toUtc } = weekRangeUtc(monday, primaryTz)
    const all = await getBookingsInRange(staffIds, fromUtc, toUtc)
    groups = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i)
      const { fromUtc: f, toUtc: t } = dayRangeUtc(d, primaryTz)
      const fMs = new Date(f).getTime()
      const tMs = new Date(t).getTime()
      const bookings = all.filter((b: StaffBooking) => {
        const s = new Date(b.startTs).getTime()
        return s >= fMs && s < tMs
      })
      return { dateStr: d, bookings }
    })
  } else {
    const { fromUtc, toUtc } = dayRangeUtc(dateStr, primaryTz)
    groups = [{ dateStr, bookings: await getBookingsInRange(staffIds, fromUtc, toUtc) }]
  }

  // "Idag"-overview (always today, independent of the viewed date).
  const { fromUtc: tFrom, toUtc: tTo } = dayRangeUtc(today, primaryTz)
  const todays = await getBookingsInRange(staffIds, tFrom, tTo)
  const activeToday = todays.filter((b) => b.status === 'pending' || b.status === 'confirmed')
  const now = Date.now()
  const next =
    activeToday
      .filter((b) => new Date(b.startTs).getTime() >= now)
      .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))[0] ?? null

  // Hero display fields, derived ONLY from data already loaded above (no queries).
  // The name is shown only when the booking truly carries one — customerLabel is
  // already the resolved name / parsed guest name, and falls back to the generic
  // 'Kund' when there is none; we never render that generic placeholder as a name.
  const nextName = next && next.customerLabel !== 'Kund' ? next.customerLabel : null
  const nextDurationMin = next
    ? Math.max(0, Math.round((new Date(next.endTs).getTime() - new Date(next.startTs).getTime()) / 60000))
    : 0

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Personal"
        title="Idag"
        lede="Din dag, live. Du behöver inte pyssla med admin — bara klippa."
      >
        <Badge tone="gold">
          {activeToday.length} {activeToday.length === 1 ? 'bokning' : 'bokningar'} idag
        </Badge>
      </PageHead>

      {/* "Nästa kund"-hero — forest surface, gold eyebrow, big Playfair time.
          Text colors are set explicitly (the .h1/.body type roles bake in dark
          ink/forest, invisible on forest), and all tokens resolve under the
          back-office [data-world] shell. Additive: existing Stat grid + Kalender
          + per-row actions are untouched below. */}
      <Card
        pad={26}
        style={{
          background: 'var(--c-forest)',
          border: 'none',
          marginBottom: 26,
          color: 'var(--c-on-forest)',
        }}
      >
        {next ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span className="eyebrow" style={{ color: 'var(--c-gold)' }}>
                Nästa kund
              </span>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 38,
                    lineHeight: 1,
                    color: 'var(--c-on-forest)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtTime(next.startTs, next.timeZone)}
                </span>
                {nextName ? (
                  <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--c-on-forest)' }}>
                    {nextName}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--c-on-forest-2)' }}>
                {next.serviceName ?? 'Tjänst'}
                {nextDurationMin > 0 ? ` · ${nextDurationMin} min` : ''}
              </p>
            </div>
            <MarkDoneButton key={next.id} bookingId={next.id} />
          </div>
        ) : (
          <div>
            <span className="eyebrow" style={{ color: 'var(--c-gold)' }}>
              Nästa kund
            </span>
            <p
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 24,
                lineHeight: 1.15,
                color: 'var(--c-on-forest)',
              }}
            >
              Inga fler kunder idag
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--c-on-forest-2)' }}>
              Du är ikapp — njut av lugnet.
            </p>
          </div>
        )}
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 26,
        }}
      >
        <Stat
          label="Aktiva idag"
          value={activeToday.length}
          delta={activeToday.length === 1 ? 'aktiv bokning idag' : 'aktiva bokningar idag'}
          deltaTone="muted"
          icon="calendar"
        />
        <Stat
          label="Nästa kund"
          value={next ? fmtTime(next.startTs, next.timeZone) : '–'}
          delta={next ? next.customerLabel : 'inga fler bokningar idag'}
          deltaTone="muted"
          icon="user"
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <h2 className="h2" style={{ margin: 0 }}>
          Kalender
        </h2>
        <WalkInForm services={services} timeZone={primaryTz} />
      </div>
      <DateNav dateStr={dateStr} view={view} today={today} />
      <Calendar groups={groups} />
    </section>
  )
}
