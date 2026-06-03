// Client-safe platform catalog constants + types. This module deliberately has NO
// `import 'server-only'` — the RolesMatrix client island imports the PERMISSION_AREAS
// VALUE, and pulling the server-only catalog.ts into a client bundle is a build error
// ("You're importing a component that needs 'server-only'"). The live cross-tenant
// READS stay in catalog.ts, which re-exports these so server callers are unchanged.

/** Permission level per area (mock PermCell map). '—' = no access. */
export type Perm = 'full' | 'own' | 'view' | '—'

/** Role badge tone (mock SU_ROLES r.tone). */
export type RoleTone = 'gold' | 'success' | 'info' | 'neutral' | 'warning'

/** The 7 permission areas, in matrix column order (mock SU_PERMS). */
export const PERMISSION_AREAS = [
  'Tenants',
  'Kunder',
  'Bokningar',
  'Fakturering',
  'Branding',
  'Personal',
  'Drift',
] as const
