import type { WorkingHoursRow } from '@/lib/personal/schedule'
import type { StaffBooking } from '@/lib/personal/calendar'
import { fmtTime } from '@/lib/personal/format'

/** One column's data: the calendar day + its label + real cells. */
export type ScheduleDay = {
  /** 'YYYY-MM-DD' calendar date in the location tz. */
  dateStr: string
  /** Mån/Tis/… short weekday label. */
  label: string
  /** Day-of-month, e.g. "2". */
  dayNum: string
  /** 0=Sun … 6=Sat — matches working_hours.weekday. */
  weekday: number
  /** True for the column that is "today" in the location tz. */
  today: boolean
  /** Real working-hours windows for this weekday (may be several). */
  windows: WorkingHoursRow[]
  /** Real bookings that start this calendar day (own, active+done). */
  bookings: StaffBooking[]
}

/**
 * Frisör week schema (mock §4.5 StaffSchedule, "Mitt schema"). 7-col grid, the
 * today column gold-tinted, real bookings shown as filled info cells, and the
 * staff member's real working window shown as a dashed "Ledig"/"Stängt" capacity
 * row. Cells are bound to LIVE data only:
 *   booked  → real `bookings` rows (time + resolved customerLabel)
 *   free    → the real `working_hours` window for that weekday ("09:00–17:00 ·
 *             Ledig"); no hours → "Stängt".
 * We do NOT synthesise per-15-min slot ticks here — the exact bookable raster
 * lives in `working_hour_slots` (availability.ts explicit-slot mode), for which
 * `lib/personal/schedule.ts` has no reader (FLAGGED). Inventing tick times would
 * fake values the customer can't act on, so the free cell shows the true window.
 */
export function ScheduleGrid({ days }: { days: ScheduleDay[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
      {days.map((d, i) => {
        const closed = d.windows.length === 0
        const booked = [...d.bookings].sort((a, b) => (a.startTs < b.startTs ? -1 : 1))
        return (
          <div
            key={d.dateStr}
            style={{
              borderRight: i < days.length - 1 ? '1px solid var(--c-line)' : 'none',
              minHeight: 380,
            }}
          >
            {/* Column header — day label + Playfair day-number, today gold-tinted */}
            <div
              style={{
                padding: 14,
                borderBottom: '1px solid var(--c-line)',
                textAlign: 'center',
                background: d.today ? 'var(--c-gold-100)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--c-ink-3)', textTransform: 'uppercase' }}>
                {d.label}
              </div>
              <div
                className="num"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--c-forest)',
                }}
              >
                {d.dayNum}
              </div>
            </div>

            {/* Cells: real bookings (info-bg) + real working window (dashed/Ledig) */}
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {booked.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 9,
                    background: 'var(--c-info-bg)',
                  }}
                >
                  <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-info)' }}>
                    {fmtTime(b.startTs, b.timeZone)}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, color: 'var(--c-ink)' }}>
                    {b.customerLabel}
                  </div>
                </div>
              ))}

              {closed ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 9,
                    border: '1px dashed var(--c-line-strong)',
                  }}
                >
                  <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)' }}>Stängt</div>
                </div>
              ) : (
                d.windows.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 9,
                      border: '1px dashed var(--c-line-strong)',
                    }}
                  >
                    <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--c-ink-3)' }}>
                      {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 2 }}>Ledig</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
