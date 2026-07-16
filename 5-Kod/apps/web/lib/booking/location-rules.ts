type LocationAvailability = {
  id: string
  timezone: string
  slot_step_min: number
  min_notice_min: number
  max_advance_days: number
}

export type ConfirmedLocationWindow = {
  weekday: number
  start_time: string
  end_time: string
  confirmed_at: string
}

type QueryResult<T> = { data: T | null; error: { message: string } | null }
type FoundationQuery<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: string): FoundationQuery<T>
  not(column: string, operator: 'is', value: null): FoundationQuery<T>
  maybeSingle(): PromiseLike<QueryResult<T extends Array<infer Row> ? Row : T>>
}
type FoundationClient = {
  from(table: string): {
    select(columns: string): FoundationQuery<LocationAvailability | ConfirmedLocationWindow[]>
  }
}

/** Narrow adapter until generated DB types include migrations 0076–0077. */
export async function loadLocationAvailability(
  client: unknown,
  tenantId: string,
  locationId: string,
): Promise<{
  location: LocationAvailability
  confirmedHours: ConfirmedLocationWindow[]
} | null> {
  const db = client as FoundationClient
  const locationResult = await db
    .from('locations')
    .select('id, timezone, slot_step_min, min_notice_min, max_advance_days')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .eq('active', 'true')
    .maybeSingle()
  const location = locationResult.data as LocationAvailability | null
  if (locationResult.error) {
    throw new Error(`loadLocationAvailability.location: ${locationResult.error.message}`)
  }
  if (!location) return null

  const hoursResult = await db
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
    confirmedHours: (hoursResult.data ?? []) as ConfirmedLocationWindow[],
  }
}
