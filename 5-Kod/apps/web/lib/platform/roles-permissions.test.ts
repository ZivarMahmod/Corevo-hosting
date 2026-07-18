import { describe, it, expect, beforeEach, vi } from 'vitest'

// goal-21 RBAC — stored, editable, ENFORCED permission matrix. These tests pin:
//   • diff-0 invariant   — DEFAULT_ROLE_CATALOG === the legacy hardcoded matrix.
//   • table-less fallback — getRolePermissions returns defaults on error AND 0 rows.
//   • merge              — a DB row overrides ONE cell; others stay default.
//   • super_admin lockout — saveRolePermissions rejects any super_admin ≠ 'full'.
//   • enforcement        — canWrite() may only DENY (never grant); the saveBranding
//                          gate denies Branding='none', allows 'own'/'full', and a
//                          fabricated 'full' on a platform area can't bypass the
//                          OUTER role/level guard.
//
// We mock the supabase client at the ./guard boundary (same seam as the other
// lib/platform/*.test.ts) so the server-only chain below never loads.

// ── Chainable supabase recorder ──────────────────────────────────────────────────
// A select(...) call is itself awaitable (readMatrixOverlay does `await from().select()`).
// upsert(p, opts) captures the rows then resolves. A per-table result map seeds each.
type TableResult = { data?: unknown; error?: unknown; throws?: boolean }
function makeSupabase(results: Record<string, TableResult> = {}) {
  const captured: Record<string, unknown[]> = {}
  const push = (k: string, v: unknown) => {
    ;(captured[k] ??= []).push(v)
  }
  const from = (table: string) => {
    const r = results[table] ?? { data: null, error: null }
    // async so a rejection only surfaces when the chain is actually awaited (no
    // orphan rejected promise → no unhandled-rejection noise).
    const resolve = async () => {
      if (r.throws) throw new Error('table absent')
      return { data: r.data ?? null, error: r.error ?? null }
    }
    const chain: Record<string, unknown> = {
      select: (cols?: unknown) => (push(`${table}.select`, cols), chain),
      upsert: (p: unknown, opts?: unknown) => (push(`${table}.upsert`, { rows: p, opts }), chain),
      insert: (p: unknown) => (push(table, p), chain),
      update: (p: unknown) => (push(`${table}.update`, p), chain),
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolve().then(res, rej),
    }
    return chain
  }
  return { client: { from }, captured }
}

const platformCtxMock = vi.fn()
vi.mock('./guard', () => ({
  platformCtx: () => platformCtxMock(),
  platformAdminCtx: () => platformCtxMock(),
}))
const logPlatformAction = vi.fn(async () => {})
vi.mock('./audit', () => ({ logPlatformAction }))

import {
  DEFAULT_ROLE_CATALOG,
  getRolePermissions,
  saveRolePermissions,
  resolveRoleMatrix,
  validateRolePermissionChanges,
  type RolePermissionChange,
} from './roles-permissions'
import { canWrite, dbToPerm, permToDb } from './catalog-shared'
import type { Perm } from './catalog-shared'

function seedCtx(results: Record<string, TableResult> = {}, user = { id: 'admin-1', tenantId: 'plat-tenant' }) {
  const { client, captured } = makeSupabase(results)
  platformCtxMock.mockReturnValue(Promise.resolve({ user, supabase: client }))
  return { client, captured }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── diff-0 invariant ──────────────────────────────────────────────────────────────
describe('DEFAULT_ROLE_CATALOG (diff-0 with the legacy hardcoded matrix)', () => {
  // role_name → exact 7 perms in PERMISSION_AREAS order, copied from catalog.ts.
  const EXPECTED: Record<string, Perm[]> = {
    super_admin: ['full', 'full', 'full', 'full', 'full', 'full', 'full'],
    salon_admin: ['—', 'own', 'own', 'view', 'own', 'own', '—'],
    staff: ['—', 'view', 'own', '—', '—', '—', '—'],
    support: ['view', 'view', 'view', '—', '—', '—', 'view'],
    ekonomi: ['view', '—', '—', 'full', '—', '—', '—'],
  }

  it('pins every role to its exact 7 default perms (no silent permission drift)', () => {
    for (const r of DEFAULT_ROLE_CATALOG) {
      expect(r.perms).toEqual(EXPECTED[r.roleName])
    }
    // and no extra/missing roles
    expect(DEFAULT_ROLE_CATALOG.map((r) => r.roleName).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    )
  })

  it("maps '—' ↔ 'none' only at the DB boundary", () => {
    expect(permToDb('—')).toBe('none')
    expect(permToDb('own')).toBe('own')
    expect(dbToPerm('none')).toBe('—')
    expect(dbToPerm('full')).toBe('full')
    expect(dbToPerm('garbage')).toBe('—')
  })
})

// ── table-less fallback ─────────────────────────────────────────────────────────────
describe('getRolePermissions — table-less fallback (rollback safety)', () => {
  function expectPureDefaults(roles: { roleName: string; perms: Perm[] }[]) {
    for (const r of DEFAULT_ROLE_CATALOG) {
      const got = roles.find((x) => x.roleName === r.roleName)
      expect(got?.perms).toEqual(r.perms)
    }
  }

  it('returns pure defaults when the role_permissions read ERRORS', async () => {
    seedCtx({
      role_permissions: { error: { message: 'relation does not exist' } },
      users: { data: [] },
    })
    const roles = await getRolePermissions()
    expectPureDefaults(roles)
  })

  it('returns pure defaults when the role_permissions read THROWS', async () => {
    seedCtx({ role_permissions: { throws: true }, users: { data: [] } })
    const roles = await getRolePermissions()
    expectPureDefaults(roles)
  })

  it('returns pure defaults when the table is empty (0 rows)', async () => {
    seedCtx({ role_permissions: { data: [] }, users: { data: [] } })
    const roles = await getRolePermissions()
    expectPureDefaults(roles)
  })

  it('keeps the live user-count read working independently of the perm read', async () => {
    seedCtx({
      role_permissions: { throws: true }, // perms fall back to default
      users: { data: [{ roles: { name: 'super_admin' } }, { roles: { name: 'salon_admin' } }] },
    })
    const roles = await getRolePermissions()
    expect(roles.find((r) => r.roleName === 'super_admin')?.users).toBe(1)
    expect(roles.find((r) => r.roleName === 'salon_admin')?.users).toBe(1)
    // perms still default despite the perm-read failure
    expect(roles.find((r) => r.roleName === 'salon_admin')?.perms).toEqual(
      DEFAULT_ROLE_CATALOG.find((r) => r.roleName === 'salon_admin')?.perms,
    )
  })

  it('Support/Ekonomi have null user count (no seeded DB role → honest "—")', async () => {
    seedCtx({ role_permissions: { data: [] }, users: { data: [] } })
    const roles = await getRolePermissions()
    expect(roles.find((r) => r.roleName === 'support')?.users).toBeNull()
    expect(roles.find((r) => r.roleName === 'ekonomi')?.users).toBeNull()
  })
})

// ── merge ───────────────────────────────────────────────────────────────────────────
describe('getRolePermissions — DB overlay merge (one cell wins, others default)', () => {
  it('overrides exactly the DB cell and leaves the rest default', async () => {
    // salon_admin Branding default is 'own'; the DB narrows it to 'none'.
    seedCtx({
      role_permissions: {
        data: [{ role_name: 'salon_admin', area: 'Branding', perm: 'none' }],
      },
      users: { data: [] },
    })
    const roles = await getRolePermissions()
    const salon = roles.find((r) => r.roleName === 'salon_admin')!
    // Branding (index 4) is now '—', every other cell is the default.
    expect(salon.perms).toEqual(['—', 'own', 'own', 'view', '—', 'own', '—'])
  })

  it('ignores DB rows for unknown roles / unknown areas (no crash, no leak)', async () => {
    seedCtx({
      role_permissions: {
        data: [
          { role_name: 'ghost', area: 'Branding', perm: 'full' },
          { role_name: 'salon_admin', area: 'NotAnArea', perm: 'full' },
        ],
      },
      users: { data: [] },
    })
    const roles = await getRolePermissions()
    // salon_admin untouched (the bad area was ignored), no 'ghost' role appears.
    expect(roles.find((r) => r.roleName === 'salon_admin')?.perms).toEqual(
      DEFAULT_ROLE_CATALOG.find((r) => r.roleName === 'salon_admin')?.perms,
    )
    expect(roles.find((r) => r.roleName === 'ghost')).toBeUndefined()
  })
})

// ── super_admin self-lockout guard ──────────────────────────────────────────────────
describe('saveRolePermissions — super_admin self-lockout guard', () => {
  it('REJECTS setting super_admin to non-full on ANY area (pure validator)', () => {
    for (const area of ['Tenants', 'Drift', 'Branding'] as const) {
      expect(
        validateRolePermissionChanges([{ roleName: 'super_admin', area, perm: 'view' }]),
      ).toBeTruthy()
      expect(
        validateRolePermissionChanges([{ roleName: 'super_admin', area, perm: '—' }]),
      ).toBeTruthy()
    }
  })

  it('ALLOWS super_admin set to full (a no-op edit) and other roles freely', () => {
    expect(
      validateRolePermissionChanges([{ roleName: 'super_admin', area: 'Drift', perm: 'full' }]),
    ).toBeNull()
    expect(
      validateRolePermissionChanges([{ roleName: 'salon_admin', area: 'Branding', perm: '—' }]),
    ).toBeNull()
  })

  it('REJECTS an unknown/crafted role_name (no inert dead rows written)', () => {
    expect(
      validateRolePermissionChanges([{ roleName: 'ghost', area: 'Branding', perm: 'full' }]),
    ).toBeTruthy()
    expect(
      validateRolePermissionChanges([{ roleName: '__proto__', area: 'Branding', perm: 'full' }]),
    ).toBeTruthy()
  })

  it('saveRolePermissions rejects the WHOLE batch and writes nothing on any super_admin downgrade', async () => {
    const { captured } = seedCtx({ role_permissions: { data: null, error: null } })
    const res = await saveRolePermissions([
      { roleName: 'salon_admin', area: 'Branding', perm: '—' },
      { roleName: 'super_admin', area: 'Tenants', perm: 'view' },
    ])
    expect(res.error).toBeTruthy()
    expect(captured['role_permissions.upsert']).toBeUndefined() // nothing written
    expect(logPlatformAction).not.toHaveBeenCalled()
  })

  it('saveRolePermissions upserts changed cells (mapping "—"→"none") + audit-logs', async () => {
    const { captured } = seedCtx({ role_permissions: { data: null, error: null } })
    const res = await saveRolePermissions([
      { roleName: 'salon_admin', area: 'Branding', perm: '—' },
    ] as RolePermissionChange[])
    expect(res.success).toBeTruthy()
    const up = captured['role_permissions.upsert']?.[0] as { rows: { perm: string }[]; opts: unknown }
    expect(up.rows[0]?.perm).toBe('none') // UI '—' persisted as DB 'none'
    expect(up.opts).toEqual({ onConflict: 'role_name,area' })
    expect(logPlatformAction).toHaveBeenCalledTimes(1)
  })

  it('surfaces a DB error from the upsert (no false success)', async () => {
    seedCtx({ role_permissions: { error: { message: 'rls denied' } } })
    const res = await saveRolePermissions([{ roleName: 'staff', area: 'Drift', perm: 'view' }])
    expect(res.error).toBeTruthy()
    expect(res.success).toBeUndefined()
  })
})

// ── enforcement: canWrite() may ONLY deny (additive-restrictive) ────────────────────
describe('canWrite — enforcement primitive only narrows, never grants', () => {
  it('grants write for own/full, denies for view/—', () => {
    const matrix = { salon_admin: DEFAULT_ROLE_CATALOG.find((r) => r.roleName === 'salon_admin')!.perms }
    expect(canWrite(matrix, 'salon_admin', 'Branding')).toBe(true) // own
    expect(canWrite(matrix, 'salon_admin', 'Fakturering')).toBe(false) // view
    expect(canWrite(matrix, 'salon_admin', 'Tenants')).toBe(false) // —
  })

  it('denies when an admin narrows salon_admin Branding to "—" (the toggle)', () => {
    const matrix = { salon_admin: ['—', 'own', 'own', 'view', '—', 'own', '—'] as Perm[] }
    expect(canWrite(matrix, 'salon_admin', 'Branding')).toBe(false)
  })

  it('a fabricated full on a platform area does NOT let canWrite grant past a missing role/cell rule', () => {
    // canWrite is the INNER narrowing check; it returns true for own/full BUT the
    // OUTER guard (adminCtx/requirePortal level gate) is the real fence. canWrite can
    // never be the thing that GRANTS platform access — it only ever DENIES a known role.
    // Unknown role / unknown matrix → defer to the outer guard (true), never a grant.
    expect(canWrite({}, 'staff', 'Tenants')).toBe(true) // role absent → defer (no NEW restriction)
    expect(canWrite({ staff: [] }, 'staff', 'Tenants')).toBe(true) // missing cell → defer
    // even a fabricated full only ever returns true (allow) — it is NOT a capability
    // grant; the OUTER level gate (requirePlatformAdmin) still blocks staff from the
    // platform surface, so canWrite returning true cannot widen access.
    expect(
      canWrite({ staff: ['full', 'full', 'full', 'full', 'full', 'full', 'full'] as Perm[] }, 'staff', 'Tenants'),
    ).toBe(true)
  })

  it('null/unknown role defers to the outer guard (allow) — additive-restrictive', () => {
    expect(canWrite({}, null, 'Branding')).toBe(true)
    expect(canWrite({}, undefined, 'Branding')).toBe(true)
  })
})

// ── enforcement toggle via resolveRoleMatrix (the saveBranding gate input) ──────────
describe('resolveRoleMatrix + canWrite — the saveBranding enforcement toggle', () => {
  it('default matrix → salon_admin CAN write Branding (own) = zero behavior change today', async () => {
    const { client } = makeSupabase({ role_permissions: { data: [] } })
    const matrix = await resolveRoleMatrix(client as never)
    expect(canWrite(matrix, 'salon_admin', 'Branding')).toBe(true)
    expect(canWrite(matrix, 'super_admin', 'Branding')).toBe(true)
  })

  it("narrowed matrix (DB sets salon_admin Branding='none') → saveBranding-gate DENIES", async () => {
    const { client } = makeSupabase({
      role_permissions: { data: [{ role_name: 'salon_admin', area: 'Branding', perm: 'none' }] },
    })
    const matrix = await resolveRoleMatrix(client as never)
    expect(canWrite(matrix, 'salon_admin', 'Branding')).toBe(false) // the gate bites
  })

  it('table-less resolveRoleMatrix still answers from defaults (no crash)', async () => {
    const { client } = makeSupabase({ role_permissions: { throws: true } })
    const matrix = await resolveRoleMatrix(client as never)
    expect(canWrite(matrix, 'salon_admin', 'Branding')).toBe(true)
    expect(canWrite(matrix, 'staff', 'Branding')).toBe(false) // staff default '—'
  })
})
