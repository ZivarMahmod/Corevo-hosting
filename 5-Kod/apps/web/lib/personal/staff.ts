import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type MyStaff = {
  id: string
  title: string | null
  locationId: string | null
  timeZone: string
}

type StaffJoinRow = {
  id: string
  title: string | null
  location_id: string | null
  created_at: string
  locations: { timezone: string } | null
}

/**
 * The staff row(s) for the logged-in user. The link is staff.profile_id =
 * users.id (verified against 0001 + seed). RLS scopes staff to the tenant; the
 * profile_id filter scopes to this user. A user usually maps to exactly one
 * staff row, but multi-location setups can have several — callers treat the
 * first as primary (forms/timezone) and act across all ids (own bookings).
 */
export async function getMyStaff(userId: string): Promise<MyStaff[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('staff')
    .select('id, title, location_id, created_at, locations(timezone)')
    .eq('profile_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as unknown as StaffJoinRow[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    locationId: r.location_id,
    timeZone: r.locations?.timezone ?? 'Europe/Stockholm',
  }))
}
