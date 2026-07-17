import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm, termPlural } from '@/lib/platform/verticals-shared'
import { listServices, listStaff, listLocations } from '@/lib/admin/data'
import { listAllWorkingHours, listLocationOpeningHours } from '@/lib/admin/schedule-data'
import { staffReadiness } from '@/lib/admin/staff-readiness'
import { getStaffScheduleWithNotes, dayRangeUtc } from '@/lib/personal/calendar'
import { todayInTz } from '@/lib/personal/format'
import {
  StaffRoster,
  AddStaffButton,
  type StaffCard,
  type StaffDayRow,
  type ServiceOption,
} from '@/components/admin/StaffRoster'
import { PageHead, Card } from '@/components/portal/ui'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal · Adminpanel' }

export default async function StaffPage() {
  const user = await requireAdminArea('personal')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="personal" title="Personal" />
  }

  const [staff, services, locations, openingHours, workingHours] = await Promise.all([
    listStaff(tenant.id, { includeBookingCount: true }),
    listServices(tenant.id),
    listLocations(tenant.id),
    listLocationOpeningHours(tenant.id),
    listAllWorkingHours(tenant.id),
  ])
  const activeLocations = locations.filter((location) => location.active)
  const defaultStaffLocationId = activeLocations.some(
    (location) => location.id === tenant.locationId,
  )
    ? tenant.locationId!
    : (activeLocations[0]?.id ?? '')

  // Each staff member's REAL day — one batched read for the whole roster, then
  // grouped by staff_id. getStaffScheduleWithNotes is RLS-tenant-fenced; cancelled
  // bookings are excluded (mock SalonStaff dayOf = status !== "avbokad"). The
  // prefs/note enrichment goes unused on this minimal admin list (harmless).
  const today = todayInTz(tenant.timeZone)
  const { fromUtc, toUtc } = dayRangeUtc(today, tenant.timeZone)
  const staffIds = staff.map((s) => s.id)
  const todaysSchedule = await getStaffScheduleWithNotes(staffIds, fromUtc, toUtc)
  const dayByStaff = new Map<string, StaffDayRow[]>()
  for (const b of todaysSchedule) {
    if (b.status === 'cancelled') continue
    const row: StaffDayRow = {
      id: b.id,
      startTs: b.startTs,
      status: b.status,
      serviceName: b.serviceName,
      customerLabel: b.customerLabel,
    }
    const list = dayByStaff.get(b.staffId)
    if (list) list.push(row)
    else dayByStaff.set(b.staffId, [row])
  }

  // Resolve location_id → name for the roster cards (multi-location is real —
  // location_id is an FK; KEEP it). Missing pin → null (written empty-state).
  const locationName = new Map<string, string>(locations.map((l) => [l.id, l.name]))

  // service_id → name, so each card's chips show the REAL coupled service names
  // (the mock's specialty chips bound to staff_services). The full {id,name} set
  // also feeds the Drawer's tjänst-coupling checkboxes (setStaffServices).
  const serviceName = new Map<string, string>(services.map((sv) => [sv.id, sv.name]))
  const serviceOptions: ServiceOption[] = services.map((sv) => ({
    id: sv.id,
    name: sv.name,
    active: sv.active,
    locationId: sv.location_id,
  }))
  const confirmedLocations = new Set(
    openingHours.filter((row) => row.confirmed_at !== null).map((row) => row.location_id),
  )

  const cards: StaffCard[] = staff.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    title: s.title,
    active: s.active,
    bookingCount: s.bookingCount,
    serviceCount: s.serviceIds.length,
    serviceIds: s.serviceIds,
    serviceNames: s.serviceIds
      .map((id) => serviceName.get(id))
      .filter((n): n is string => Boolean(n)),
    // Eget konto = staff har en kopplad inloggning (profile_id != null). Härlett,
    // aldrig fejkat — magic-link-inbjudan sätter profile_id (se inviteStaff).
    hasAccount: Boolean(s.profile_id),
    locationName: (s.location_id && locationName.get(s.location_id)) || null,
    locationId: s.location_id,
    readiness: staffReadiness({
      active: s.active,
      locationId: s.location_id,
      openingHoursConfirmed: Boolean(s.location_id && confirmedLocations.has(s.location_id)),
      workingHoursCount: workingHours.filter(
        (row) => row.staff_id === s.id && row.location_id === s.location_id,
      ).length,
      serviceIds: s.serviceIds,
      services: serviceOptions,
    }),
    // Foto + synlighet på publika team-sektionen (0049) — redigeras i drawerns
    // "Foto & synlighet på sidan" (updateStaff-partialpatch).
    avatarUrl: s.avatar_url,
    showOnSite: s.show_on_site,
    color: s.color ?? null,
    today: (dayByStaff.get(s.id) ?? []).sort((a, b) => (a.startTs < b.startTs ? -1 : 1)),
  }))

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="personal">
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title={termPlural(tenant.terminology, 'staff', 'Personal')}
        lede="Varje medarbetares riktiga dag — speglad live. Bokningsstatusen visar nästa sak som behöver bli klar: plats, öppettider, tjänster, arbetstider eller aktivering."
      >
        <AddStaffButton
          locations={activeLocations}
          defaultLocationId={defaultStaffLocationId}
        />
      </PageHead>

      {/* Personalöversikt — RICH kort per medarbetare (forest-avatar, namn, roll-rad,
          tjänst-chips ur staff_services, muted Aktiv-pill, plats · idag-antal).
          Klick öppnar Drawer med namnredigering,
          tjänst-koppling, eget-konto + magic-link, multi-location, verklig dag och
          säker arkivering/borttagning — all redigering som tidigare låg i StaffManager,
          nu samlad här. Inga påhittade fält. */}
      {staff.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--c-ink-2)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
              Ingen personal ännu.
            </strong>
            Tryck på “Lägg till” ovan för att skapa din första medarbetare och koppla sedan vilka
            tjänster hen utför — då blir hen bokningsbar på din publika sajt.
          </div>
        </Card>
      ) : (
        <StaffRoster
          staff={cards}
          services={serviceOptions}
          locations={activeLocations.map((l) => ({ id: l.id, name: l.name }))}
          tz={tenant.timeZone}
          staffNoun={resolveTerm(tenant.terminology, 'staff', 'Medarbetare')}
        />
      )}
    </section>
    </SettingsWorkspace>
  )
}
