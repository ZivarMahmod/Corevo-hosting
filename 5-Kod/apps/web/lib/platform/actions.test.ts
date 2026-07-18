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
    const r = results[table] ??
      (table === 'locations' ? { data: { id: 'location-1' }, error: null } : { data: null, error: null })
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
const revalidatePathMock = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

// goal-23: control the Cloudflare client so domain-action tests never touch network.
type CfDcv = { type: string; name: string; value: string; purpose: string }
type CfHost = { id: string; hostname: string; status: string; sslStatus: string | null; dcv: CfDcv[] }
type CfCreateResult = { ok: boolean; error?: string; data?: CfHost }
type CfGetResult = { ok: boolean; error?: string; data?: CfHost | null }
type CfDelResult = { ok: boolean; error?: string; data?: true }
const cfCreate = vi.fn(
  async (): Promise<CfCreateResult> => ({
    ok: true,
    data: { id: 'ch-1', hostname: 'boka.salong.se', status: 'pending', sslStatus: 'pending_validation', dcv: [] },
  }),
)
const cfGet = vi.fn(async (): Promise<CfGetResult> => ({ ok: true, data: null }))
const cfDelete = vi.fn(async (): Promise<CfDelResult> => ({ ok: true, data: true }))
vi.mock('@/lib/cloudflare/custom-hostnames', () => ({
  createCustomHostname: (...a: unknown[]) => cfCreate(...(a as [])),
  getCustomHostnameByName: (...a: unknown[]) => cfGet(...(a as [])),
  deleteCustomHostname: (...a: unknown[]) => cfDelete(...(a as [])),
}))
// Top-level imports in actions.ts that pull server-only/cloudflare deps — never
// exercised by createTenant without a logo File, but must import cleanly.
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: vi.fn() }))
vi.mock('@/lib/r2/upload', () => ({
  uploadImage: vi.fn(async () => ({ ok: false })),
  uploadErrorMessage: () => '',
  pruneRemovedImages: vi.fn(async () => {}),
}))

import {
  createTenant,
  createPlatformCustomer,
  addCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
} from './actions'
import { resolveOwnerRole } from './owner-role'

// A fake service client whose invite + metadata calls succeed, so createTenant walks
// the users-insert path (where full_name + role_id live).
function fakeSvc(authId = 'auth-1') {
  return {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: authId } }, error: null })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
        deleteUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  }
}

// A service client whose INVITE fails (no auth user created) — drives the iErr branch.
function fakeSvcInviteFails() {
  return {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async () => ({ data: null, error: { message: 'boom' } })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
        deleteUser: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  }
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  f.set('theme', 'ateljevinter')
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

  it('rejects a template outside the 12 approved handoff themes', async () => {
    seedCtx()
    const res = await createTenant({}, fd({ name: 'K', slug: 'kx', theme: 'leander' }))
    expect(res.error).toBe('Välj en av de 12 godkända mallarna.')
  })

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

  it('invalidates the persistent customer layout after a successful create', async () => {
    seedCtx()
    createServiceClientMock.mockReturnValue(null)

    const res = await createTenant({}, fd({ name: 'Klippoteket', slug: 'klippoteket' }))

    expect(res.error).toBeUndefined()
    expect(revalidatePathMock).toHaveBeenCalledWith('/salonger', 'layout')
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
      access_scope: 'organization',
      primary_location_id: 'location-1',
    })
  })

  it('writes null full_name (never empty string) when the owner name is blank (#10)', async () => {
    const captured = seedCtx()
    createServiceClientMock.mockReturnValue(fakeSvc('auth-2'))
    await createTenant({}, fd({ name: 'K', slug: 'kx', owner_email: 'noname@x.se' }))
    expect((captured.users?.[0] as { full_name: unknown }).full_name).toBeNull()
  })
})

// ── CHECKLISTA W0 #2 — orphan-salong: invite-fail must leave ZERO ghost salons ────
describe('createTenant rolls back on owner-creation failure (no ghost salons)', () => {
  function seed(opts: { usersError?: unknown } = {}) {
    const { client, captured } = makeSupabase({
      tenants: { data: { id: 't1', slug: 'klippoteket' }, error: null },
      roles: { data: { id: 'role-1' }, error: null },
      users: { data: null, error: opts.usersError ?? null },
    })
    platformCtxMock.mockReturnValue(Promise.resolve({ user: { id: 'admin-1' }, supabase: client }))
    return captured
  }
  const ownerFd = () => fd({ name: 'Klippoteket', slug: 'klippoteket', owner_email: 'anna@x.se' })

  it('no service role + owner email → rolls back the tenant + actionable error', async () => {
    const captured = seed()
    createServiceClientMock.mockReturnValue(null)
    const res = await createTenant({}, ownerFd())
    expect(res.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
    expect(res.success).toBeUndefined()
    expect(captured['tenants.delete']).toBeDefined() // cascade rollback fired → 0 ghosts
  })

  it('invite API failure → rolls back the tenant + error', async () => {
    const captured = seed()
    createServiceClientMock.mockReturnValue(fakeSvcInviteFails())
    const res = await createTenant({}, ownerFd())
    expect(res.error).toMatch(/inbjudan misslyckades/)
    expect(res.success).toBeUndefined()
    expect(captured['tenants.delete']).toBeDefined()
  })

  it('users-row link failure → deletes the orphan auth user AND rolls back the tenant', async () => {
    const captured = seed({ usersError: { code: '23505' } })
    const svc = fakeSvc('auth-9')
    createServiceClientMock.mockReturnValue(svc)
    const res = await createTenant({}, ownerFd())
    expect(res.error).toMatch(/kunde inte kopplas/)
    expect(captured['tenants.delete']).toBeDefined()
    expect(svc.auth.admin.deleteUser).toHaveBeenCalledWith('auth-9') // orphan auth identity cleaned
  })

  it('owner-LESS onboarding still creates the salon (guard never trips without an email)', async () => {
    const captured = seed()
    createServiceClientMock.mockReturnValue(null)
    const res = await createTenant({}, fd({ name: 'Klippoteket', slug: 'klippoteket' }))
    expect(res.error).toBeUndefined()
    expect(res.success).toBeDefined()
    expect(captured['tenants.delete']).toBeUndefined() // no invite attempted → no rollback
    expect(captured.tenants?.[0]).toMatchObject({ slug: 'klippoteket' })
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

// ── goal-23 — addCustomDomain (CF provisioning + tenant_domains write) ─────────────
describe('addCustomDomain (goal-23 #9)', () => {
  // The action reads `tenants` (validate) + `tenant_domains` (dup + insert). The mock
  // keys results by table: tenants active by default; tdResult drives both the dup-check
  // (.data) and the insert terminal (.error).
  function seedCtx(
    tdResult: { data?: unknown; error?: unknown },
    tenantResult: { data?: unknown; error?: unknown } = { data: { id: 't1', status: 'active' }, error: null },
  ) {
    const { client, captured } = makeSupabase({ tenants: tenantResult, tenant_domains: tdResult })
    platformCtxMock.mockReturnValue(Promise.resolve({ user: { id: 'admin-1' }, supabase: client }))
    return captured
  }

  it('creates the CF hostname + writes a verified:false tenant_domains row, returns DCV', async () => {
    const captured = seedCtx({ data: null, error: null }) // no existing domain
    cfCreate.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'ch-1',
        hostname: 'boka.salong.se',
        status: 'pending',
        sslStatus: 'pending_validation',
        dcv: [{ type: 'TXT', name: '_acme', value: 'x', purpose: 'SSL (DCV)' }],
      },
    })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'Boka.Salong.SE' }))
    expect(res.error).toBeUndefined()
    expect(res.hostname?.dcv).toHaveLength(1)
    expect(captured.tenant_domains?.[0]).toMatchObject({
      tenant_id: 't1',
      domain: 'boka.salong.se', // normalized
      verified: false,
      is_primary: false,
    })
  })

  it('rejects a non-active / missing tenant BEFORE calling CF', async () => {
    const captured = seedCtx({ data: null, error: null }, { data: { id: 't1', status: 'suspended' }, error: null })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBeTruthy()
    expect(cfCreate).not.toHaveBeenCalled()
    expect(captured.tenant_domains).toBeUndefined()
  })

  it('rejects a duplicate domain BEFORE calling CF or inserting', async () => {
    const captured = seedCtx({ data: { id: 'existing' }, error: null })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBeTruthy()
    expect(cfCreate).not.toHaveBeenCalled()
    expect(captured.tenant_domains).toBeUndefined()
  })

  it('rejects an invalid domain — no CF, no row', async () => {
    const captured = seedCtx({ data: null, error: null })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'nodot' }))
    expect(res.error).toBeTruthy()
    expect(cfCreate).not.toHaveBeenCalled()
    expect(captured.tenant_domains).toBeUndefined()
  })

  it('rejects a reserved corevo.se domain — no CF, no row', async () => {
    const captured = seedCtx({ data: null, error: null })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'x.corevo.se' }))
    expect(res.error).toBeTruthy()
    expect(cfCreate).not.toHaveBeenCalled()
    expect(captured.tenant_domains).toBeUndefined()
  })

  it('writes NO row when Cloudflare fails (no orphan)', async () => {
    const captured = seedCtx({ data: null, error: null })
    cfCreate.mockResolvedValueOnce({ ok: false, error: 'CF down' })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBe('CF down')
    expect(captured.tenant_domains).toBeUndefined()
  })

  it('best-effort deletes the CF hostname when the DB insert fails (no orphan)', async () => {
    // dup-check sees data:null (passes) but the insert terminal returns an error.
    seedCtx({ data: null, error: { message: 'boom' } })
    cfCreate.mockResolvedValueOnce({
      ok: true,
      data: { id: 'ch-orphan', hostname: 'boka.salong.se', status: 'pending', sslStatus: null, dcv: [] },
    })
    const res = await addCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBeTruthy()
    expect(cfDelete).toHaveBeenCalledWith('ch-orphan')
  })
})

// ── goal-23 — verifyCustomDomain (fail-CLOSED gate: only flip on active+active) ─────
describe('verifyCustomDomain (goal-23)', () => {
  function seedCtx() {
    const { client, captured } = makeSupabase({ tenant_domains: { data: null, error: null } })
    platformCtxMock.mockReturnValue(Promise.resolve({ user: { id: 'admin-1' }, supabase: client }))
    return captured
  }
  const host = (status: string, sslStatus: string | null) => ({
    ok: true as const,
    data: { id: 'ch-1', hostname: 'boka.salong.se', status, sslStatus, dcv: [] },
  })

  it('flips verified=true ONLY when status active AND ssl active', async () => {
    const captured = seedCtx()
    cfGet.mockResolvedValueOnce(host('active', 'active'))
    const res = await verifyCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.verified).toBe(true)
    expect(captured['tenant_domains.update']?.[0]).toMatchObject({ verified: true })
  })

  it('does NOT flip when ssl is still pending', async () => {
    const captured = seedCtx()
    cfGet.mockResolvedValueOnce(host('active', 'pending_validation'))
    const res = await verifyCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.verified).toBe(false)
    expect(captured['tenant_domains.update']).toBeUndefined()
  })

  it('fail-CLOSED: does NOT flip when ssl status is null/absent', async () => {
    const captured = seedCtx()
    cfGet.mockResolvedValueOnce(host('active', null))
    const res = await verifyCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.verified).toBe(false)
    expect(captured['tenant_domains.update']).toBeUndefined()
  })

  it('errors when CF does not know the domain', async () => {
    seedCtx()
    cfGet.mockResolvedValueOnce({ ok: true, data: null })
    const res = await verifyCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBeTruthy()
  })
})

// ── goal-23 — removeCustomDomain (CF delete, then row delete; fail-closed) ──────────
describe('removeCustomDomain (goal-23)', () => {
  function seedCtx() {
    const { client, captured } = makeSupabase({ tenant_domains: { data: null, error: null } })
    platformCtxMock.mockReturnValue(Promise.resolve({ user: { id: 'admin-1' }, supabase: client }))
    return captured
  }

  it('deletes the CF hostname then the row', async () => {
    const captured = seedCtx()
    cfGet.mockResolvedValueOnce({
      ok: true,
      data: { id: 'ch-1', hostname: 'boka.salong.se', status: 'active', sslStatus: 'active', dcv: [] },
    })
    const res = await removeCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.success).toBeTruthy()
    expect(cfDelete).toHaveBeenCalledWith('ch-1')
    expect(captured['tenant_domains.delete']).toBeDefined()
  })

  it('does NOT delete the row when the CF delete fails (no orphan-the-other-way)', async () => {
    const captured = seedCtx()
    cfGet.mockResolvedValueOnce({
      ok: true,
      data: { id: 'ch-1', hostname: 'boka.salong.se', status: 'active', sslStatus: 'active', dcv: [] },
    })
    cfDelete.mockResolvedValueOnce({ ok: false, error: 'CF delete failed' })
    const res = await removeCustomDomain({}, fd({ tenantId: 't1', domain: 'boka.salong.se' }))
    expect(res.error).toBeTruthy()
    expect(captured['tenant_domains.delete']).toBeUndefined()
  })
})
