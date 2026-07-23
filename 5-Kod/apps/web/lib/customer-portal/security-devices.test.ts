import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import {
  getPortalSecuritySnapshot,
  revokeOtherPortalSessions,
  revokePortalBookingTrusts,
} from './security-devices'

const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)
const now = '2026-07-23T10:00:00.000Z'

describe('portal session and booking-trust security controls', () => {
  const rpc = vi.fn()
  const store = { get: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    store.get.mockReturnValue({ value: `v1.${sessionId}.${secret}` })
    mocks.cookies.mockResolvedValue(store)
    mocks.createServiceClient.mockReturnValue({ rpc })
  })

  it('returns neutral metadata and revokes only through the cookie-bound RPCs', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        outcome: 'ok',
        security: {
          sessions: [
            { label: null, isCurrent: true, createdAt: now, lastSeenAt: now },
            { label: 'Safari på iPhone', isCurrent: false, createdAt: now, lastSeenAt: now },
          ],
          bookingTrusts: [
            { label: null, createdAt: now, lastSeenAt: now },
          ],
        },
        recovery_tenant_slug: null,
      }],
      error: null,
    })

    await expect(getPortalSecuritySnapshot()).resolves.toEqual({
      outcome: 'ok',
      sessions: [
        { label: 'Den här webbläsaren', isCurrent: true, createdAt: now, lastSeenAt: now },
        { label: 'Safari på iPhone', isCurrent: false, createdAt: now, lastSeenAt: now },
      ],
      bookingTrusts: [
        { label: 'PIN-fri bokningsenhet', createdAt: now, lastSeenAt: now },
      ],
    })

    rpc.mockResolvedValueOnce({ data: 1, error: null })
    await expect(revokeOtherPortalSessions()).resolves.toEqual({ outcome: 'success', count: 1 })

    rpc.mockResolvedValueOnce({ data: 2, error: null })
    await expect(revokePortalBookingTrusts()).resolves.toEqual({ outcome: 'success', count: 2 })

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'customer_portal_security_snapshot',
      'customer_portal_revoke_other_sessions',
      'customer_portal_revoke_booking_trusts',
    ])
  })
})
