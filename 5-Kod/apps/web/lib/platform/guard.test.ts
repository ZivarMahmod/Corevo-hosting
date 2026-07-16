import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requirePortal: vi.fn(),
  createClient: vi.fn(async () => ({ marker: 'cookie-client' })),
}))

vi.mock('@/lib/auth/session', () => ({
  requirePortal: mocks.requirePortal,
  requirePlatformAdmin: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { siteRevisionCtx } from './guard'

beforeEach(() => vi.clearAllMocks())

describe('siteRevisionCtx', () => {
  it('uses requested tenant for platform admin', async () => {
    mocks.requirePortal.mockResolvedValue({ id: 'platform-1', platformAdmin: true, tenantId: null })
    await expect(siteRevisionCtx({ tenantId: 'tenant-requested' })).resolves.toMatchObject({
      tenantId: 'tenant-requested',
      supabase: { marker: 'cookie-client' },
    })
  })

  it('forces the verified session tenant for salon admin', async () => {
    mocks.requirePortal.mockResolvedValue({ id: 'salon-1', platformAdmin: false, tenantId: 'tenant-session' })
    await expect(siteRevisionCtx({ tenantId: 'tenant-attacker' })).resolves.toMatchObject({
      tenantId: 'tenant-session',
    })
  })
})
