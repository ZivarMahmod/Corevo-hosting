import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { platformCtx } from './guard'
import {
  PERMISSION_AREAS,
  dbToPerm,
  permToDb,
  type Perm,
  type PermArea,
  type RoleTone,
} from './catalog-shared'

// ── goal-21 RBAC: stored, editable, enforced permission matrix ───────────────────
//
// The DB table `role_permissions` (migration 0025) stores ONLY the editable cells
// (role_name × area → perm). Role identity (name/who/tone/note/dbRoleNames) and the
// DEFAULT fallback stay in CODE here, so the app renders + behaves EXACTLY as today
// when the table is absent (rollback safety + the gated-goal table-less constraint).
//
// Representation: code speaks the UI Perm ('—') everywhere so DEFAULT_ROLE_CATALOG is
// byte-identical (diff-0) with the legacy catalog.ts ROLE_CATALOG. The DB's 'none' is
// translated to/from '—' only at the read/write boundary (dbToPerm/permToDb).

/** Static role metadata + default perms. SINGLE SOURCE OF TRUTH for the fallback. */
export type DefaultRole = {
  /** DB role_name key (the matrix row id + the role_permissions.role_name value). */
  roleName: string
  /** DB role name(s) the live cross-tenant user count aggregates (null = none seeded). */
  dbRoleNames: string[] | null
  name: string
  who: string
  tone: RoleTone
  note: string
  /** Default permission per area, aligned to PERMISSION_AREAS. UI Perm ('—' = none). */
  perms: Perm[]
}

/**
 * DEFAULT_ROLE_CATALOG — least-privilege design, diff-0 with catalog.ts ROLE_CATALOG.
 * This is the table-less fallback AND the merge base (DB overrides a cell; a missing
 * cell keeps the default). Order = matrix display order. perms align to PERMISSION_AREAS
 * [Tenants, Kunder, Bokningar, Fakturering, Branding, Personal, Drift].
 */
export const DEFAULT_ROLE_CATALOG: DefaultRole[] = [
  {
    roleName: 'super_admin',
    dbRoleNames: ['super_admin'],
    name: 'Super admin',
    who: 'Zivar',
    tone: 'gold',
    note: 'Plattformsägare — full kontroll, kringgår tenant-isolering.',
    perms: ['full', 'full', 'full', 'full', 'full', 'full', 'full'],
  },
  {
    roleName: 'salon_admin',
    dbRoleNames: ['salon_admin'],
    name: 'Företagsägare',
    who: 'Ägare',
    tone: 'success',
    note: 'Leksakslådan: full kontroll i egen tenant, ser aldrig andras.',
    perms: ['—', 'own', 'own', 'view', 'own', 'own', '—'],
  },
  {
    roleName: 'staff',
    dbRoleNames: ['staff'],
    name: 'Personal',
    who: 'Personal',
    tone: 'info',
    note: 'Egen dag + egna kunder. PII tidsbunden.',
    perms: ['—', 'view', 'own', '—', '—', '—', '—'],
  },
  {
    roleName: 'support',
    dbRoleNames: null,
    name: 'Support',
    who: 'Corevo-team',
    tone: 'neutral',
    note: 'Läsläge för felsökning. Kan trigga lösenordsreset.',
    perms: ['view', 'view', 'view', '—', '—', '—', 'view'],
  },
  {
    roleName: 'ekonomi',
    dbRoleNames: null,
    name: 'Ekonomi',
    who: 'Bokföring',
    tone: 'warning',
    note: 'Endast faktureringsunderlag.',
    perms: ['view', '—', '—', 'full', '—', '—', '—'],
  },
]

/** super_admin must stay 'full' on every area (is_platform_admin bypass depends on it). */
export const PROTECTED_ROLE = 'super_admin'

/** The only role names the matrix accepts — reject crafted/unknown role_name rows so a
 *  payload like {roleName:'ghost'} never writes an inert dead row into the table. */
const KNOWN_ROLE_NAMES = new Set(DEFAULT_ROLE_CATALOG.map((r) => r.roleName))

export type RolePermissions = DefaultRole & {
  /** Live cross-tenant user count, or null when no seeded DB role backs it. */
  users: number | null
}

/** A change to one editable matrix cell (UI Perm; the boundary maps '—' → 'none'). */
export type RolePermissionChange = { roleName: string; area: PermArea; perm: Perm }

/** A pure deep-copy of the defaults (so callers never mutate the module constant). */
function cloneDefaults(): DefaultRole[] {
  return DEFAULT_ROLE_CATALOG.map((r) => ({ ...r, perms: [...r.perms] }))
}

/**
 * Read the stored cells from role_permissions and overlay them onto the code defaults.
 * Table-less-safe: ANY failure (thrown exception, error object, or 0 rows) returns the
 * pure defaults. Wrapped in its OWN try/catch so it can never break the caller (e.g. the
 * live user-count read in getPlatformRoles runs independently). The returned shape is a
 * full DefaultRole[] — DB perm wins per cell, every missing cell keeps its default.
 */
async function readMatrixOverlay(
  supabase: SupabaseClient<Database>,
): Promise<DefaultRole[]> {
  const base = cloneDefaults()
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role_name, area, perm')
    if (error || !data || data.length === 0) return base
    const byRole = new Map(base.map((r) => [r.roleName, r]))
    for (const row of data) {
      const role = byRole.get(row.role_name)
      if (!role) continue
      const idx = PERMISSION_AREAS.indexOf(row.area as PermArea)
      if (idx < 0) continue
      role.perms[idx] = dbToPerm(row.perm)
    }
    return base
  } catch {
    return base // table absent / network error → pure defaults (rollback safety)
  }
}

/**
 * The role catalog with (a) DB-overlaid perms and (b) LIVE cross-tenant user counts.
 * Folds the goal-21 perm overlay INTO the existing getPlatformRoles contract so the
 * roller page + RolesMatrix stay props-driven exactly as today. The two reads fail
 * independently: a role_permissions failure falls back to default perms WITHOUT
 * affecting the user-count join, and vice-versa.
 */
export async function getRolePermissions(): Promise<RolePermissions[]> {
  const { supabase } = await platformCtx()

  const overlay = await readMatrixOverlay(supabase)

  // Live cross-tenant user count per role NAME (RLS bypass) — unchanged from before.
  let counts = new Map<string, number>()
  try {
    const { data } = await supabase.from('users').select('roles(name)')
    for (const row of (data ?? []) as {
      roles: { name: string | null } | { name: string | null }[] | null
    }[]) {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles
      const name = role?.name
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  } catch {
    counts = new Map()
  }

  return overlay.map((r) => ({
    ...r,
    users: r.dbRoleNames ? r.dbRoleNames.reduce((sum, n) => sum + (counts.get(n) ?? 0), 0) : null,
  }))
}

/**
 * Resolve the merged matrix as a plain { role_name → perms[] } map for ENFORCEMENT
 * (no user-count read — enforcement doesn't need it). Table-less-safe via the same
 * overlay path. Pair with canWrite() from catalog-shared.
 */
export async function resolveRoleMatrix(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, Perm[]>> {
  const overlay = await readMatrixOverlay(supabase)
  return Object.fromEntries(overlay.map((r) => [r.roleName, r.perms]))
}

/**
 * Validate a batch of matrix-cell changes against the super_admin self-lockout guard.
 * REJECTS the WHOLE batch if any change would set super_admin to anything other than
 * 'full' (is_platform_admin bypass depends on super_admin staying full everywhere).
 * Returns an error string, or null when the batch is safe. Pure — no DB.
 */
export function validateRolePermissionChanges(changes: RolePermissionChange[]): string | null {
  for (const c of changes) {
    if (!KNOWN_ROLE_NAMES.has(c.roleName)) return 'Okänd roll.'
    if (c.roleName === PROTECTED_ROLE && c.perm !== 'full') {
      return 'Super admin måste ha full behörighet på alla områden — kan inte nedgraderas (annars utelåsning).'
    }
    if (!PERMISSION_AREAS.includes(c.area)) return 'Okänt behörighetsområde.'
  }
  return null
}

export type SaveRolePermissionsResult = { error?: string; success?: string }

/**
 * Persist changed matrix cells. platform_admin only (platformCtx). Validates the
 * super_admin self-lockout guard BEFORE any write (reject the whole batch on any
 * violation), then upserts each cell on (role_name, area). Audit-logged best-effort.
 *
 * NOTE: the changes carry the UI Perm; the DB stores 'none' for '—' (permToDb).
 */
export async function saveRolePermissions(
  changes: RolePermissionChange[],
): Promise<SaveRolePermissionsResult> {
  const { user, supabase } = await platformCtx()

  if (changes.length === 0) return { success: 'Inget att spara.' }

  const guardError = validateRolePermissionChanges(changes)
  if (guardError) return { error: guardError }

  const rows = changes.map((c) => ({
    role_name: c.roleName,
    area: c.area,
    perm: permToDb(c.perm),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('role_permissions')
    .upsert(rows, { onConflict: 'role_name,area' })
  if (error) return { error: 'Kunde inte spara behörigheter. Försök igen.' }

  // Best-effort audit. audit_log.tenant_id is NOT NULL and a global role change has no
  // tenant — log against the actor's tenant when present, else the write no-ops inside
  // logPlatformAction (it swallows failures). The matrix edit itself still succeeds.
  if (user.tenantId) {
    const { logPlatformAction } = await import('./audit')
    await logPlatformAction(supabase, {
      action: 'platform.role_permissions_save',
      tenantId: user.tenantId,
      actorId: user.id,
      entityId: null,
      meta: { changes: changes.map((c) => ({ role: c.roleName, area: c.area, perm: c.perm })) },
    })
  }

  return { success: 'Behörigheter sparade.' }
}
