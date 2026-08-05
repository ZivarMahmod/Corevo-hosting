import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ platformCtx: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('./guard', () => ({ platformCtx: () => mocks.platformCtx() }))
vi.mock('@/lib/storefront-url', () => ({ tenantStorefrontHost: vi.fn() }))

import { getDomainOverview } from './domain-overview'

describe('getDomainOverview', () => {
  beforeEach(() => {
    const order = vi.fn().mockResolvedValue({ data: [] })
    const neq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ neq }))
    mocks.platformCtx.mockResolvedValue({ supabase: { from: vi.fn(() => ({ select })) } })
  })

  it('lists every fixed published application host', async () => {
    await expect(getDomainOverview()).resolves.toMatchObject({
      fixedHosts: [
        'booking.corevo.se',
        'superbooking.corevo.se',
        'minbooking.corevo.se',
        'mina.corevo.se',
      ],
    })
  })
})
