import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

/** Fallback when a tenant has not configured a cancellation deadline. */
export const DEFAULT_CANCELLATION_CUTOFF_HOURS = 24

/**
 * The tenant's cancellation / rebooking deadline, in hours before the booking
 * start. There is no dedicated column for it (schema is shared/frozen this
 * wave), so it lives in `tenant_settings.settings` JSON as
 * `cancellation_cutoff_hours` and is read app-side with a safe default.
 */
export async function getCancellationCutoffHours(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const settings = (data?.settings ?? {}) as Record<string, unknown>
  const raw = settings.cancellation_cutoff_hours
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CANCELLATION_CUTOFF_HOURS
}

/** True when `startTs` is still far enough away to allow cancel/rebook. */
export function withinCancellationWindow(startTs: string, cutoffHours: number, now = new Date()): boolean {
  const start = new Date(startTs).getTime()
  return start - now.getTime() >= cutoffHours * 3_600_000
}
