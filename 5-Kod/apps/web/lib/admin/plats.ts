import { cookies } from 'next/headers'

/**
 * Global "vald butik" för kund-admin (Zivar 2026-07-10: "ett val där man väljer
 * vilken butik och då får man inställningar och allt för den"). Valet bor i en
 * cookie som topbarens LocationSwitcher skriver; de plats-medvetna sidorna
 * (Bokningar, Scheman, Bokningsvyn) använder den som DEFAULT när ?plats= saknas.
 * Sidans egna filter vinner alltid — "alla" är sentinel för ett uttryckligt
 * "Alla platser" (annars skulle cookien återta valet så fort parametern föll bort).
 */
export const PLATS_COOKIE = 'corevo-plats'
export const PLATS_ALLA = 'alla'

/** ?plats= (uttryckligt val, 'alla' = alla platser) → annars cookien → annars ''.
 *  Bara id:n i validIds räknas — allt annat blir '' (alla). */
export async function resolvePlats(
  spPlats: string | undefined,
  validIds: string[],
): Promise<string> {
  const raw = spPlats ?? (await cookies()).get(PLATS_COOKIE)?.value ?? ''
  if (raw === PLATS_ALLA) return ''
  return validIds.includes(raw) ? raw : ''
}
