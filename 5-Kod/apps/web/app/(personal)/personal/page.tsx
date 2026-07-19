import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getMemberPermissions } from '@/lib/admin/member-permissions'
import { listLocations, listStaff } from '@/lib/admin/data'
import { getMyServices, getMyStaff } from '@/lib/personal/staff'
import { dayRangeUtc, getStaffScheduleWithNotes } from '@/lib/personal/calendar'
import { addDays, fmtDateHeading, todayInTz } from '@/lib/personal/format'
import { PersonalCalendarPwa, type PersonalStaffOption } from '@/components/personal/PersonalCalendarPwa'
import { PersonalWalkInFab } from '@/components/personal/PersonalWalkInFab'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kalender · Corevo Personal' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ dag?: string; personal?: string }>
}) {
  const user = await requirePortal('personal')
  const mine = await getMyStaff(user.id)
  if (!user.tenantId || mine.length === 0) {
    return (
      <section style={{ padding: 16 }}>
        <p style={{ color: 'var(--c-ink-2)', fontFamily: 'monospace', fontSize: 10 }}>COREVO PERSONAL</p>
        <h1 style={{ color: 'var(--c-ink)', fontSize: 21 }}>Ingen personalprofil kopplad</h1>
        <p style={{ color: 'var(--c-ink-2)', fontSize: 13 }}>Be ägaren koppla ditt personliga konto till din medarbetarrad.</p>
      </section>
    )
  }

  const primary = mine[0]!
  const permissions = user.staffId
    ? await getMemberPermissions({ tenantId: user.tenantId, staffId: user.staffId })
    : null
  const canViewAllCalendars =
    user.roleLevel >= 6 || permissions?.operationalRole === 'manager' || permissions?.canViewAllCalendars === true

  const [team, locations] = canViewAllCalendars
    ? await Promise.all([
        listStaff(user.tenantId).then((rows) => rows.filter((member) => member.active)),
        listLocations(user.tenantId),
      ])
    : [
        mine.map((member) => ({ id: member.id, displayName: member.title?.trim() || user.name || 'Jag' })),
        [],
      ]
  const allowedIds = new Set(team.map((member) => member.id))
  const params = await searchParams
  const requestedStaff = UUID_RE.test(params.personal ?? '') ? params.personal! : primary.id
  const selectedStaffId = allowedIds.has(requestedStaff) ? requestedStaff : primary.id
  const selected = team.find((member) => member.id === selectedStaffId)
  const selectedLocationId = selected && 'location_id' in selected ? selected.location_id : primary.locationId
  const selectedTimeZone =
    locations.find((location) => location.id === selectedLocationId)?.timezone ?? primary.timeZone

  const today = todayInTz(selectedTimeZone)
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.dag ?? '') ? params.dag! : today
  const { fromUtc, toUtc } = dayRangeUtc(day, selectedTimeZone)
  const bookings = await getStaffScheduleWithNotes([selectedStaffId], fromUtc, toUtc)
  const ownCalendar = mine.some((row) => row.id === selectedStaffId)
  const services = ownCalendar ? await getMyServices([selectedStaffId]) : []
  const staffOptions: PersonalStaffOption[] = team.map((member) => ({
    id: member.id,
    label: member.displayName,
    mine: mine.some((row) => row.id === member.id),
  }))

  return (
    <>
      <PersonalCalendarPwa
      heading={fmtDateHeading(day)}
      day={day}
      previousDay={addDays(day, -1)}
      nextDay={addDays(day, 1)}
      todayHref={day === today ? null : `/personal?personal=${selectedStaffId}`}
      bookings={bookings}
      staff={staffOptions}
      selectedStaffId={selected?.id ?? primary.id}
      canViewAllCalendars={canViewAllCalendars}
        ownCalendar={ownCalendar}
      />
      {ownCalendar ? <PersonalWalkInFab services={services} timeZone={selectedTimeZone} /> : null}
    </>
  )
}
