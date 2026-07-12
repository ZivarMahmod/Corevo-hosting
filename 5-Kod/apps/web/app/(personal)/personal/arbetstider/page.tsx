import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMyStaff } from '@/lib/personal/staff'
import { getMyWorkingHours } from '@/lib/personal/schedule'
import {
  getBookingsInRange,
  weekRangeUtc,
  dayRangeUtc,
  type StaffBooking,
} from '@/lib/personal/calendar'
import { mondayOf, todayInTz, addDays } from '@/lib/personal/format'
import { PageHead, Card, Button } from '@/components/portal/ui'
import { ScheduleGrid, type ScheduleDay } from './ScheduleGrid'
import styles from '@/components/personal/personal.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Arbetstider' }

/** Mån/Tis/… for a 0=Sun..6=Sat weekday (column headers). */
const WEEK_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']

/** "2–8 jun" style label for the Mon..Sun span (no week-number helper exists). */
function weekRangeLabel(monday: string, sunday: string): string {
  const day = (s: string) => Number(s.split('-')[2])
  const fmtMonth = (s: string) =>
    new Intl.DateTimeFormat('sv-SE', { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${s}T12:00:00Z`),
    )
  const m1 = fmtMonth(monday)
  const m2 = fmtMonth(sunday)
  return m1 === m2 ? `${day(monday)}–${day(sunday)} ${m2}` : `${day(monday)} ${m1}–${day(sunday)} ${m2}`
}

export default async function ArbetstiderPage() {
  const user = await requirePortal('personal')
  const staff = await getMyStaff(user.id)

  // Eyebrow = the logged-in person's live identity. The `staff` table carries no
  // name (only `title`) and getCurrentUser exposes only email/roleName — there is
  // no staff display-name reader (FLAGGED). Mirror the chrome's sidebar label
  // (PortalShell → email local-part, e.g. "klippare") so the eyebrow stays the
  // same live person the rest of the shell shows. Never the literal "Personal".
  const meLabel = user.email?.split('@')[0] || 'Inloggad'

  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={meLabel} title="Mitt schema" />
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ingen personalprofil kopplad</p>
          <p className={styles.emptyHint}>
            Kontakta din administratör för att kopplas till en personalrad — sedan visas dina
            arbetstider här.
          </p>
        </div>
      </section>
    )
  }

  const primaryTz = staff[0]?.timeZone ?? 'Europe/Stockholm'
  const staffIds = staff.map((s) => s.id)
  const rows = await getMyWorkingHours(staffIds)

  // Current Mon..Sun week (from the location tz, not the server's), so the grid
  // shows THIS week and the today-tint lands on the real current day.
  const today = todayInTz(primaryTz)
  const monday = mondayOf(today)
  const sunday = addDays(monday, 6)
  const { fromUtc, toUtc } = weekRangeUtc(monday, primaryTz)
  const all = await getBookingsInRange(staffIds, fromUtc, toUtc)

  // working_hours rows grouped by weekday (0=Sun..6=Sat).
  const windowsByWeekday = new Map<number, typeof rows>()
  for (const r of rows) {
    const list = windowsByWeekday.get(r.weekday) ?? []
    list.push(r)
    windowsByWeekday.set(r.weekday, list)
  }

  // Build the 7 day columns: real windows + real bookings per local calendar day.
  const days: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(monday, i)
    const weekday = (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 7) % 7
    const { fromUtc: f, toUtc: t } = dayRangeUtc(dateStr, primaryTz)
    const fMs = new Date(f).getTime()
    const tMs = new Date(t).getTime()
    const bookings = all.filter((b: StaffBooking) => {
      if (b.status === 'cancelled' || b.status === 'no_show') return false
      const s = new Date(b.startTs).getTime()
      return s >= fMs && s < tMs
    })
    return {
      dateStr,
      label: WEEK_SHORT[weekday] ?? '',
      dayNum: String(Number(dateStr.split('-')[2])),
      weekday,
      today: dateStr === today,
      windows: windowsByWeekday.get(weekday) ?? [],
      bookings,
    }
  })

  return (
    <section className="portal-section">
      {/* Canon §4.5 StaffSchedule: eyebrow + title + ghost week-button only — no
          sub-lede, no callout, no list below the grid. The grid's dashed window
          cells already carry the weekly baseline ("Ledig"/"Stängt"), so the old
          read-only Veckoschema list was a duplicate of the same data → removed. */}
      <PageHead eyebrow={meLabel} title="Mitt schema">
        <Button variant="ghost" size="sm">
          Vecka {weekRangeLabel(monday, sunday)}
        </Button>
      </PageHead>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <ScheduleGrid days={days} />
      </Card>
    </section>
  )
}
