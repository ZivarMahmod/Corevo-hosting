export type AddressBoundMap = {
  lat: number
  lon: number
  q?: string | null
}

const normalizeAddress = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE')

/**
 * A coordinate pair is only safe to embed when it carries the address it was
 * geocoded for. Older/stale coordinates fail closed; the storefront can still
 * offer its address search link without pointing at the wrong physical place.
 */
export function verifiedMapForAddress(
  map: AddressBoundMap | null | undefined,
  address: string | null | undefined,
): { lat: number; lon: number } | null {
  if (!map || !address || typeof map.q !== 'string' || !map.q.trim()) return null
  if (
    !Number.isFinite(map.lat)
    || !Number.isFinite(map.lon)
    || map.lat < -90
    || map.lat > 90
    || map.lon < -180
    || map.lon > 180
  ) return null
  return normalizeAddress(map.q) === normalizeAddress(address)
    ? { lat: map.lat, lon: map.lon }
    : null
}
