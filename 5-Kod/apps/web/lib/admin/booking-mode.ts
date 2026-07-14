import type { ModuleState } from '@/lib/tenant-modules'

/** L3 C-03 — bokningsregler som BEGRIPLIGA LÄGEN, inte råa flaggor.
 *
 *  Lägena är inte uppfunna: de ÄR tenant_modules.state för modulen `booking`
 *  (lib/admin/modules.ts + lib/tenant-modules.ts). Ingen ny flaggmekanism.
 *
 *    live   → På      (saknad rad = live, den historiska defaulten)
 *    paused → Pausad  (publika CTA:erna blir inerta + "stängt"-banner)
 *    draft  → Pausad  (aldrig publik — men kunden FÅR tända den, se nedan)
 *    off    → Av      (bokning erbjuds inte alls)
 *
 *  VIKTIGT (DB-sanning, migration 0026 tenant_modules_state_guard): den enda
 *  övergång som kräver super-admin är den som LÄMNAR 'off' (modul-AKTIVERING).
 *  Allt annat — draft↔live↔paused — får kunden göra själv.
 *
 *  Därför är BARA 'off' den enkelriktade dörren, och bara 'av' är ett läge vi
 *  VISAR men aldrig låter kunden välja. `draft` hörde tidigare hit också, vilket
 *  var fel: kunden fick höra att bara Corevo kunde tända bokningen, fast DB
 *  släppte igenom draft→live. draft är helt enkelt "inte publik än" = Pausad.
 */

export type BookingMode = 'pa' | 'pausad' | 'av'

/** Lägen kunden själv får sätta (DB-vakten tillåter live↔paused, aldrig off→på). */
export const SWITCHABLE_MODES: readonly BookingMode[] = ['pa', 'pausad'] as const

/** tenant_modules.state (eller ingen rad alls) → läge. */
export function bookingModeFromState(state: ModuleState | undefined | null): BookingMode {
  if (state === undefined || state === null) return 'pa' // saknad rad = live (historisk default)
  if (state === 'live') return 'pa'
  if (state === 'paused' || state === 'draft') return 'pausad' // varken är publik; båda går att tända
  return 'av' // bara 'off' — den enkelriktade dörren
}

/** Läge → det state vi skriver. Bara de växlingsbara lägena går att skriva. */
export function stateForMode(mode: BookingMode): ModuleState | null {
  if (mode === 'pa') return 'live'
  if (mode === 'pausad') return 'paused'
  return null // Av skrivs aldrig av kunden (enkelriktad dörr — se filhuvudet)
}

/** Får kunden byta från `current` till `next`? */
export function canSwitch(current: BookingMode, next: BookingMode): boolean {
  if (current === 'av') return false // bara Corevo kan sätta på igen
  return SWITCHABLE_MODES.includes(next) && next !== current
}

/** Konsekvenstexten — vad som FAKTISKT händer, inte vad flaggan heter. */
export const BOOKING_MODE_COPY: Record<BookingMode, { label: string; consequence: string }> = {
  pa: {
    label: 'På',
    consequence: 'Kunder kan boka tider på din sida.',
  },
  pausad: {
    label: 'Pausad',
    consequence:
      'Kunder kan inte boka nya tider — sidan visar att bokningen är stängd. Befintliga bokningar står kvar och du bokar själv i kalendern.',
  },
  av: {
    label: 'Av',
    consequence:
      'Bokningen är helt avstängd — kunderna erbjuds ingen bokning alls. Bara Corevo kan sätta på den igen.',
  },
}

/** Parsar formulärets läge-fält (okänt värde → null → action nekar). */
export function parseBookingMode(raw: unknown): BookingMode | null {
  return raw === 'pa' || raw === 'pausad' || raw === 'av' ? raw : null
}
