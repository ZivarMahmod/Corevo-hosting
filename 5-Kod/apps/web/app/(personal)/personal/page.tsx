import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import {
  getBookingsInRange,
  dayRangeUtc,
  weekRangeUtc,
  type StaffBooking,
} from '@/lib/personal/calendar'
import { addDays, mondayOf, todayInTz, fmtTime } from '@/lib/personal/format'
import { Calendar, type CalendarGroup } from '@/components/personal/Calendar'
import { DateNav } from '@/components/personal/DateNav'
import { PageHead, Stat, Badge } from '@/components/portal/ui'
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

  return (
    <section className="portal-section">
      <PageHead eyebrow="Personal" title="Idag">
        <Badge tone="gold">
          {activeToday.length} {activeToday.length === 1 ? 'bokning' : 'bokningar'} idag
        </Badge>
      </PageHead>

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

      <h2 className="h2" style={{ marginBottom: 12 }}>
        Kalender
      </h2>
      <DateNav dateStr={dateStr} view={view} today={today} />
      <Calendar groups={groups} />
    </section>
  )
}
