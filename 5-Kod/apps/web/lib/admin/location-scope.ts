import { PLATS_ALLA } from './plats-constants'

/**
 * Välj EN verifierad plats för kalender, schema och mutationer.
 *
 * "Alla" är användbart för ägarens aggregat men får aldrig följa med till en
 * skrivyta. Ett ogiltigt val uppgraderas inte till första bästa plats BLAND FLERA:
 * endast den inloggades DB-lästa primärplats får vara fallback. Undantaget
 * (2026-07-18, Zivar: "känns som en bugg"): finns bara EN tillåten plats är den
 * inte "första bästa" — den är enda möjliga valet. En ny ägare utan sparad
 * primärplats i en enplatsverksamhet ska aldrig mötas av en välj-plats-spärr.
 */
export function requiredLocationId(
  requested: string | null | undefined,
  allowedLocationIds: readonly string[],
  primaryLocationId: string | null | undefined,
): string | null {
  if (requested && requested !== PLATS_ALLA && allowedLocationIds.includes(requested)) {
    return requested
  }
  if (primaryLocationId && allowedLocationIds.includes(primaryLocationId)) {
    return primaryLocationId
  }
  if (allowedLocationIds.length === 1) return allowedLocationIds[0]!
  return null
}
