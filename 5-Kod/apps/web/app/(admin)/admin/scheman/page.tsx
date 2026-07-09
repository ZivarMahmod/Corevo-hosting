import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import { listStaff, listWorkingHours, listWorkingHourSlots, listLocations } from '@/lib/admin/data'
import {
  listAllWorkingHours,
  listTimeOffOverlapping,
  listCurrentAndUpcomingTimeOff,
  listBookingStarts,
} from '@/lib/admin/schedule-data'
import { todayInTz, mondayOf, addDays } from '@/lib/personal/format'
import { weekRangeUtc, dayRangeUtc } from '@/lib/personal/calendar'
import { weekdayOf } from '@/lib/booking/tz'
import {
  SlotManager,
  ScheduleActions,
  WorkingHoursEditor,
  type WeekCol,
  type StaffChip,
} from '@/components/admin/SlotManager'
import {
  ScheduleWeekBoard,
  type BoardDay,
  type BoardRow,
  type BoardCell,
} from '@/components/admin/ScheduleWeekBoard'
import { TimeOffManager, type TimeOffItem } from '@/components/admin/TimeOffManager'
import { ScheduleLock } from '@/components/admin/ScheduleLock'
import { PageHead, Card } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schema · Salongsadmin' }

// Kort svenskt dagnamn per weekday-index (0 = Sön … 6 = Lör) — matchar
// working_hours.weekday-kontraktet.
const WEEKDAY_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'] as const

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** ISO-veckonummer (svensk standard): torsdagen i samma vecka avgör vecka/år.
 *  Ren UTC-matte på kalenderdatumet — ett datum är tz-oberoende. */
function isoWeekOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d!))
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7)
}

/** "6–12 juli 2026" / "29 juni – 5 juli 2026" — månadsgräns skrivs ut explicit
 *  så bara datum-siffror i kolumnhuvudena aldrig blir tvetydiga. */
function weekRangeLabel(monday: string): string {
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

/** Frånvaro-intervall i tenantens tz. Heldagar (00:00 → nästa dag 00:00) visas
 *  som inklusiva dagar; udda tider (personal-anmäld frånvaro) behåller klockslag
 *  — ärlig visning av det lagrade intervallet. */
function timeOffRangeLabel(startTs: string, endTs: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', timeZone })
  const time = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone })
  const start = new Date(startTs)
  const end = new Date(endTs)
  const startLabel = time.format(start) === '00:00' ? day.format(start) : `${day.format(start)} ${time.format(start)}`
  // Slut vid midnatt = exklusiv gräns → visa föregående dag som inklusiv sista dag.
  const endLabel =
    time.format(end) === '00:00'
      ? day.format(new Date(end.getTime() - 60_000))
      : `${day.format(end)} ${time.format(end)}`
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
}

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; week?: string; plats?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Schema" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const staffNoun = resolveTerm(tenant.terminology, 'staff', 'Medarbetare')
  const staffPlural = termPlural(tenant.terminology, 'staff', 'Personal')

  const staff = await listStaff(tenant.id)
  if (staff.length === 0) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Schema" />
        <Card>
          <p className="body" style={{ margin: 0 }}>
            <strong>Lägg till {staffNoun.toLowerCase()} först.</strong>
          </p>
          <p className="small" style={{ marginTop: 6 }}>
            Schemat sätts per medarbetare — skapa minst en under <em>{staffPlural}</em>, så fylls
            veckoöversikten här.
          </p>
        </Card>
      </section>
    )
  }

  // ── Vecko-ankare: ?week=YYYY-MM-DD normaliseras ALLTID till måndag; ogiltigt/
  //    utelämnat → innevarande vecka i tenantens tz (aldrig serverns lokala). ──
  const today = todayInTz(tenant.timeZone)
  const currentMonday = mondayOf(today)
  const weekMonday =
    sp.week && DATE_RE.test(sp.week) && !Number.isNaN(Date.parse(`${sp.week}T12:00:00Z`))
      ? mondayOf(sp.week)
      : currentMonday
  const { fromUtc: weekFromUtc, toUtc: weekToUtc } = weekRangeUtc(weekMonday, tenant.timeZone)

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const nowIso = new Date().toISOString()

  const [rows, slots, allLocations, allHours, weekTimeOff, upcomingTimeOff, bookingStarts] =
    await Promise.all([
      listWorkingHours(tenant.id, selected.id),
      listWorkingHourSlots(tenant.id, selected.id),
      listLocations(tenant.id),
      listAllWorkingHours(tenant.id),
      listTimeOffOverlapping(tenant.id, weekFromUtc, weekToUtc),
      listCurrentAndUpcomingTimeOff(tenant.id, nowIso),
      listBookingStarts(tenant.id, weekFromUtc, weekToUtc),
    ])

  // Bara AKTIVA platser erbjuds (en inaktiv ska inte ta nya schemalagda timmar).
  const locations = allLocations.filter((l) => l.active)
  const multiLoc = locations.length > 1
  // Plats-filtret finns bara vid >1 aktiv plats — och bara giltiga id:n räknas.
  const plats = multiLoc && locations.some((l) => l.id === sp.plats) ? sp.plats! : ''
  const locationName = new Map<string, string>(locations.map((l) => [l.id, l.name]))

  // Mall-redigerarnas default-plats följer filtret när ett är valt; annars samma
  // fallback-kedja som serveraction:en (medarbetarens plats → tenant-primär).
  const defaultLocationId =
    plats || selected.location_id || tenant.locationId || locations[0]?.id || ''

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
  const dayBounds = days.map((d) => dayRangeUtc(d.date, tenant.timeZone))

  // Bokningar bucketas per staff+kalenderdag i TENANTENS tz — kopierat mönster
  // (en-CA → ÅÅÅÅ-MM-DD), aldrig serverns lokala Date-matte.
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenant.timeZone,
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
  const boardRows: BoardRow[] = activeStaff.map((s) => {
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
    return { staffId: s.id, name: s.displayName, isSelected: s.id === selected.id, cells }
  })

  // ── Frånvaro-listan (hela teamet, pågående + kommande) ─────────────────────
  const staffNameById = new Map<string, string>(staff.map((s) => [s.id, s.displayName]))
  const timeOffItems: TimeOffItem[] = upcomingTimeOff.map((t) => ({
    id: t.id,
    staffName: staffNameById.get(t.staff_id) ?? 'Okänd medarbetare',
    rangeLabel: timeOffRangeLabel(t.start_ts, t.end_ts, tenant.timeZone),
    reason: t.reason,
    ongoing: t.start_ts <= nowIso,
  }))

  // ── Mall-sektionens rekvisita (befintlig SlotManager, oförändrad) ──────────
  // WeekCols speglar den VALDA veckan så mall-rutnätets datum stämmer överens
  // med översikten ovanför (mallen i sig är vecko-oberoende).
  const weekCols: WeekCol[] = days.map((d) => ({
    wd: weekdayOf(d.date),
    name: d.name,
    dayOfMonth: d.dayOfMonth,
    isToday: d.isToday,
  }))
  const staffChips: StaffChip[] = staff.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    active: s.active,
  }))

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={`${tenant.name} · Schema`}
        title="Schema"
        lede="Hela teamets vecka i ett svep — bläddra framåt och bakåt, se frånvaro och bokningstryck, och justera grundtiderna längre ner."
      />

      {/* 1 ▸ ÖVERSIKT (läget): veckogrid med nav, frånvaro-overlay + bokningsantal */}
      <ScheduleWeekBoard
        weekLabel={`Vecka ${isoWeekOf(weekMonday)} · ${weekRangeLabel(weekMonday)}`}
        isCurrentWeek={weekMonday === currentMonday}
        days={days}
        rows={boardRows}
        prevWeek={addDays(weekMonday, -7)}
        nextWeek={addDays(weekMonday, 7)}
        todayWeek={currentMonday}
        selectedStaffId={selected.id}
        plats={plats}
        locations={multiLoc ? locations.map((l) => ({ id: l.id, name: l.name })) : []}
        staffNoun={staffPlural}
      />

      {/* 2 ▸ FRÅNVARO (avvikelserna): semester/sjukdom för hela teamet */}
      <section style={{ marginTop: '2.25rem' }}>
        <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
          Avvikelser
        </span>
        <h2 className="h2" style={{ margin: '6px 0 0' }}>
          Frånvaro
        </h2>
        <p className="small" style={{ margin: '4px 0 12px', maxWidth: 560, color: 'var(--c-ink-3)' }}>
          Semester, sjukdom och annan ledighet — blockerar bokningar för perioden och visas som
          overlay i veckoöversikten. Heldagar i salongens tidszon ({tenant.timeZone}).
        </p>
        <TimeOffManager
          items={timeOffItems}
          staffOptions={activeStaff.map((s) => ({ id: s.id, name: s.displayName }))}
          staffNoun={staffNoun}
        />
      </section>

      {/* 3 ▸ MALLAR (grundtiderna): befintlig redigering per medarbetare.
          scrollMarginTop så #mallar-hoppet från en grid-rad inte hamnar under topbaren. */}
      <section id="mallar" style={{ marginTop: '2.5rem', scrollMarginTop: 90 }}>
        <div style={{ marginBottom: 14 }}>
          <span className="eyebrow" style={{ color: 'var(--c-gold-600)' }}>
            Grundtider
          </span>
          <h2 className="h2" style={{ margin: '6px 0 0' }}>
            Veckoschema (mall)
          </h2>
          <p className="small" style={{ margin: '4px 0 0', maxWidth: 560, color: 'var(--c-ink-3)' }}>
            Mallen gäller ALLA veckor — bokbara starttider per veckodag, inte fasta arbetspass.
            Avvikelser (semester, sjukdom) läggs som frånvaro ovan.
          </p>
        </div>

        {/* Grundtiderna läggs en gång — låset kräver ett uttryckligt "Lås upp"
            (med bekräftelse + automatisk kopia) innan något går att ändra. */}
        <ScheduleLock>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <ScheduleActions staffId={selected.id} />
          </div>

          <SlotManager
            staffId={selected.id}
            staff={staffChips}
            rows={slots}
            weekCols={weekCols}
            locations={locations}
            defaultLocationId={defaultLocationId}
          />

          {/* Arbetstider (öppet–stängt) — rastret de bokbara tiderna genereras ur. */}
          <WorkingHoursEditor
            staffId={selected.id}
            staffName={selected.displayName}
            rows={rows}
            locations={locations}
            defaultLocationId={defaultLocationId}
          />
        </ScheduleLock>
      </section>
    </section>
  )
}
