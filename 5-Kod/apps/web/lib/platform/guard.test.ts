import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePortal: vi.fn(),
  requirePlatformOperator: vi.fn(),
  requirePlatformAdmin: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
  requirePortal: mocks.requirePortal,
  requirePlatformOperator: mocks.requirePlatformOperator,
  requirePlatformAdmin: mocks.requirePlatformAdmin,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { platformAdminCtx, platformCtx, siteRevisionCtx } from './guard'

function tenantLookupClient(result: { data: { id: string } | null; error: unknown }) {
  const maybeSingle = vi.fn(async () => result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from }, from, select, eq, maybeSingle }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ marker: 'cookie-client' })
})

describe('platformCtx', () => {
  it('returns a global scope only for a verified super admin', async () => {
    mocks.requirePlatformOperator.mockResolvedValue({
      id: 'root-1',
      platformAdmin: true,
      partnerAdmin: false,
      partnerId: null,
    })

    await expect(platformCtx()).resolves.toMatchObject({
      scope: { kind: 'global', partnerId: null },
      supabase: { marker: 'cookie-client' },
    })
  })

  it('returns the verified partner scope without granting global access', async () => {
    mocks.requirePlatformOperator.mockResolvedValue({
      id: 'partner-user-1',
      platformAdmin: false,
      partnerAdmin: true,
      partnerId: 'partner-a',
    })

    await expect(platformCtx()).resolves.toMatchObject({
      scope: { kind: 'partner', partnerId: 'partner-a' },
    })
  })
})

describe('platformAdminCtx', () => {
  it('keeps global settings and role actions behind the exact root guard', async () => {
    mocks.requirePlatformAdmin.mockResolvedValue({
      id: 'root-1',
      platformAdmin: true,
      partnerAdmin: false,
      partnerId: null,
    })

    await expect(platformAdminCtx()).resolves.toMatchObject({
      scope: { kind: 'global', partnerId: null },
    })
    expect(mocks.requirePlatformAdmin).toHaveBeenCalledTimes(1)
    expect(mocks.requirePlatformOperator).not.toHaveBeenCalled()
  })
})

describe('siteRevisionCtx', () => {
  it('uses an existing requested tenant for a global platform admin', async () => {
    const lookup = tenantLookupClient({ data: { id: 'tenant-requested' }, error: null })
    mocks.createClient.mockResolvedValue(lookup.client)
    mocks.requirePortal.mockResolvedValue({
      id: 'platform-1',
      platformAdmin: true,
      partnerAdmin: false,
      partnerId: null,
      tenantId: null,
    })

    await expect(siteRevisionCtx({ tenantId: 'tenant-requested' })).resolves.toMatchObject({
      tenantId: 'tenant-requested',
    })
    expect(lookup.from).toHaveBeenCalledWith('tenants')
    expect(lookup.eq).toHaveBeenCalledWith('id', 'tenant-requested')
  })

  it('allows a partner only when the cookie client can read the requested tenant', async () => {
    const lookup = tenantLookupClient({ data: { id: 'tenant-a' }, error: null })
    mocks.createClient.mockResolvedValue(lookup.client)
    mocks.requirePortal.mockResolvedValue({
      id: 'partner-user-1',
      platformAdmin: false,
      partnerAdmin: true,
      partnerId: 'partner-a',
      tenantId: null,
    })

    await expect(siteRevisionCtx({ tenantId: 'tenant-a' })).resolves.toMatchObject({
      tenantId: 'tenant-a',
    })
  })

  it('rejects a foreign partner tenant before returning an action context', async () => {
    const lookup = tenantLookupClient({ data: null, error: null })
    mocks.createClient.mockResolvedValue(lookup.client)
    mocks.requirePortal.mockResolvedValue({
      id: 'partner-user-1',
      platformAdmin: false,
      partnerAdmin: true,
      partnerId: 'partner-a',
      tenantId: null,
    })

    await expect(siteRevisionCtx({ tenantId: 'tenant-b' })).rejects.toThrow(
      'Tenant is outside the verified platform scope',
    )
  })

  it('forces the verified session tenant for salon admin without a cross-tenant lookup', async () => {
    mocks.requirePortal.mockResolvedValue({
      id: 'salon-1',
      platformAdmin: false,
      partnerAdmin: false,
      partnerId: null,
      tenantId: 'tenant-session',
    })

    await expect(siteRevisionCtx({ tenantId: 'tenant-attacker' })).resolves.toMatchObject({
      tenantId: 'tenant-session',
    })
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })
})
