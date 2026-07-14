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
): Promise<TimeOffAdminRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_off')
    .select('*')
    .eq('tenant_id', tenantId)
    .lt('start_ts', toUtc)
    .gt('end_ts', fromUtc)
    .order('start_ts', { ascending: true })
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
): Promise<TimeOffAdminRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('time_off')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('end_ts', nowIso)
    .order('start_ts', { ascending: true })
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
