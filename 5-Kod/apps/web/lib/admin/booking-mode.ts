import type { ModuleState } from '@/lib/tenant-modules'

/** Customer-facing copy for the superadmin-owned binary booking module state. */

export type BookingMode = 'pa' | 'av'

/** tenant_modules.state (eller ingen rad alls) → läge. */
export function bookingModeFromState(state: ModuleState | undefined | null): BookingMode {
  return state === 'live' ? 'pa' : 'av'
}

/** Konsekvenstexten — vad som FAKTISKT händer, inte vad flaggan heter. */
export const BOOKING_MODE_COPY: Record<BookingMode, { label: string; consequence: string }> = {
  pa: {
    label: 'På',
    consequence: 'Kunder kan boka tider på din sida.',
  },
  av: {
    label: 'Av',
    consequence:
      'Bokningen är helt avstängd — kunderna erbjuds ingen bokning alls. Bara Corevo kan sätta på den igen.',
  },
}
