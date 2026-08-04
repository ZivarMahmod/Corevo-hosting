import type { Database } from '@corevo/db'
import type { SupabaseClient } from '@supabase/supabase-js'

type LocationAvailability = Pick<
  Database['public']['Tables']['locations']['Row'],
  'id' | 'timezone' | 'slot_step_min' | 'min_notice_min' | 'max_advance_days'
>

export type ConfirmedLocationWindow = Pick<
  Database['public']['Tables']['location_opening_hours']['Row'],
  'weekday' | 'start_time' | 'end_time'
> & { confirmed_at: string }

export async function loadLocationAvailability(
  client: SupabaseClient<Database>,
  tenantId: string,
  locationId: string,
): Promise<{
  location: LocationAvailability
  confirmedHours: ConfirmedLocationWindow[]
} | null> {
  const locationResult = await client
    .from('locations')
    .select('id, timezone, slot_step_min, min_notice_min, max_advance_days')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle()
  const location = locationResult.data
  if (locationResult.error) {
    throw new Error(`loadLocationAvailability.location: ${locationResult.error.message}`)
  }
  if (!location) return null

  const hoursResult = await client
    .from('location_opening_hours')
    .select('weekday, start_time, end_time, confirmed_at')
    .eq('tenant_id', tenantId)
    .eq('location_id', locationId)
    .not('confirmed_at', 'is', null)

  if (hoursResult.error) {
    throw new Error(`loadLocationAvailability.hours: ${hoursResult.error.message}`)
  }

  return {
    location,
    confirmedHours: (hoursResult.data ?? []).filter(
      (row): row is ConfirmedLocationWindow => row.confirmed_at !== null,
    ),
  }
}
