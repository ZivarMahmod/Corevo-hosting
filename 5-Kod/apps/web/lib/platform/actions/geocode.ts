import 'server-only'

/** Best-effort OSM lookup. Saving must never fail because geocoding is unavailable. */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q=${encodeURIComponent(address)}`,
      { headers: { 'User-Agent': 'corevo-hosting (booking@corevo.se)' }, signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { lat?: string; lon?: string }[]
    const hit = rows?.[0]
    const lat = Number(hit?.lat)
    const lon = Number(hit?.lon)
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
  } catch {
    return null
  }
}
