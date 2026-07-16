import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { computeSlots, intersectWorkingWindows, type Interval } from '@/lib/booking/availability'
import { loadLocationAvailability } from '@/lib/booking/location-rules'
import { weekdayOf, zonedTimeToUtc } from '@/lib/booking/tz'

/** Lediga tider för ADMIN — kalenderns "visa bokningsbar tid".
 *
 *  EN SANNING (Zivars beslut 2026-07-14): en tid är ledig när den ryms i resursens
 *  ARBETSTID och inte krockar med en bokning eller en blockering. Punkt.
 *
 *  Skillnaden mot det publika flödet (app/boka/actions.ts) är avsiktlig och exakt en:
 *  vi skickar ALDRIG `explicitStarts`. Fasta starttider (working_hour_slots) är en
 *  presentationsregel för självbokande kunder — de får aldrig begränsa vad ägaren kan
 *  boka i sin egen kalender. Motorn (computeSlots) är oförändrad; det är anroparen som
 *  bestämmer, inte en ny flagga i motorn.
 *
 *  Kioskens gamla väg gjorde tvärtom: den byggde "lediga tider" UR working_hour_slots,
 *  så en salong utan slot-rader såg noll lediga tider — därför kändes den aldrig som
 *  Wavy, där hela schemat syns. */

export type AdminSlot = {
  staffId: string
  /** Starttid som UTC ISO — samma format som bokningarnas start_ts. */
  startIso: string
}

/** Fallback-steget när varken tjänsten eller resursen sätter ett eget. 15 min = samma
 *  snappning som kalendergridet, så en klickad lucka alltid finns i listan. */
const DEFAULT_STEP_MIN = 15

export async function adminDaySlots({
  tenantId,
  date,
  timeZone,
  serviceId,
  locationId,
  staffIds,
  now = new Date(),
}: {
  tenantId: string
  /** 'YYYY-MM-DD' i salongens tidszon. */
  date: string
  timeZone: string
  serviceId: string
  locationId: string
  /** Begränsa till vissa resurser (kalenderns resursfilter). Tom/utelämnad = alla. */
  staffIds?: string[]
  now?: Date
}): Promise<AdminSlot[]> {
  const supabase = await createClient()

  const locationAvailability = await loadLocationAvailability(supabase, tenantId, locationId)
  if (!locationAvailability) return []
  const { location, confirmedHours: confirmedLocationHours } = locationAvailability
  const locationTimeZone = location.timezone ?? timeZone

  const { data: service } = await supabase
    .from('services')
    .select('duration_min, slot_step_min, buffer_min, location_id')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle()
  if (
    !service?.duration_min ||
    (service.location_id !== null && service.location_id !== locationId)
  )
    return []

  // Vilka resurser KAN utföra tjänsten? En tid är inte ledig hos någon som inte gör
  // jobbet — det vore en lucka som inte går att boka.
  const { data: canDo } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
  let candidates = (canDo ?? []).map((r) => r.staff_id)
  if (staffIds && staffIds.length > 0) {
    const wanted = new Set(staffIds)
    candidates = candidates.filter((id) => wanted.has(id))
  }
  if (candidates.length === 0) return []

  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, slot_step_min, buffer_min')
    .eq('tenant_id', tenantId)
    .eq('location_id', locationId)
    .eq('active', true)
    .in('id', candidates)
  const active = (staffRows ?? []).map((s) => s.id)
  if (active.length === 0) return []
  const stepByStaff = new Map((staffRows ?? []).map((s) => [s.id, s.slot_step_min]))
  const bufferByStaff = new Map((staffRows ?? []).map((s) => [s.id, s.buffer_min]))

  const weekday = weekdayOf(date)
  const hoursQuery = supabase
    .from('working_hours')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', tenantId)
    .eq('location_id', locationId)
    .eq('weekday', weekday)
    .in('staff_id', active)
  const { data: hours } = await hoursQuery

  const hasConfirmedLocationHours = confirmedLocationHours.length > 0
  const locationWindows = confirmedLocationHours
    .filter((window) => window.weekday === weekday)
    .map((window) => ({ start: window.start_time, end: window.end_time }))

  // Upptagen tid = bokningar + blockeringar, via samma RPC som publika flödet. En
  // andra beräkning här hade kunnat säga något annat än sajten — det är precis den
  // sortens andra sanning vi tar bort.
  const dayStart = zonedTimeToUtc(date, '00:00', locationTimeZone)
  // +26h täcker en 25-timmarsdag vid vinterttidsomställning utan att missa sen busy-tid.
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60 * 1000)
  const { data: busyRows, error: busyError } = await supabase.rpc('get_busy_intervals', {
    p_tenant: tenantId,
    p_staff_ids: active,
    p_from: dayStart.toISOString(),
    p_to: dayEnd.toISOString(),
  })
  if (busyError) throw new Error('busy_intervals_unavailable')

  const windowsByStaff = new Map<string, { start: string; end: string }[]>()
  for (const w of hours ?? []) {
    const list = windowsByStaff.get(w.staff_id) ?? []
    list.push({ start: w.start_time, end: w.end_time })
    windowsByStaff.set(w.staff_id, list)
  }

  const busyByStaff = new Map<string, Interval[]>()
  for (const b of (busyRows ?? []) as { staff_id: string; start_ts: string; end_ts: string }[]) {
    const list = busyByStaff.get(b.staff_id) ?? []
    list.push({ start: new Date(b.start_ts), end: new Date(b.end_ts) })
    busyByStaff.set(b.staff_id, list)
  }

  const out: AdminSlot[] = []
  const minimumStart = new Date(now.getTime() + location.min_notice_min * 60_000)
  const maximumStart = new Date(now.getTime() + location.max_advance_days * 86_400_000)
  if (dayStart.getTime() > maximumStart.getTime()) return out
  for (const staffId of active) {
    const windows = windowsByStaff.get(staffId)
    if (!windows || windows.length === 0) continue // arbetar inte den dagen
    const starts = computeSlots({
      date,
      timeZone: locationTimeZone,
      workingWindows: hasConfirmedLocationHours
        ? intersectWorkingWindows(windows, locationWindows)
        : windows,
      busy: busyByStaff.get(staffId) ?? [],
      durationMin: service.duration_min,
      slotStepMin:
        service.slot_step_min ??
        stepByStaff.get(staffId) ??
        location.slot_step_min ??
        DEFAULT_STEP_MIN,
      bufferMin: service.buffer_min ?? bufferByStaff.get(staffId) ?? 0,
      // INGA explicitStarts — se filhuvudet. Ägaren bokar fritt i sin arbetstid.
      now: minimumStart,
    })
    for (const s of starts) {
      if (s <= maximumStart) out.push({ staffId, startIso: s.toISOString() })
    }
  }
  return out
}
