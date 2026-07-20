import 'server-only'
import type { Tables } from '@corevo/db'
import { createClient } from '@/lib/supabase/server'
import type { WorkingHourRow } from './data'

// Vecko-översikten på /admin/scheman visar HELA teamet på en gång — därför
// tenant-vida läsningar här (till skillnad från listWorkingHours/-Slots i data.ts
// som är per medarbetare). RLS (0002: tenant_id = private.tenant_id()) fencar
// redan till adminens tenant; tenant_id skickas ändå — defence-in-depth + stabil
// ordning, samma kontrakt som resten av admin-datalagret.

export type TimeOffAdminRow = Tables<'time_off'>

/** Frånvarointervall i verksamhetens tidszon. Midnattsslut är en exklusiv
 * gräns och visas därför som föregående, inklusiva kalenderdag. Delas av
 * teamöversikten och det enskilda personkortet. */
export function timeOffRangeLabel(startTs: string, endTs: string, timeZone: string): string {
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
  const endLabel =
    time.format(end) === '00:00'
      ? day.format(new Date(end.getTime() - 60_000))
      : `${day.format(end)} ${time.format(end)}`
  return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
}

// Migration 0076 är additiv och de genererade Supabase-typerna uppdateras först
// när hela schemaändringen är låst. Håll den smala radtypen här tills dess så
// adminytan inte behöver kasta hela klienten till `any`.
export type LocationOpeningHourRow = {
  id: string
  tenant_id: string
  location_id: string
  weekday: number
  start_time: string
  end_time: string
  source: 'confirmed' | 'staff_union' | 'default'
  confirmed_at: string | null
  confirmed_by: string | null
}

type LocationHoursResult = {
  data: LocationOpeningHourRow[] | null
  error: { message: string } | null
}

type LocationHoursQuery = PromiseLike<LocationHoursResult> & {
  eq(column: string, value: string): LocationHoursQuery
  order(column: string, options: { ascending: boolean }): LocationHoursQuery
}

type LocationHoursClient = {
  from(table: string): {
    select(columns: string): LocationHoursQuery
  }
}

/** Platsens egna öppettider. `locationId` används alltid på schemasidan;
 *  utan id får interna batchläsare tenantens RLS-tillåtna rader i en fråga. */
export async function listLocationOpeningHours(
  tenantId: string,
  locationId?: string,
): Promise<LocationOpeningHourRow[]> {
  const supabase = await createClient()
  const locationHours = supabase as unknown as LocationHoursClient
  let query = locationHours
    .from('location_opening_hours')
    .select(
      'id, tenant_id, location_id, weekday, start_time, end_time, source, confirmed_at, confirmed_by',
    )
    .eq('tenant_id', tenantId)
  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw new Error(`listLocationOpeningHours: ${error.message}`)
  return data ?? []
}

/** Alla veckodags-mallar (working_hours) för hela teamet — griden grupperar dem
 *  per staff+weekday app-side, så en enda läsning räcker för hela veckovyn. */
export async function listAllWorkingHours(tenantId: string): Promise<WorkingHourRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('working_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  return data ?? []
}

/** Frånvaro som ÖVERLAPPAR [fromUtc, toUtc) — intervall-överlapp, inte
 *  inneslutning, så en semester som började förra veckan syns ändå som overlay
 *  i den valda veckans grid. */
export async function listTimeOffOverlapping(
  tenantId: string,
  fromUtc: string,
  toUtc: string,
  locationId?: string,
): Promise<TimeOffAdminRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('time_off')
    .select('*')
    .eq('tenant_id', tenantId)
    .lt('start_ts', toUtc)
    .gt('end_ts', fromUtc)
    .order('start_ts', { ascending: true })
  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query
  // Kasta, svälj inte (B-10): osynliga blockeringar p.g.a. datafel gör att en rast
  // ser bokningsbar ut i kalendern — tyst fel på exakt fel ställe.
  if (error) throw new Error(`listTimeOffOverlapping: ${error.message}`)
  return data ?? []
}

/** Pågående + kommande frånvaro (slutet ligger i framtiden) för frånvaro-admin-
 *  listan. Historiken utelämnas medvetet — ytan är ett planeringsverktyg, inte
 *  ett arkiv. */
export async function listCurrentAndUpcomingTimeOff(
  tenantId: string,
  nowIso: string,
  locationId?: string,
): Promise<TimeOffAdminRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('time_off')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('end_ts', nowIso)
    .order('start_ts', { ascending: true })
  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query
  if (error) throw new Error(`listCurrentAndUpcomingTimeOff: ${error.message}`)
  return data ?? []
}

/** Pågående + kommande frånvaro för en enda person. Personkortet får inte
 * platsfiltrera den här läsningen: äldre/globala rader med location_id=null och
 * rader skapade innan ett platsbyte tillhör fortfarande personen. */
export async function listCurrentAndUpcomingStaffTimeOff(
  tenantId: string,
  staffId: string,
  nowIso: string,
): Promise<TimeOffAdminRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .gte('end_ts', nowIso)
    .order('start_ts', { ascending: true })
  if (error) throw new Error(`listCurrentAndUpcomingStaffTimeOff: ${error.message}`)
  return data ?? []
}

/** Bokningsstarter (pending/confirmed) i veckofönstret — bara staff_id +
 *  start_ts behövs; per-dag-bucketing görs i page.tsx i TENANTENS tz (aldrig
 *  serverns lokala), så samma bokning hamnar på samma kolumn som i kalendern. */
export async function listBookingStarts(
  tenantId: string,
  fromUtc: string,
  toUtc: string,
): Promise<{ staff_id: string; start_ts: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('staff_id, start_ts')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_ts', fromUtc)
    .lt('start_ts', toUtc)
  return (data ?? []) as { staff_id: string; start_ts: string }[]
}
