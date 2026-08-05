// Dual-guard-STAKETET för modul-actions (goal-54 §1). Säkerhetstestet som är gate
// för hela kundkorts-bygget: en salon_admin får ALDRIG kunna peka ut en annan
// tenant via formulärets tenantId — fältet ska ignoreras helt för den rollen.
// En platform_admin väljer tenant ur formuläret; saknat/okänt id → null (deny).

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({ requirePortal: vi.fn() }))
vi.mock('@/lib/admin/tenant', () => ({
  getAdminTenant: vi.fn(),
  loadAdminTenantById: vi.fn(),
  requireActiveTenantMutation: vi.fn(),
}))
vi.mock('@/lib/admin/modules', () => ({
  getAdminModuleStates: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { moduleCtx, organizationOwnerCtx } from './module-ctx'
import { requirePortal } from '@/lib/auth/session'
import { getAdminModuleStates } from '@/lib/admin/modules'
import { createClient } from '@/lib/supabase/server'
import {
  getAdminTenant,
  loadAdminTenantById,
  requireActiveTenantMutation,
} from '@/lib/admin/tenant'

const mRequire = vi.mocked(requirePortal)
const mByJwt = vi.mocked(getAdminTenant)
const mById = vi.mocked(loadAdminTenantById)
const mRequireActive = vi.mocked(requireActiveTenantMutation)
const mModuleStates = vi.mocked(getAdminModuleStates)
const mCreateClient = vi.mocked(createClient)

const OWN = { id: 't-own', slug: 'own', name: 'Egen' }
const OTHER = { id: 't-other', slug: 'other', name: 'Annan' }

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

function locationScope(accessScope: 'organization' | 'locations' | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { access_scope: accessScope, primary_location_id: null },
  })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  mCreateClient.mockResolvedValue({ from: vi.fn(() => ({ select })) } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mRequireActive.mockResolvedValue(undefined)
  mModuleStates.mockResolvedValue({})
})

describe('moduleCtx — salon_admin (JWT-forced tenant)', () => {
  beforeEach(() => {
    mRequire.mockResolvedValue({ id: 'u1', platformAdmin: false, tenantId: 't-own' } as never)
    mByJwt.mockResolvedValue(OWN as never)
  })

  it('resolves the JWT tenant and IGNORES a posted tenantId (no cross-tenant escalation)', async () => {
    const ctx = await moduleCtx(fd({ tenantId: 't-other' }))
    expect(ctx?.tenant.id).toBe('t-own')
    expect(mRequireActive).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      't-own',
    )
    // The escalation path must never even be consulted for a salon admin.
    expect(mById).not.toHaveBeenCalled()
  })

  it('no tenant on the account → null (deny)', async () => {
    mByJwt.mockResolvedValue(null as never)
    expect(await moduleCtx(fd({ tenantId: 't-other' }))).toBeNull()
  })

  it.each([
    ['live', true],
    ['off', false],
  ] as const)('allows blogg mutations=%s only when live', async (state, allowed) => {
    mModuleStates.mockResolvedValue({ blogg: { state, config: {} } })

    const ctx = await moduleCtx(fd({}), 'blogg')

    expect(Boolean(ctx)).toBe(allowed)
    expect(mModuleStates).toHaveBeenCalledWith('t-own')
  })

  it('denies an explicit module key when its row is missing', async () => {
    expect(await moduleCtx(fd({}), 'blogg')).toBeNull()
  })

  it('keeps keyless tenant-wide mutations ungated', async () => {
    expect(await moduleCtx(fd({}))).not.toBeNull()
    expect(mModuleStates).not.toHaveBeenCalled()
  })

  it('organizationOwnerCtx denies a location-scoped admin', async () => {
    locationScope('locations')

    expect(await organizationOwnerCtx(fd({}))).toBeNull()
    expect(mCreateClient).toHaveBeenCalledOnce()
  })

  it('organizationOwnerCtx allows an organization-scoped admin', async () => {
    locationScope('organization')

    expect((await organizationOwnerCtx(fd({})))?.tenant.id).toBe('t-own')
  })
})

describe('moduleCtx — platform_admin (tenant from the form)', () => {
  beforeEach(() => {
    mRequire.mockResolvedValue({ id: 'p1', platformAdmin: true, tenantId: null } as never)
  })

  it('resolves the posted tenantId', async () => {
    mById.mockResolvedValue(OTHER as never)
    const ctx = await moduleCtx(fd({ tenantId: 't-other' }))
    expect(ctx?.tenant.id).toBe('t-other')
    expect(mRequireActive).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      't-other',
    )
    expect(mById).toHaveBeenCalledWith('t-other')
    expect(mByJwt).not.toHaveBeenCalled()
  })

  it('missing tenantId → null (deny)', async () => {
    expect(await moduleCtx(fd({}))).toBeNull()
    expect(mById).not.toHaveBeenCalled()
  })

  it('unknown tenantId → null (deny)', async () => {
    mById.mockResolvedValue(null as never)
    expect(await moduleCtx(fd({ tenantId: 'nope' }))).toBeNull()
  })

  it('organizationOwnerCtx keeps platform tenant selection without a user-scope lookup', async () => {
    mById.mockResolvedValue(OTHER as never)

    expect((await organizationOwnerCtx(fd({ tenantId: 't-other' })))?.tenant.id).toBe('t-other')
    expect(mCreateClient).not.toHaveBeenCalled()
  })
})

describe('moduleCtx — partner operator (RLS-scoped tenant from the form)', () => {
  it('uses the posted tenant and keeps the module-state gate', async () => {
    mRequire.mockResolvedValue({
      id: 'partner-user',
      platformAdmin: false,
      partnerAdmin: true,
      partnerId: 'partner-a',
      tenantId: null,
    } as never)
    mById.mockResolvedValue(OTHER as never)
    mModuleStates.mockResolvedValue({ blogg: { state: 'live', config: {} } })

    const ctx = await moduleCtx(fd({ tenantId: 't-other' }), 'blogg')

    expect(ctx?.tenant.id).toBe('t-other')
    expect(mById).toHaveBeenCalledWith('t-other')
    expect(mByJwt).not.toHaveBeenCalled()
  })

  it('organizationOwnerCtx keeps the partner RLS tenant path', async () => {
    mRequire.mockResolvedValue({
      id: 'partner-user',
      platformAdmin: false,
      partnerAdmin: true,
      partnerId: 'partner-a',
      tenantId: null,
    } as never)
    mById.mockResolvedValue(OTHER as never)

    expect((await organizationOwnerCtx(fd({ tenantId: 't-other' })))?.tenant.id).toBe('t-other')
    expect(mCreateClient).not.toHaveBeenCalled()
  })
})
