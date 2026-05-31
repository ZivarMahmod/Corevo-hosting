import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type WorkingHoursRow = {
  id: string
  weekday: number
  startTime: string
  endTime: string
}

export type TimeOffRow = {
  id: string
  startTs: string
  endTs: string
  reason: string | null
}

/** Own working hours, ordered weekday then start. RLS tenant fence + staff_id filter. */
export async function getMyWorkingHours(staffIds: string[]): Promise<WorkingHoursRow[]> {
  if (staffIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('working_hours')
    .select('id, weekday, start_time, end_time')
    .in('staff_id', staffIds)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  return (data ?? []).map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startTime: r.start_time,
    endTime: r.end_time,
  }))
}

/** Own time off, newest start first. */
export async function getMyTimeOff(staffIds: string[]): Promise<TimeOffRow[]> {
  if (staffIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('time_off')
    .select('id, start_ts, end_ts, reason')
    .in('staff_id', staffIds)
    .order('start_ts', { ascending: false })
  return (data ?? []).map((r) => ({
    id: r.id,
    startTs: r.start_ts,
    endTs: r.end_ts,
    reason: r.reason,
  }))
}
