import {
  listAllWorkingHours,
  listTimeOffOverlapping,
  listBookingStarts,
} from '@/lib/admin/schedule-data'
import { todayInTz, mondayOf, addDays } from '@/lib/personal/format'
import { weekRangeUtc, dayRangeUtc } from '@/lib/personal/calendar'
import { weekdayOf } from '@/lib/booking/tz'
import type { BoardDay, BoardRow, BoardCell } from '@/components/admin/ScheduleWeekBoard'

/**
 * Vecko-brädans databygge — EN källa för både /admin/scheman (redigeringssidan)
 * och /admin/scheman/vy (Schemavy/iPad-kiosken, Zivar 2026-07-10) så vyerna
 * aldrig glider isär. Lyft ordagrant ur scheman/page.tsx; sidorna äger själva
 * sina extra fetchar (mall-redigerare, frånvarolista).
 */

// Kort svenskt dagnamn per weekday-index (0 = Sön … 6 = Lör) — matchar
// working_hours.weekday-kontraktet.
const WEEKDAY_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** ISO-veckonummer (svensk standard): torsdagen i samma vecka avgör vecka/år.
 *  Ren UTC-matte på kalenderdatumet — ett datum är tz-oberoende. */
export function isoWeekOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d!))
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7)
}

/** "6–12 juli 2026" / "29 juni – 5 juli 2026" — månadsgräns skrivs ut explicit
 *  så bara datum-siffror i kolumnhuvudena aldrig blir tvetydiga. */
export function weekRangeLabel(monday: string): string {
  const sunday = addDays(monday, 6)
  const month = new Intl.DateTimeFormat('sv-SE', { month: 'long', timeZone: 'UTC' })
  const noon = (s: string) => new Date(`${s}T12:00:00Z`)
  const year = sunday.slice(0, 4)
  if (monday.slice(0, 7) === sunday.slice(0, 7)) {
    return `${noon(monday).getUTCDate()}–${noon(sunday).getUTCDate()} ${month.format(noon(sunday))} ${year}`
  }
  return `${noon(monday).getUTCDate()} ${month.format(noon(monday))} – ${noon(sunday).getUTCDate()} ${month.format(noon(sunday))} ${year}`
}

/** "09–18" / "09:30–17:30" — hela timmar trimmas för kompakta grid-celler. */
function hm(t: string): string {
  const v = t.slice(0, 5)
  return v.endsWith(':00') ? v.slice(0, 2) : v
}

export type WeekBoardData = {
  days: BoardDay[]
  rows: BoardRow[]
  weekMonday: string
  currentMonday: string
  weekLabel: string
  isCurrentWeek: boolean
  /** Validerat plats-filter ('' = alla / singel-plats). */
  plats: string
  multiLoc: boolean
}

export async function buildWeekBoard({
  tenantId,
  timeZone,
  staff,
  locations,
  week,
  plats: platsParam,
  selectedStaffId,
}: {
  tenantId: string
  timeZone: string
  /** listStaff-raderna (sidan äger fetchen — kiosk och scheman delar den inte). */
  staff: { id: string; displayName: string; active: boolean }[]
  /** AKTIVA platser (redan filtrerade). */
  locations: { id: string; name: string }[]
  /** ?week= rå — normaliseras ALLTID till måndag; ogiltig/utelämnad → nu-veckan. */
  week?: string
  /** ?plats= rå — bara giltiga id:n räknas, och bara vid >1 aktiv plats. */
  plats?: string
  /** Markerad rad (redigeringssidans mall-koppling) — utelämnad i kiosken. */
  selectedStaffId?: string
}): Promise<WeekBoardData> {
  const today = todayInTz(timeZone)
  const currentMonday = mondayOf(today)
  const weekMonday =
    week && DATE_RE.test(week) && !Number.isNaN(Date.parse(`${week}T12:00:00Z`))
      ? mondayOf(week)
      : currentMonday
  const { fromUtc: weekFromUtc, toUtc: weekToUtc } = weekRangeUtc(weekMonday, timeZone)

  const [allHours, weekTimeOff, bookingStarts] = await Promise.all([
    listAllWorkingHours(tenantId),
    listTimeOffOverlapping(tenantId, weekFromUtc, weekToUtc),
    listBookingStarts(tenantId, weekFromUtc, weekToUtc),
  ])

  const multiLoc = locations.length > 1
  const plats = multiLoc && locations.some((l) => l.id === platsParam) ? platsParam! : ''
  const locationName = new Map<string, string>(locations.map((l) => [l.id, l.name]))

  // ── Veckans 7 dagar (Mån→Sön) med riktiga datum ────────────────────────────
  const days: BoardDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekMonday, i)
    return {
      date,
      name: WEEKDAY_SHORT[weekdayOf(date)]!,
      dayOfMonth: Number(date.slice(8, 10)),
      isToday: date === today,
    }
  })
  // UTC-fönster per dag (tenantens tz) för frånvaro-överlapp per cell.
  const dayBounds = days.map((d) => dayRangeUtc(d.date, timeZone))

  // Bokningar bucketas per staff+kalenderdag i TENANTENS tz — kopierat mönster
  // (en-CA → ÅÅÅÅ-MM-DD), aldrig serverns lokala Date-matte.
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const bookingsByKey = new Map<string, number>()
  for (const b of bookingStarts) {
    const key = `${b.staff_id}|${dayFmt.format(new Date(b.start_ts))}`
    bookingsByKey.set(key, (bookingsByKey.get(key) ?? 0) + 1)
  }

  // Mall-intervall grupperade per staff+weekday för cellerna.
  const hoursByKey = new Map<string, typeof allHours>()
  for (const h of allHours) {
    const key = `${h.staff_id}|${h.weekday}`
    const arr = hoursByKey.get(key)
    if (arr) arr.push(h)
    else hoursByKey.set(key, [h])
  }

  // Rader = aktiv personal (inaktiva är inte bokningsbara → brus i en veckovy).
  const activeStaff = staff.filter((s) => s.active)
  const rows: BoardRow[] = activeStaff.map((s) => {
    const cells: BoardCell[] = days.map((day, i) => {
      const dayHours = hoursByKey.get(`${s.id}|${weekdayOf(day.date)}`) ?? []
      const intervals = dayHours.map((h) => {
        const locName = h.location_id ? (locationName.get(h.location_id) ?? null) : null
        const offSite = Boolean(plats && h.location_id && h.location_id !== plats)
        return {
          label: `${hm(h.start_time)}–${hm(h.end_time)}`,
          // Badge: med valt filter taggas bara ANNAN plats; utan filter taggas
          // alla platsbundna intervall (multi-plats behöver alltid kontext).
          tag: multiLoc ? (plats ? (offSite ? locName : null) : locName) : null,
          offSite,
        }
      })
      const off = weekTimeOff.find(
        (t) => t.staff_id === s.id && t.start_ts < dayBounds[i]!.toUtc && t.end_ts > dayBounds[i]!.fromUtc,
      )
      return {
        intervals,
        timeOff: off ? { reason: off.reason } : null,
        bookings: bookingsByKey.get(`${s.id}|${day.date}`) ?? 0,
      }
    })
    return { staffId: s.id, name: s.displayName, isSelected: s.id === selectedStaffId, cells }
  })

  return {
    days,
    rows,
    weekMonday,
    currentMonday,
    weekLabel: `Vecka ${isoWeekOf(weekMonday)} · ${weekRangeLabel(weekMonday)}`,
    isCurrentWeek: weekMonday === currentMonday,
    plats,
    multiLoc,
  }
}
