// Owner role seam (#11). Pure module — lives OUTSIDE actions.ts ('use server') because
// a Server Actions file may only export async functions; this sync helper would break
// the build there (caught at render-verify, not by tsc/lint/vitest).
//
// Today the ONLY assignable owner role is salon_admin (the global RBAC taxonomy lands in
// goal-21). resolveOwnerRole maps the form's owner_role value → the {name, level} we
// create the per-tenant role with; an empty/unknown value falls back to salon_admin/6 so
// the default behaviour is byte-identical to before the seam existed. goal-21 extends
// OWNER_ROLE_LEVELS — this is the single wiring point.
const OWNER_ROLE_LEVELS: Record<string, number> = { salon_admin: 6 }
const DEFAULT_OWNER_ROLE = 'salon_admin'

export function resolveOwnerRole(raw: FormDataEntryValue | null): { name: string; level: number } {
  const v = String(raw ?? '').trim()
  // Object.hasOwn (NOT `in`): `in` walks the prototype chain, so owner_role=constructor
  // / __proto__ / toString would pass and yield a non-numeric level. Own-key check only.
  const name = Object.hasOwn(OWNER_ROLE_LEVELS, v) ? v : DEFAULT_OWNER_ROLE
  return { name, level: OWNER_ROLE_LEVELS[name] ?? OWNER_ROLE_LEVELS[DEFAULT_OWNER_ROLE]! }
}
