import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import { listStaff, listWorkingHours, listWorkingHourSlots, listLocations, listServices } from '@/lib/admin/data'
import { listCurrentAndUpcomingTimeOff } from '@/lib/admin/schedule-data'
import { buildWeekBoard } from '@/lib/admin/schedule-board'
import { resolvePlats } from '@/lib/admin/plats'
import { addDays } from '@/lib/personal/format'
import { weekdayOf } from '@/lib/booking/tz'
import {
  SlotManager,
  ScheduleActions,
  WorkingHoursEditor,
  type WeekCol,
  type StaffChip,
} from '@/components/admin/SlotManager'
import { ScheduleWeekBoard } from '@/components/admin/ScheduleWeekBoard'
import { TimeOffManager, type TimeOffItem } from '@/components/admin/TimeOffManager'
import { ScheduleLock } from '@/components/admin/ScheduleLock'
import { StaffBookability } from '@/components/admin/StaffBookability'
import { PageHead, Card } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schema · Adminpanel' }

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
  const user = await requireAdminArea('scheman')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Schema" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
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
            Schemat sätts per {staffNoun.toLowerCase()} — skapa minst en under <em>{staffPlural}</em>, så fylls
            veckoöversikten här.
          </p>
        </Card>
      </section>
    )
  }

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const nowIso = new Date().toISOString()

  const [rows, slots, allLocations, upcomingTimeOff, allServices] = await Promise.all([
    listWorkingHours(tenant.id, selected.id),
    listWorkingHourSlots(tenant.id, selected.id),
    listLocations(tenant.id),
    listCurrentAndUpcomingTimeOff(tenant.id, nowIso),
    listServices(tenant.id),
  ])

  // Bara AKTIVA platser erbjuds (en inaktiv ska inte ta nya schemalagda timmar).
  const locations = allLocations.filter((l) => l.active)

  // Vecko-brädan (dagar, rader, etiketter, plats-filter) — delad med Schemavy-
  // kiosken via buildWeekBoard så de två vyerna aldrig glider isär.
  const board = await buildWeekBoard({
    tenantId: tenant.id,
    timeZone: tenant.timeZone,
    staff,
    locations: locations.map((l) => ({ id: l.id, name: l.name })),
    week: sp.week,
    // ?plats= vinner; utan param gäller topbarens valda butik (corevo-plats-cookien).
    plats: await resolvePlats(
      sp.plats,
      locations.map((l) => l.id),
    ),
    selectedStaffId: selected.id,
  })

  // Mall-redigerarnas default-plats följer filtret när ett är valt; annars samma
  // fallback-kedja som serveraction:en (medarbetarens plats → tenant-primär).
  const defaultLocationId =
    board.plats || selected.location_id || tenant.locationId || locations[0]?.id || ''

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
  const weekCols: WeekCol[] = board.days.map((d) => ({
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
        weekLabel={board.weekLabel}
        isCurrentWeek={board.isCurrentWeek}
        days={board.days}
        rows={board.rows}
        prevWeek={addDays(board.weekMonday, -7)}
        nextWeek={addDays(board.weekMonday, 7)}
        todayWeek={board.currentMonday}
        selectedStaffId={selected.id}
        plats={board.plats}
        locations={board.multiLoc ? locations.map((l) => ({ id: l.id, name: l.name })) : []}
        staffNoun={staffPlural}
        staffSingular={staffNoun}
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
          overlay i veckoöversikten. Heldagar anges i tidszonen {tenant.timeZone}.
        </p>
        <TimeOffManager
          items={timeOffItems}
          staffOptions={staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.displayName }))}
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
            Avvikelser (semester, sjukdom) läggs som frånvaro ovan. Publika sidans öppettider är
            bara visning och styr aldrig vad som går att boka — det gör tiderna här.
          </p>
        </div>

        {/* Bokningsbarheten (aktiv + tjänster) på SAMMA yta som tiderna — hela
            "vem kan bokas när"-regeln syns och ändras här (Zivar 2026-07-11).
            Ligger UTANFÖR schemalåset: att inaktivera någon akut ska inte kräva
            "Lås upp". */}
        <StaffBookability
          key={selected.id}
          staffId={selected.id}
          staffName={selected.displayName}
          active={selected.active}
          serviceIds={selected.serviceIds}
          services={allServices.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        />

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
