// Dual-guard-STAKETET för modul-actions (goal-54 §1). Säkerhetstestet som är gate
// för hela kundkorts-bygget: en salon_admin får ALDRIG kunna peka ut en annan
// tenant via formulärets tenantId — fältet ska ignoreras helt för den rollen.
// En platform_admin väljer tenant ur formuläret; saknat/okänt id → null (deny).

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({ requirePortal: vi.fn() }))
vi.mock('@/lib/admin/tenant', () => ({
  getAdminTenant: vi.fn(),
  loadAdminTenantById: vi.fn(),
}))

import { moduleCtx } from './module-ctx'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, loadAdminTenantById } from '@/lib/admin/tenant'

const mRequire = vi.mocked(requirePortal)
const mByJwt = vi.mocked(getAdminTenant)
const mById = vi.mocked(loadAdminTenantById)

const OWN = { id: 't-own', slug: 'own', name: 'Egen' }
const OTHER = { id: 't-other', slug: 'other', name: 'Annan' }

function fd(entries: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('moduleCtx — salon_admin (JWT-forced tenant)', () => {
  beforeEach(() => {
    mRequire.mockResolvedValue({ id: 'u1', platformAdmin: false, tenantId: 't-own' } as never)
    mByJwt.mockResolvedValue(OWN as never)
  })

  it('resolves the JWT tenant and IGNORES a posted tenantId (no cross-tenant escalation)', async () => {
    const ctx = await moduleCtx(fd({ tenantId: 't-other' }))
    expect(ctx?.tenant.id).toBe('t-own')
    // The escalation path must never even be consulted for a salon admin.
    expect(mById).not.toHaveBeenCalled()
  })

  it('no tenant on the account → null (deny)', async () => {
    mByJwt.mockResolvedValue(null as never)
    expect(await moduleCtx(fd({ tenantId: 't-other' }))).toBeNull()
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
})
