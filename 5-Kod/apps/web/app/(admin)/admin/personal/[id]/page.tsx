import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAnyAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminLocationPreferences } from '@/lib/admin/location-context'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import { listServices, listStaff, listLocations, listWorkingHourSlots } from '@/lib/admin/data'
import {
  listAllWorkingHours,
  listCurrentAndUpcomingStaffTimeOff,
  listLocationOpeningHours,
  timeOffRangeLabel,
} from '@/lib/admin/schedule-data'
import { staffReadiness } from '@/lib/admin/staff-readiness'
import { getStaffScheduleWithNotes, dayRangeUtc } from '@/lib/personal/calendar'
import { addDays, mondayOf, todayInTz } from '@/lib/personal/format'
import { weekdayOf } from '@/lib/booking/tz'
import {
  DEFAULT_MEMBER_PERMISSIONS,
  getMemberPermissions,
  hasAdminAreaPermission,
} from '@/lib/admin/member-permissions'
import { StaffDetail } from '@/components/admin/StaffDetail'
import {
  type StaffCard,
  type StaffDayRow,
  type ServiceOption,
} from '@/components/admin/StaffRoster'
import type { WeekCol } from '@/components/admin/SlotManager'
import type { TimeOffItem } from '@/components/admin/TimeOffManager'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { settingsCategories } from '@/lib/admin/settings-map'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Medarbetare · Adminpanel' }

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAnyAdminArea(['personal', 'scheman'])
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="personal" title="Personal" />
  }

  const [staff, services, locations, openingHours, workingHours, permissions] = await Promise.all([
    listStaff(tenant.id, { includeBookingCount: true }),
    listServices(tenant.id),
    listLocations(tenant.id),
    listLocationOpeningHours(tenant.id),
    listAllWorkingHours(tenant.id),
    getMemberPermissions({ tenantId: tenant.id, staffId: id }).catch(
      () => DEFAULT_MEMBER_PERMISSIONS,
    ),
  ])

  const s = staff.find((member) => member.id === id)
  if (!s) notFound()

  // Roll/behörighet får bara ändras av organisationsägaren — samma grind som
  // roller-fliken (saveMemberPermissions self-guardar ändå). Platschef ser inte
  // en knapp som alltid failar; övriga sektioner är oförändrat personal-gate:ade.
  const [preferences, canManageSchedule, canAccessPersonal] = await Promise.all([
    getAdminLocationPreferences(user.id),
    hasAdminAreaPermission('scheman', user),
    hasAdminAreaPermission('personal', user),
  ])
  const canManageRoles = canAccessPersonal && preferences.accessScope === 'organization'
  const canManageStaff = canAccessPersonal && (user.platformAdmin || user.roleLevel >= 6)
  const ownerStaffLink = staff.find((member) => member.profile_id === user.id)

  const activeLocations = locations.filter((location) => location.active)
  const selectedLocation = activeLocations.find((location) => location.id === s.location_id) ?? null
  const staffTimeZone = selectedLocation?.timezone || tenant.timeZone
  const nowIso = new Date().toISOString()
  const [slots, upcomingTimeOff] = await Promise.all([
    listWorkingHourSlots(tenant.id, s.id),
    listCurrentAndUpcomingStaffTimeOff(tenant.id, s.id, nowIso),
  ])
  const memberWorkingHours = workingHours.filter(
    (row) => row.staff_id === s.id && (!s.location_id || row.location_id === s.location_id),
  )
  const memberSlots = slots.filter((row) => !s.location_id || row.location_id === s.location_id)

  // Denna medarbetares riktiga dag — samma tenant-fence + cancelled-exkludering
  // som roster-sidan, men bara för den här staff_id:t.
  const today = todayInTz(staffTimeZone)
  const { fromUtc, toUtc } = dayRangeUtc(today, staffTimeZone)
  const todaysSchedule = await getStaffScheduleWithNotes([s.id], fromUtc, toUtc)
  const todayRows: StaffDayRow[] = todaysSchedule
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({
      id: b.id,
      startTs: b.startTs,
      status: b.status,
      serviceName: b.serviceName,
      customerLabel: b.customerLabel,
    }))
    .sort((a, b) => (a.startTs < b.startTs ? -1 : 1))

  const locationName = new Map<string, string>(locations.map((l) => [l.id, l.name]))
  const serviceName = new Map<string, string>(services.map((sv) => [sv.id, sv.name]))
  const serviceOptions: ServiceOption[] = services.map((sv) => ({
    id: sv.id,
    name: sv.name,
    active: sv.active,
    locationId: sv.location_id,
    durationMin: sv.duration_min,
  }))
  const confirmedLocations = new Set(
    openingHours.filter((row) => row.confirmed_at !== null).map((row) => row.location_id),
  )
  const weekMonday = mondayOf(today)
  const weekCols: WeekCol[] = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekMonday, index)
    const weekday = weekdayOf(date)
    return {
      wd: weekday,
      name: ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'][weekday]!,
      dayOfMonth: Number(date.slice(8, 10)),
      isToday: date === today,
    }
  })
  const timeOffItems: TimeOffItem[] = upcomingTimeOff.map((row) => ({
    id: row.id,
    staffName: s.displayName,
    rangeLabel: timeOffRangeLabel(row.start_ts, row.end_ts, staffTimeZone),
    reason: row.reason,
    ongoing: row.start_ts <= nowIso,
  }))

  // Samma StaffCard-mappning som roster-sidan (app/(admin)/admin/personal/page.tsx).
  const card: StaffCard = {
    id: s.id,
    displayName: s.displayName,
    title: s.title,
    active: s.active,
    bookingCount: s.bookingCount,
    serviceCount: s.serviceIds.length,
    serviceIds: s.serviceIds,
    serviceNames: s.serviceIds
      .map((sid) => serviceName.get(sid))
      .filter((n): n is string => Boolean(n)),
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
    avatarUrl: s.avatar_url,
    showOnSite: s.show_on_site,
    color: s.color ?? null,
    today: todayRows,
  }

  return (
    <SettingsWorkspace
      categories={settingsCategories(tenant.terminology)}
      currentCategory={canAccessPersonal ? 'personal' : 'scheman'}
    >
      <StaffDetail
        member={card}
        services={serviceOptions}
        locations={activeLocations.map((l) => ({ id: l.id, name: l.name }))}
        tz={staffTimeZone}
        staffNoun={resolveTerm(tenant.terminology, 'staff', 'Medarbetare')}
        permissions={permissions}
        canManagePersonal={canAccessPersonal}
        canManageStaff={canManageStaff}
        canManageRoles={canManageRoles}
        canManageSchedule={canManageSchedule}
        canLinkCurrentUser={
          !user.platformAdmin && !ownerStaffLink && !s.profile_id && canManageRoles
        }
        openingHoursConfirmed={Boolean(s.location_id && confirmedLocations.has(s.location_id))}
        workingHours={memberWorkingHours}
        slots={memberSlots}
        weekCols={weekCols}
        editorLocations={selectedLocation ? [selectedLocation] : []}
        timeOffItems={timeOffItems}
      />
    </SettingsWorkspace>
  )
}
