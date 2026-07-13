/**
 * Every clean URL owned by the superadmin surface.
 *
 * This list is deliberately UI-free so middleware, host routing and role guards
 * can share it in the Edge runtime. Keep labels/icons in the portal navigation;
 * a coverage test prevents those links from drifting away from this contract.
 */
export const PLATFORM_ROUTE_PREFIXES = [
  '/platform',
  '/salonger',
  '/branscher',
  '/fakturering',
  '/kunder',
  '/personal-plattform',
  '/drift-och-logg',
  '/integrationer',
  '/domaner',
  '/roller',
  '/installningar',
] as const
