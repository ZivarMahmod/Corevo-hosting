import { describe, it, expect, beforeEach, vi } from 'vitest'

// goal-20 (#10 ägar-namn, #11 roll-seam, #14 stad): createTenant must thread the new
// columns end-to-end. These mock the supabase client at the ./guard boundary so we can
// CAPTURE the insert payloads and prove byte-identical defaults — the brief's
// verification ("se det i databasen direkt"). server-only deep chains are neutralized by
// mocking the boundary modules; the graph depth below them never loads.

// ── Boundary mocks ───────────────────────────────────────────────────────────────
// A tiny chainable recorder: every write captures its payload; terminal single()/
// maybeSingle()/await resolve the seeded result for that table.
function makeSupabase(results: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const captured: Record<string, unknown[]> = {}
  const push = (k: string, v: unknown) => {
    ;(captured[k] ??= []).push(v)
  }
  const from = (table: string) => {
    const r = results[table] ?? { data: null, error: null }
    const chain: Record<string, unknown> = {
      insert: (p: unknown) => (push(table, p), chain),
      upsert: (p: unknown) => (push(`${table}.upsert`, p), chain),
      update: (p: unknown) => (push(`${table}.update`, p), chain),
      delete: () => (push(`${table}.delete`, true), chain),
      select: (cols?: unknown) => (push(`${table}.select`, cols), chain),
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => r,
      maybeSingle: async () => r,
      then: (res: (v: typeof r) => unknown) => Promise.resolve(r).then(res),
    }
    return chain
  }
  return { client: { from }, captured }
}

const platformCtxMock = vi.fn()
vi.mock('./guard', () => ({ platformCtx: () => platformCtxMock() }))

const createServiceClientMock = vi.fn()
vi.mock('./service', () => ({
  createServiceClient: () => createServiceClientMock(),
  hasServiceRole: () => true,
}))

vi.mock('./audit', () => ({ logPlatformAction: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Top-level imports in actions.ts that pull server-only/cloudflare deps — never
// exercised by createTenant without a logo File, but must import cleanly.
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: vi.fn() }))
vi.mock('@/lib/r2/upload', () => ({
  uploadImage: vi.fn(async () => ({ ok: false })),
  uploadErrorMessage: () => '',
  pruneRemovedImages: vi.fn(async () => {}),
}))

import { createTenant, createPlatformCustomer } from './actions'
import { resolveOwnerRole } from './owner-role'

// A fake service client whose invite + metadata calls succeed, so createTenant walks
// the users-insert path (where full_name + role_id live).
function fakeSvc(authId = 'auth-1') {
  return {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: authId } }, error: null })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  }
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── #11 — the role seam (pure, byte-identical default) ───────────────────────────
describe('resolveOwnerRole (#11 owner-role seam)', () => {
  it('defaults to salon_admin/6 for empty / null (byte-identical to the old hardcode)', () => {
    expect(resolveOwnerRole(null)).toEqual({ name: 'salon_admin', level: 6 })
    expect(resolveOwnerRole('')).toEqual({ name: 'salon_admin', level: 6 })
    expect(resolveOwnerRole('   ')).toEqual({ name: 'salon_admin', level: 6 })
  })
  it('resolves a known role to its mapped level', () => {
    expect(resolveOwnerRole('salon_admin')).toEqual({ name: 'salon_admin', level: 6 })
  })
  it('an unknown value falls back to salon_admin (no foot-gun, no regression)', () => {
    expect(resolveOwnerRole('staff')).toEqual({ name: 'salon_admin', level: 6 })
    expect(resolveOwnerRole('super_admin')).toEqual({ name: 'salon_admin', level: 6 })
  })
  it('prototype-chain keys fall back too (Object.hasOwn, not `in` — no garbage level)', () => {
    for (const k of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(resolveOwnerRole(k)).toEqual({ name: 'salon_admin', level: 6 })
    }
  })
})

// ── createTenant write-path: city + full_name + resolved role_id ──────────────────
describe('createTenant writes the goal-20 columns', () => {
  function seedCtx() {
    const { client, captured } = makeSupabase({
      tenants: { data: { id: 't1', slug: 'klippoteket' }, error: null },
      roles: { data: { id: 'role-1' }, error: null },
    })
    platformCtxMock.mockReturnValue(
      Promise.resolve({ user: { id: 'admin-1' }, supabase: client }),
    )
    return captured
  }

  it('includes city in the tenants insert (#14)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(null) // no invite path needed for this assert
    const res = await createTenant({}, fd({ name: 'Klippoteket', slug: 'klippoteket', city: 'Göteborg' }))
    expect(res.error).toBeUndefined()
    expect(captured.tenants?.[0]).toMatchObject({ slug: 'klippoteket', name: 'Klippoteket', city: 'Göteborg' })
  })

  it('writes null city (never empty string) when no city is given (#14)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(null)
    await createTenant({}, fd({ name: 'Klippoteket', slug: 'klippoteket' }))
    expect((captured.tenants?.[0] as { city: unknown }).city).toBeNull()
  })

  it('creates the role from the resolved seam — default salon_admin/6 (#11)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(null)
    await createTenant({}, fd({ name: 'Klippoteket', slug: 'klippoteket' }))
    expect(captured.roles?.[0]).toEqual({ tenant_id: 't1', name: 'salon_admin', level: 6 })
  })

  it('passing owner_role=salon_admin (the form hidden input) is byte-identical (#11)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(null)
    await createTenant({}, fd({ name: 'K', slug: 'kx', owner_role: 'salon_admin' }))
    expect(captured.roles?.[0]).toEqual({ tenant_id: 't1', name: 'salon_admin', level: 6 })
  })

  it('writes full_name + role_id in the users insert when an owner is invited (#10)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(fakeSvc('auth-1'))
    const res = await createTenant(
      {},
      fd({ name: 'Klippoteket', slug: 'klippoteket', owner_name: 'Anna Berg', owner_email: 'anna@x.se' }),
    )
    expect(res.error).toBeUndefined()
    expect(captured.users?.[0]).toMatchObject({
      id: 'auth-1',
      tenant_id: 't1',
      email: 'anna@x.se',
      full_name: 'Anna Berg',
      role_id: 'role-1',
      status: 'active',
    })
  })

  it('writes null full_name (never empty string) when the owner name is blank (#10)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(fakeSvc('auth-2'))
    await createTenant({}, fd({ name: 'K', slug: 'kx', owner_email: 'noname@x.se' }))
    expect((captured.users?.[0] as { full_name: unknown }).full_name).toBeNull()
  })
})

// ── goal-22 — createPlatformCustomer (manual cross-tenant customer row) ────────────
describe('createPlatformCustomer (goal-22 #6)', () => {
  function seedCtx(tenantResult: { data?: unknown; error?: unknown }) {
    const { client, captured } = makeSupabase({
      tenants: tenantResult,
      customers: { data: { id: 'cust-1' }, error: null },
    })
    platformCtxMock.mockReturnValue(
      Promise.resolve({ user: { id: 'admin-1' }, supabase: client }),
    )
    return captured
  }
  const activeTenant = { data: { id: 't1', status: 'active' }, error: null }

  it('inserts a customers row scoped to the chosen tenant, status active', async () => {
    const captured = seedCtx(activeTenant)
    const res = await createPlatformCustomer(
      {},
      fd({ tenantId: 't1', full_name: 'Anna Svensson', email: 'Anna@X.se', phone: '070-1' }),
    )
    expect(res.success).toBeTruthy()
    expect(captured.customers?.[0]).toMatchObject({
      tenant_id: 't1',
      full_name: 'Anna Svensson',
      display_name: 'Anna Svensson',
      email: 'anna@x.se', // lowercased
      phone: '070-1',
      status: 'active',
    })
  })

  it('never sets auth_user_id or contact_hash (no faked auth identity)', async () => {
    const captured = seedCtx(activeTenant)
    await createPlatformCustomer({}, fd({ tenantId: 't1', full_name: 'Bo' }))
    const row = captured.customers?.[0] as Record<string, unknown>
    expect('auth_user_id' in row).toBe(false)
    expect('contact_hash' in row).toBe(false)
  })

  it('writes null email/phone (never empty string) when omitted', async () => {
    const captured = seedCtx(activeTenant)
    await createPlatformCustomer({}, fd({ tenantId: 't1', full_name: 'Bo' }))
    const row = captured.customers?.[0] as { email: unknown; phone: unknown }
    expect(row.email).toBeNull()
    expect(row.phone).toBeNull()
  })

  it('rejects an empty name — no insert', async () => {
    const captured = seedCtx(activeTenant)
    const res = await createPlatformCustomer({}, fd({ tenantId: 't1', full_name: '   ' }))
    expect(res.error).toBeTruthy()
    expect(captured.customers).toBeUndefined()
  })

  it('rejects a missing tenant — no insert', async () => {
    const captured = seedCtx(activeTenant)
    const res = await createPlatformCustomer({}, fd({ full_name: 'Anna' }))
    expect(res.error).toBeTruthy()
    expect(captured.customers).toBeUndefined()
  })

  it('rejects an invalid email — no insert', async () => {
    const captured = seedCtx(activeTenant)
    const res = await createPlatformCustomer(
      {},
      fd({ tenantId: 't1', full_name: 'Anna', email: 'not-an-email' }),
    )
    expect(res.error).toBeTruthy()
    expect(captured.customers).toBeUndefined()
  })

  it('rejects a non-existent tenant — no insert', async () => {
    const captured = seedCtx({ data: null, error: null })
    const res = await createPlatformCustomer({}, fd({ tenantId: 'ghost', full_name: 'Anna' }))
    expect(res.error).toBeTruthy()
    expect(captured.customers).toBeUndefined()
  })

  it('rejects a non-active (suspended/deleted) tenant — no insert', async () => {
    const captured = seedCtx({ data: { id: 't1', status: 'suspended' }, error: null })
    const res = await createPlatformCustomer({}, fd({ tenantId: 't1', full_name: 'Anna' }))
    expect(res.error).toBeTruthy()
    expect(captured.customers).toBeUndefined()
  })
})
