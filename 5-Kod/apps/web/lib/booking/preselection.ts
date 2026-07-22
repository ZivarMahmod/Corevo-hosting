const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BookingLocationRef = { id: string }
export type BookingServiceRef = { id: string; locationId?: string | null }
export type BookingSearchParams = Record<string, string | string[] | undefined>

type ResolveInput = {
  rawLocationId: string | null
  rawServiceId: string | null
  locations: readonly BookingLocationRef[]
  services: readonly BookingServiceRef[]
}

/** A global service (`locationId=null`) is valid everywhere. A location-specific
 * service is valid only on that exact active location. With no selected location
 * yet (the multi-location gate), retain the active service until the customer
 * chooses; the gate then keeps or clears it atomically. */
export function serviceAvailableAtLocation(
  service: BookingServiceRef,
  locationId: string | null,
): boolean {
  return locationId === null || service.locationId == null || service.locationId === locationId
}

export function servicesAvailableAtLocation<T extends BookingServiceRef>(
  services: readonly T[],
  locationId: string | null,
): T[] {
  return services.filter((service) => serviceAvailableAtLocation(service, locationId))
}

export function resolveLocationSelection<T extends BookingServiceRef>({
  services,
  currentService,
  locationId,
  compact,
}: {
  services: readonly T[]
  currentService: T | null
  locationId: string
  compact: boolean
}): { service: T | null; step: 1 | 2 } {
  const compatible = servicesAvailableAtLocation(services, locationId)
  const service = currentService && serviceAvailableAtLocation(currentService, locationId)
    ? currentService
    : compact
      ? (compatible[0] ?? null)
      : null
  return { service, step: service && !compact ? 2 : 1 }
}

/** Validate URL ids solely against already-loaded ACTIVE rows for the resolved
 * tenant. Missing/inactive/cross-tenant ids therefore collapse to null without a
 * second trust path. A single-location tenant also checks the service against its
 * implicit location even when the URL omits `plats`. */
export function resolveBookingQueryPreselection({
  rawLocationId,
  rawServiceId,
  locations,
  services,
}: ResolveInput): { locationId: string | null; serviceId: string | null } {
  const locationId = locations.some((location) => location.id === rawLocationId)
    ? rawLocationId
    : null
  const compatibilityLocationId = locationId ?? (locations.length === 1 ? locations[0]!.id : null)
  const service = services.find((candidate) => candidate.id === rawServiceId) ?? null
  const serviceId = service && serviceAvailableAtLocation(service, compatibilityLocationId)
    ? service.id
    : null
  return { locationId, serviceId }
}

function oneQueryValue(
  searchParams: BookingSearchParams,
  canonicalKey: 'plats' | 'tjanst',
  aliasKey: 'location' | 'service',
): string | null {
  // Canonical-key presence wins even when malformed. This prevents an attacker
  // from smuggling a valid alias beside a duplicate/array canonical value.
  const value = searchParams[canonicalKey] !== undefined
    ? searchParams[canonicalKey]
    : searchParams[aliasKey]
  return typeof value === 'string' && value.trim() === value && value.length > 0
    ? value
    : null
}

/** Public `/boka` query dialect. Output remains the existing Swedish live keys
 * (`plats`, `tjanst`); the design-package aliases (`location`, `service`) are
 * accepted for compatibility because the written fixtures disagree. */
export function resolveBookingSearchParams({
  searchParams,
  locations,
  services,
}: {
  searchParams: BookingSearchParams
  locations: readonly BookingLocationRef[]
  services: readonly BookingServiceRef[]
}): { locationId: string | null; serviceId: string | null } {
  return resolveBookingQueryPreselection({
    rawLocationId: oneQueryValue(searchParams, 'plats', 'location'),
    rawServiceId: oneQueryValue(searchParams, 'tjanst', 'service'),
    locations,
    services,
  })
}

/** Build a same-tenant relative booking target. Callers cannot provide an origin,
 * route or arbitrary href; invalid context values are omitted independently. */
export function buildTenantBookingPath({
  locationId,
  serviceId,
}: {
  locationId: string | null
  serviceId: string | null
}): string {
  const query = new URLSearchParams()
  if (locationId && UUID_PATTERN.test(locationId)) query.set('plats', locationId.toLowerCase())
  if (serviceId && UUID_PATTERN.test(serviceId)) query.set('tjanst', serviceId.toLowerCase())
  const suffix = query.toString()
  return suffix ? `/boka?${suffix}` : '/boka'
}
