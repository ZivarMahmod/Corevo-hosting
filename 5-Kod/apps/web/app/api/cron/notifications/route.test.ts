import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dispatchNotificationOutbox: vi.fn() }))
vi.mock('@/lib/notifications/outbox', () => ({
  dispatchNotificationOutbox: mocks.dispatchNotificationOutbox,
}))

import { GET } from './route'

const originalSecret = process.env.CRON_SECRET

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('notification outbox cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('rejects unauthenticated callers without dispatching', async () => {
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications'))
    expect(response.status).toBe(401)
    expect(mocks.dispatchNotificationOutbox).not.toHaveBeenCalled()
  })

  it('returns zero without an explicitly wired transport', async () => {
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0,
      sent: 0,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 0,
      sent: 0,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    })
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledWith()
  })

  it('returns 500 so the scheduler can alert on database failure', async () => {
    mocks.dispatchNotificationOutbox.mockRejectedValue(new Error('claim_failed'))
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })
})
