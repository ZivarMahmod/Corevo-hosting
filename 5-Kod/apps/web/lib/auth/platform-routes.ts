/**
 * Every clean URL owned by the superadmin surface.
 *
 * This list is deliberately UI-free so middleware, host routing and role guards
 * can share it in the Edge runtime. Keep labels/icons in the portal navigation;
 * a coverage test prevents those links from drifting away from this contract.
 */
export const CANONICAL_PLATFORM_ROUTE_PREFIXES = [
  '/platform',
  '/branscher',
  '/fakturering',
  '/kunder',
  '/slutkunder',
  '/personal-plattform',
  '/utskick',
  '/drift-och-logg',
  '/integrationer',
  '/domaner',
  '/roller',
  '/installningar',
] as const

/** Retired paths remain protected and owned by the superadmin door until their
 * host-scoped permanent redirect has run. Never use these for visible links. */
export const LEGACY_PLATFORM_ROUTE_PREFIXES = ['/salonger'] as const

export const PLATFORM_ROUTE_PREFIXES = [
  ...CANONICAL_PLATFORM_ROUTE_PREFIXES,
  ...LEGACY_PLATFORM_ROUTE_PREFIXES,
] as const
