import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatchPaymentRefundJobs: vi.fn(),
  readPaymentRefundHealth: vi.fn(),
}))
vi.mock('@/lib/payments/refund-outbox', () => ({
  dispatchPaymentRefundJobs: mocks.dispatchPaymentRefundJobs,
  readPaymentRefundHealth: mocks.readPaymentRefundHealth,
}))

import { GET, POST } from './route'

const original = process.env.CRON_SECRET
afterAll(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})

describe('payment refund cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mocks.dispatchPaymentRefundJobs.mockResolvedValue({
      claimed: 0, completed: 0, retried: 0, reviewRequired: 0, stale: 0, failed: 0,
    })
    mocks.readPaymentRefundHealth.mockResolvedValue({
      queued: 0, attempting: 0, providerStarted: 0, reviewRequired: 0,
      stuckProviderStarted: 0, overduePending: 0,
    })
  })

  it('rejects unauthenticated callers', async () => {
    const response = await GET(new Request('https://booking.corevo.se/api/cron/payment-refunds'))
    expect(response.status).toBe(401)
    expect(mocks.dispatchPaymentRefundJobs).not.toHaveBeenCalled()
  })

  it('runs a small isolated batch for GET and POST', async () => {
    for (const handler of [GET, POST]) {
      const response = await handler(new Request('https://booking.corevo.se/api/cron/payment-refunds', {
        method: handler === POST ? 'POST' : 'GET',
        headers: { authorization: 'Bearer test-secret' },
      }))
      expect(response.status).toBe(200)
    }
    expect(mocks.dispatchPaymentRefundJobs).toHaveBeenNthCalledWith(1, 5)
    expect(mocks.dispatchPaymentRefundJobs).toHaveBeenNthCalledWith(2, 5)
    expect(mocks.readPaymentRefundHealth).toHaveBeenCalledTimes(2)
  })

  it('returns 500 without leaking the worker error', async () => {
    mocks.dispatchPaymentRefundJobs.mockRejectedValue(new Error('sensitive upstream response'))
    const response = await GET(new Request('https://booking.corevo.se/api/cron/payment-refunds', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })

  it('fails the scheduler gate when manual review, provider uncertainty, or overdue pending work exists', async () => {
    mocks.readPaymentRefundHealth.mockResolvedValue({
      queued: 1, attempting: 0, providerStarted: 1, reviewRequired: 1,
      stuckProviderStarted: 1, overduePending: 1,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/payment-refunds', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'refund_review_required' })
  })

  it('fails the scheduler gate when only pending work is beyond the 60-minute SLA', async () => {
    mocks.readPaymentRefundHealth.mockResolvedValue({
      queued: 1, attempting: 0, providerStarted: 0, reviewRequired: 0,
      stuckProviderStarted: 0, overduePending: 1,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/payment-refunds', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'refund_review_required' })
  })

  it('fails closed on failed or stale work even before the health snapshot catches up', async () => {
    for (const result of [
      { failed: 1, stale: 0, reviewRequired: 0, retried: 0 },
      { failed: 0, stale: 1, reviewRequired: 0, retried: 0 },
      { failed: 0, stale: 0, reviewRequired: 1, retried: 0 },
      { failed: 0, stale: 0, reviewRequired: 0, retried: 1 },
    ]) {
      mocks.dispatchPaymentRefundJobs.mockResolvedValue({
        claimed: 1, completed: 0, ...result,
      })
      const response = await GET(new Request('https://booking.corevo.se/api/cron/payment-refunds', {
        headers: { authorization: 'Bearer test-secret' },
      }))
      expect(response.status).toBe(503)
    }
  })
})
