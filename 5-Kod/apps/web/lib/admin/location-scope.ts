import { PLATS_ALLA } from './plats-constants'

/**
 * Välj EN verifierad plats för kalender, schema och mutationer.
 *
 * "Alla" är användbart för ägarens aggregat men får aldrig följa med till en
 * skrivyta. Ett ogiltigt val uppgraderas inte till första bästa plats: endast den
 * inloggades DB-lästa primärplats får vara fallback.
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
  return null
}
