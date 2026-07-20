import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import { listStaff, listLocations } from '@/lib/admin/data'
import { listLocationOpeningHours } from '@/lib/admin/schedule-data'
import { buildWeekBoard } from '@/lib/admin/schedule-board'
import { resolvePlats } from '@/lib/admin/plats'
import { requiredLocationId } from '@/lib/admin/location-scope'
import { getAdminLocationPreferences } from '@/lib/admin/location-context'
import { addDays } from '@/lib/personal/format'
import { ScheduleWeekBoard } from '@/components/admin/ScheduleWeekBoard'
import { LocationOpeningHours } from '@/components/admin/LocationOpeningHours'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead, Card } from '@/components/portal/ui'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Schema · Adminpanel' }

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; week?: string; plats?: string }>
}) {
  const sp = await searchParams
  const user = await requireAdminArea('scheman')
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
  const requestedTenantStaff = sp.staff
    ? allStaff.find((person) => person.id === sp.staff)
    : undefined
  if (sp.staff && !requestedTenantStaff) notFound()
  const requestedLocationId = await resolvePlats(
    sp.plats,
    locations.map((location) => location.id),
  )
  // En personlänk utan uttrycklig ?plats= ska alltid öppna personens plats,
  // inte en gammal plats-cookie. Ett uttryckligt felaktigt plats+staff-par fångas
  // fortsatt av requestedStaff-grinden nedan.
  const locationCandidateId =
    !sp.plats && requestedTenantStaff?.location_id
      ? requestedTenantStaff.location_id
      : requestedLocationId
  const resolvedLocationId = requiredLocationId(
    locationCandidateId,
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

  const requestedStaff = sp.staff ? staff.find((person) => person.id === sp.staff) : undefined
  if (sp.staff && !requestedStaff) notFound()
  const selected = requestedStaff ?? staff[0]!
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

  return (
    <SettingsWorkspace categories={settings} currentCategory="scheman">
      <section className="portal-section">
        <PageHead
          eyebrow={`${tenant.name} · Schema`}
          title="Schema"
          lede="Hela teamets vecka i ett svep. Tryck på en medarbetare för att redigera personens arbetstider, bokbara starter och frånvaro på personkortet."
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
          staffLinksToDetails
        />
      </section>
    </SettingsWorkspace>
  )
}
