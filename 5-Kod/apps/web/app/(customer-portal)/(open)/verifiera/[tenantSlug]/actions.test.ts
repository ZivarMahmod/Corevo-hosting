import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPortalRecoveryState: vi.fn(),
  verifyPortalRecovery: vi.fn(),
  getClientIp: vi.fn(),
  noStore: vi.fn(),
}))

vi.mock('@/lib/customer-portal/recovery', () => ({
  getPortalRecoveryState: mocks.getPortalRecoveryState,
  verifyPortalRecovery: mocks.verifyPortalRecovery,
}))
vi.mock('@/lib/security/rate-limit', () => ({ getClientIp: mocks.getClientIp }))
vi.mock('next/cache', () => ({ unstable_noStore: mocks.noStore }))

import { getRecoveryStateAction } from './actions'

describe('getRecoveryStateAction', () => {
  afterEach(() => vi.useRealTimers())

  it('converts the server deadline to stable seconds before hydrating the PIN client', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T18:00:00.000Z'))
    mocks.getPortalRecoveryState.mockResolvedValue({
      state: 'sent',
      attemptsRemaining: 5,
      resendAfter: '2026-07-22T18:00:30.000Z',
    })

    await expect(getRecoveryStateAction('freshcut')).resolves.toEqual({
      state: 'sent',
      attemptsRemaining: 5,
      retryAfterSeconds: 30,
    })
  })
})
