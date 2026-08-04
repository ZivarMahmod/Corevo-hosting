'use server'

import { createPublicClient } from '@/lib/supabase/public'
import { computeSlots, intersectWorkingWindows } from '@/lib/booking/availability'
import { loadLocationAvailability } from '@/lib/booking/location-rules'
import { canonicalInstant, weekdayOf, zonedTimeToUtc } from '@/lib/booking/tz'
import { getPublicBookingContext, publicBookingIsLive } from './public-context'

export type SlotOption = { start: string; staffId: string; staffTitle: string | null }
export type SlotsResult =
  | { ok: true; timeZone: string; slots: SlotOption[] }
  | { ok: false; error: string }

const SLOT_STEP_MIN = 15

export async function getAvailableSlots(
  serviceId: string,
  staffId: string | null,
  date: string,
  locationId?: string | null,
): Promise<SlotsResult> {
  const ctx = await getPublicBookingContext()
  if (!ctx) return { ok: false, error: 'Något gick fel — ladda om sidan och försök igen.' }
  if (!(await publicBookingIsLive(ctx))) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const supabase = createPublicClient()
  const loc = locationId ?? ctx.locationId
  if (!loc) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const locationAvailability = await loadLocationAvailability(supabase, ctx.tenantId, loc)
  if (!locationAvailability) return { ok: true, timeZone: ctx.timeZone, slots: [] }
  const { location, confirmedHours: confirmedLocationHours } = locationAvailability
  const timeZone = location.timezone ?? ctx.timeZone

  const { data: service } = await supabase
    .from('services')
    .select('duration_min, slot_step_min, buffer_min, location_id')
    .eq('id', serviceId)
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .maybeSingle()
  if (!service || (service.location_id !== null && service.location_id !== loc)) {
    return { ok: false, error: 'Tjänsten finns inte på den valda platsen.' }
  }

  const { data: offers } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('service_id', serviceId)
  let candidateIds = (offers ?? []).map((row) => row.staff_id)
  if (staffId) candidateIds = candidateIds.filter((id) => id === staffId)
  if (candidateIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, title, slot_step_min, buffer_min')
    .eq('tenant_id', ctx.tenantId)
    .eq('location_id', loc)
    .eq('active', true)
    .in('id', candidateIds)
  const staffIds = (staffRows ?? []).map((staff) => staff.id)
  const titleById = new Map((staffRows ?? []).map((staff) => [staff.id, staff.title]))
  const stepByStaff = new Map((staffRows ?? []).map((staff) => [staff.id, staff.slot_step_min]))
  const bufferByStaff = new Map((staffRows ?? []).map((staff) => [staff.id, staff.buffer_min]))
  if (staffIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const weekday = weekdayOf(date)
  const [{ data: hours }, { data: explicitSlotRows }] = await Promise.all([
    supabase
      .from('working_hours')
      .select('staff_id, start_time, end_time')
      .eq('tenant_id', ctx.tenantId)
      .eq('location_id', loc)
      .eq('weekday', weekday)
      .in('staff_id', staffIds),
    supabase
      .from('working_hour_slots')
      .select('staff_id, start_time')
      .eq('tenant_id', ctx.tenantId)
      .eq('location_id', loc)
      .eq('weekday', weekday)
      .eq('active', true)
      .in('staff_id', staffIds),
  ])

  const hasConfirmedLocationHours = confirmedLocationHours.length > 0
  const locationWindows = confirmedLocationHours
    .filter((window) => window.weekday === weekday)
    .map((window) => ({ start: window.start_time, end: window.end_time }))
  const dayStart = zonedTimeToUtc(date, '00:00', timeZone)

  const windowsByStaff = new Map<string, { start: string; end: string }[]>()
  for (const window of hours ?? []) {
    const windows = windowsByStaff.get(window.staff_id) ?? []
    windows.push({ start: window.start_time, end: window.end_time })
    windowsByStaff.set(window.staff_id, windows)
  }
  const explicitByStaff = new Map<string, string[]>()
  for (const row of explicitSlotRows ?? []) {
    const starts = explicitByStaff.get(row.staff_id) ?? []
    starts.push(row.start_time)
    explicitByStaff.set(row.staff_id, starts)
  }

  const requestNow = Date.now()
  const now = new Date(requestNow + location.min_notice_min * 60_000)
  const maximumStart = new Date(requestNow + location.max_advance_days * 86_400_000)
  if (dayStart.getTime() > maximumStart.getTime()) return { ok: true, timeZone, slots: [] }

  const candidateByStart = new Map<string, string[]>()
  for (const id of staffIds) {
    const stepMin = service.slot_step_min ?? stepByStaff.get(id) ?? location.slot_step_min ?? SLOT_STEP_MIN
    const bufferMin = service.buffer_min ?? bufferByStaff.get(id) ?? 0
    const slots = computeSlots({
      date,
      timeZone,
      workingWindows: hasConfirmedLocationHours
        ? intersectWorkingWindows(windowsByStaff.get(id) ?? [], locationWindows)
        : (windowsByStaff.get(id) ?? []),
      busy: [],
      durationMin: service.duration_min,
      slotStepMin: stepMin,
      bufferMin,
      explicitStarts: explicitByStaff.get(id),
      now,
    })
    for (const slot of slots) {
      if (slot > maximumStart) continue
      const start = slot.toISOString()
      const candidates = candidateByStart.get(start)
      if (candidates) candidates.push(id)
      else candidateByStart.set(start, [id])
    }
  }

  const candidateStarts = [...candidateByStart.keys()]
  if (candidateStarts.length === 0) return { ok: true, timeZone, slots: [] }
  type PublicBookableRow = { staff_id: string; start_ts: string }
  type PublicBookableRpc = {
    rpc: (
      name: 'get_public_bookable_starts',
      args: {
        p_tenant: string
        p_location: string
        p_service: string
        p_staff_ids: string[]
        p_starts: string[]
      },
    ) => Promise<{ data: PublicBookableRow[] | null; error: { message?: string } | null }>
  }
  const { data: bookableRows, error: bookableError } = await (
    supabase as unknown as PublicBookableRpc
  ).rpc('get_public_bookable_starts', {
    p_tenant: ctx.tenantId,
    p_location: loc,
    p_service: serviceId,
    p_staff_ids: staffIds,
    p_starts: candidateStarts,
  })
  if (bookableError) return { ok: false, error: 'Kunde inte läsa lediga tider. Försök igen.' }

  const byStart = new Map<string, string[]>()
  for (const row of bookableRows ?? []) {
    const start = canonicalInstant(row.start_ts)
    if (!candidateByStart.get(start)?.includes(row.staff_id)) continue
    const ids = byStart.get(start)
    if (ids) ids.push(row.staff_id)
    else byStart.set(start, [row.staff_id])
  }

  const availableCount = new Map<string, number>()
  for (const ids of byStart.values()) {
    for (const id of ids) availableCount.set(id, (availableCount.get(id) ?? 0) + 1)
  }
  const assignedHere = new Map<string, number>()
  const pickLeastBusy = (ids: string[]): string => {
    let best = ids[0]!
    let bestScore = Infinity
    for (const id of ids) {
      const score = -(availableCount.get(id) ?? 0) + (assignedHere.get(id) ?? 0) * 0.001
      if (score < bestScore) {
        bestScore = score
        best = id
      }
    }
    assignedHere.set(best, (assignedHere.get(best) ?? 0) + 1)
    return best
  }

  const slots: SlotOption[] = [...byStart.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, ids]) => {
      const assignedStaffId = staffId ? ids[0]! : pickLeastBusy(ids)
      return {
        start,
        staffId: assignedStaffId,
        staffTitle: titleById.get(assignedStaffId) ?? null,
      }
    })

  return { ok: true, timeZone, slots }
}
