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

export type PermArea = (typeof PERMISSION_AREAS)[number]

// goal-21 RBAC — client-safe perm helpers (NO 'server-only'). The DB stores 'none'
// for the UI's '—' (no special chars in the check-constraint); these two are the
// ONLY place that translation happens. Code (DEFAULT_ROLE_CATALOG + the matrix's
// PermCell) speaks the UI Perm ('—') everywhere so it stays diff-0 with the legacy
// catalog; we map to/from 'none' only at the DB boundary.
export type PermDb = 'full' | 'own' | 'view' | 'none'

/** DB perm → UI Perm ('none' → '—'). Unknown values fall back to '—' (safest). */
export function dbToPerm(v: string): Perm {
  return v === 'full' || v === 'own' || v === 'view' ? v : '—'
}

/** UI Perm → DB perm ('—' → 'none'). */
export function permToDb(v: Perm): PermDb {
  return v === '—' ? 'none' : v
}

/** Click-cycle order for an editable matrix cell (mock: full→own→view→none→full). */
export const PERM_CYCLE: readonly Perm[] = ['full', 'own', 'view', '—'] as const

/** Next perm in the click-cycle (wraps). */
export function nextPerm(v: Perm): Perm {
  const i = PERM_CYCLE.indexOf(v)
  return PERM_CYCLE[(i + 1) % PERM_CYCLE.length] ?? 'full'
}

/**
 * Enforcement primitive (goal-21 §4). PURE + rep-agnostic: answers "does this role
 * have WRITE access on this area" from a RESOLVED matrix (role_name → perms aligned
 * to PERMISSION_AREAS). Write = 'own' | 'full'. 'view'/'—' = read-only/none → false.
 *
 * ADDITIVE-RESTRICTIVE: this may only DENY, never grant. An unknown role or unknown
 * area returns `true` (fall through to the OUTER guard, which is the real fence) — so
 * a role that already passed its level gate is never newly blocked by a missing cell.
 * The matrix can therefore NEVER widen access; it can only narrow a KNOWN role.
 */
export function canWrite(
  matrix: Record<string, Perm[]>,
  roleName: string | null | undefined,
  area: PermArea,
): boolean {
  if (!roleName) return true // null/unknown → defer to the outer guard (no new restriction)
  const perms = matrix[roleName]
  if (!perms) return true // role not in matrix → defer to the outer guard
  const idx = PERMISSION_AREAS.indexOf(area)
  const perm = perms[idx]
  if (perm === undefined) return true // missing cell → defer (additive-restrictive)
  return perm === 'own' || perm === 'full'
}
