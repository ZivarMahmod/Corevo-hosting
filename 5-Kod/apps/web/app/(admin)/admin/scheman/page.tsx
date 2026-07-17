import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import {
  listStaff,
  listWorkingHours,
  listWorkingHourSlots,
  listLocations,
  listServices,
} from '@/lib/admin/data'
import { listCurrentAndUpcomingTimeOff, listLocationOpeningHours } from '@/lib/admin/schedule-data'
import { buildWeekBoard } from '@/lib/admin/schedule-board'
import { resolvePlats } from '@/lib/admin/plats'
import { requiredLocationId } from '@/lib/admin/location-scope'
import { getAdminLocationPreferences } from '@/lib/admin/location-context'
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
import { LocationOpeningHours } from '@/components/admin/LocationOpeningHours'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead, Card } from '@/components/portal/ui'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schema · Adminpanel' }

/** Frånvaro-intervall i tenantens tz. Heldagar (00:00 → nästa dag 00:00) visas
 *  som inklusiva dagar; udda tider (personal-anmäld frånvaro) behåller klockslag
 *  — ärlig visning av det lagrade intervallet. */
function timeOffRangeLabel(startTs: string, endTs: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  })
  const time = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone })
  const start = new Date(startTs)
  const end = new Date(endTs)
  const startLabel =
    time.format(start) === '00:00'
      ? day.format(start)
      : `${day.format(start)} ${time.format(start)}`
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
  const canManageStaff = user.platformAdmin || user.roleLevel >= 6
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="scheman" title="Schema" />
  }

  const staffNoun = resolveTerm(tenant.terminology, 'staff', 'Medarbetare')
  const staffPlural = termPlural(tenant.terminology, 'staff', 'Personal')
  const settings = settingsCategories(tenant.terminology)

  const [allStaff, allLocations, allLocationHours, preferences] = await Promise.all([
    listStaff(tenant.id),
    listLocations(tenant.id),
    listLocationOpeningHours(tenant.id),
    getAdminLocationPreferences(user.id),
  ])

  // Platsens öppettider kräver alltid EN exakt plats. Ett uttryckligt giltigt val
  // vinner; "Alla" faller tillbaka till primär plats i stället för att blanda regler.
  const locations = allLocations.filter((location) => location.active)
  const requestedLocationId = await resolvePlats(
    sp.plats,
    locations.map((location) => location.id),
  )
  const resolvedLocationId = requiredLocationId(
    requestedLocationId,
    locations.map((location) => location.id),
    preferences.primaryLocationId,
  )
  const openingLocation = locations.find((location) => location.id === resolvedLocationId)
  if (!resolvedLocationId || !openingLocation) {
    return (
      <SettingsWorkspace categories={settings} currentCategory="scheman">
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Schema" />
        <p className="prose">Välj en tillåten primär plats innan schemat kan öppnas.</p>
      </section>
      </SettingsWorkspace>
    )
  }
  const timeZone = openingLocation.timezone || tenant.timeZone
  const staff = allStaff.filter((person) => person.location_id === resolvedLocationId)
  const openingRows = openingLocation
    ? allLocationHours.filter((row) => row.location_id === openingLocation.id)
    : []
  const openingLocationRecord = openingLocation as typeof openingLocation & {
    slot_step_min?: number
    min_notice_min?: number
    max_advance_days?: number
  }
  const locationOpeningHours = (
    <LocationOpeningHours
      key={openingLocationRecord.id}
      location={{
        id: openingLocationRecord.id,
        name: openingLocationRecord.name,
        slotStepMin: openingLocationRecord.slot_step_min ?? 15,
        minNoticeMin: openingLocationRecord.min_notice_min ?? 0,
        maxAdvanceDays: openingLocationRecord.max_advance_days ?? 365,
      }}
      rows={openingRows}
    />
  )

  if (staff.length === 0) {
    return (
      <SettingsWorkspace categories={settings} currentCategory="scheman">
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Schema" />
        {locationOpeningHours}
        <Card>
          <p className="body" style={{ margin: 0 }}>
            <strong>Lägg till {staffNoun.toLowerCase()} först.</strong>
          </p>
          <p className="small" style={{ marginTop: 6 }}>
            Schemat sätts per {staffNoun.toLowerCase()} — skapa minst en under{' '}
            <em>{staffPlural}</em>, så fylls veckoöversikten här.
          </p>
        </Card>
      </section>
      </SettingsWorkspace>
    )
  }

  const selected = staff.find((s) => s.id === sp.staff) ?? staff[0]!
  const nowIso = new Date().toISOString()

  const [allRows, allSlots, upcomingTimeOff, allServices] = await Promise.all([
    listWorkingHours(tenant.id, selected.id),
    listWorkingHourSlots(tenant.id, selected.id),
    listCurrentAndUpcomingTimeOff(tenant.id, nowIso, resolvedLocationId),
    listServices(tenant.id),
  ])
  const rows = allRows.filter((row) => row.location_id === resolvedLocationId)
  const slots = allSlots.filter((row) => row.location_id === resolvedLocationId)
  const services = allServices.filter(
    (service) => service.location_id === null || service.location_id === resolvedLocationId,
  )

  // Vecko-brädan (dagar, rader, etiketter, plats-filter) — delad med Schemavy-
  // kiosken via buildWeekBoard så de två vyerna aldrig glider isär.
  const board = await buildWeekBoard({
    tenantId: tenant.id,
    timeZone,
    staff,
    locations: [{ id: openingLocation.id, name: openingLocation.name }],
    week: sp.week,
    // ?plats= vinner; utan param gäller topbarens valda butik (corevo-plats-cookien).
    plats: resolvedLocationId,
    selectedStaffId: selected.id,
  })

  // Mall-redigerarnas default-plats följer filtret när ett är valt; annars samma
  // fallback-kedja som serveraction:en (medarbetarens plats → tenant-primär).
  const defaultLocationId = resolvedLocationId

  // ── Frånvaro-listan (hela teamet, pågående + kommande) ─────────────────────
  const staffNameById = new Map<string, string>(staff.map((s) => [s.id, s.displayName]))
  const timeOffItems: TimeOffItem[] = upcomingTimeOff.map((t) => ({
    id: t.id,
    staffName: staffNameById.get(t.staff_id) ?? 'Okänd medarbetare',
    rangeLabel: timeOffRangeLabel(t.start_ts, t.end_ts, timeZone),
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
    <SettingsWorkspace categories={settings} currentCategory="scheman">
    <section className="portal-section">
      <PageHead
        eyebrow={`${tenant.name} · Schema`}
        title="Schema"
        lede="Hela teamets vecka i ett svep — bläddra framåt och bakåt, se frånvaro och bokningstryck, och justera grundtiderna längre ner."
      />

      {locationOpeningHours}

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
        locations={[]}
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
        <p
          className="small"
          style={{ margin: '4px 0 12px', maxWidth: 560, color: 'var(--c-ink-3)' }}
        >
          Semester, sjukdom och annan ledighet — blockerar bokningar för perioden och visas som
          overlay i veckoöversikten. Heldagar anges i tidszonen {timeZone}.
        </p>
        <TimeOffManager
          items={timeOffItems}
          staffOptions={staff
            .filter((s) => s.active)
            .map((s) => ({ id: s.id, name: s.displayName }))}
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
          <p
            className="small"
            style={{ margin: '4px 0 0', maxWidth: 560, color: 'var(--c-ink-3)' }}
          >
            Mallen gäller alla veckor och visar när den valda medarbetaren arbetar. Avvikelser
            (semester, sjukdom) läggs som frånvaro ovan. En tid kan bokas när både platsens
            öppettider och medarbetarens arbetstid tillåter det.
          </p>
        </div>

        {/* Bokningsbarheten (aktiv + tjänster) på SAMMA yta som tiderna — hela
            "vem kan bokas när"-regeln syns och ändras här (Zivar 2026-07-11).
            Ligger UTANFÖR schemalåset: att inaktivera någon akut ska inte kräva
            "Lås upp". */}
        {canManageStaff ? (
          <StaffBookability
            key={selected.id}
            staffId={selected.id}
            staffName={selected.displayName}
            active={selected.active}
            serviceIds={selected.serviceIds}
            locationId={selected.location_id}
            openingHoursConfirmed={allLocationHours
              .filter((row) => row.location_id === selected.location_id)
              .some((row) => row.confirmed_at !== null)}
            services={services.map((s) => ({
              id: s.id,
              name: s.name,
              active: s.active,
              locationId: s.location_id,
            }))}
            workingDays={new Set(rows.map((row) => row.weekday)).size}
          />
        ) : null}

        {/* Grundtiderna läggs en gång — låset kräver ett uttryckligt "Lås upp"
            (med bekräftelse + automatisk kopia) innan något går att ändra. */}
        <ScheduleLock hasBackup={canManageStaff}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <ScheduleActions staffId={selected.id} />
          </div>

          <SlotManager
            staffId={selected.id}
            staff={staffChips}
            rows={slots}
            weekCols={weekCols}
            locations={[openingLocation]}
            defaultLocationId={defaultLocationId}
          />

          {/* Arbetstider (öppet–stängt) — rastret de bokbara tiderna genereras ur. */}
          <WorkingHoursEditor
            staffId={selected.id}
            staffName={selected.displayName}
            rows={rows}
            locations={[openingLocation]}
            defaultLocationId={defaultLocationId}
          />
        </ScheduleLock>
      </section>
    </section>
    </SettingsWorkspace>
  )
}
