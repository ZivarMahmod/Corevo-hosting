import { moduleState, type TenantModuleStates } from '@/lib/tenant-modules'

export type BookingModuleAccess = 'hidden' | 'paused' | 'live'

/** Missing booking row preserves the legacy/default-on booking contract. */
export function bookingModuleAccess(states: TenantModuleStates): BookingModuleAccess {
  const state = moduleState(states, 'booking')
  if (state === 'paused') return 'paused'
  if (state === 'live') return 'live'
  return 'hidden'
}
