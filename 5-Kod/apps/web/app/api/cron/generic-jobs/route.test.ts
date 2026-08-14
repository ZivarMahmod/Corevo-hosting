import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ dispatchGenericJobs: vi.fn() }))
vi.mock('@/lib/jobs/generic-jobs', () => ({ dispatchGenericJobs: mocks.dispatchGenericJobs }))
vi.mock('@/lib/stripe/platform-billing', () => ({
  reconcilePlatformBillingJob: vi.fn(),
}))

import { GET, POST } from './route'

const originalSecret = process.env.CRON_SECRET
afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

function request(method = 'GET', authorized = true) {
  return new Request('https://booking.corevo.se/api/cron/generic-jobs', {
    method,
    headers: authorized ? { authorization: 'Bearer test-secret' } : {},
  })
}

describe('generic jobs cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mocks.dispatchGenericJobs.mockResolvedValue({
      claimed: 0,
      completed: 0,
      retried: 0,
      reviewRequired: 0,
    })
  })

  it('rejects unauthenticated callers without reading the queue', async () => {
    const response = await GET(request('GET', false))
    expect(response.status).toBe(401)
    expect(mocks.dispatchGenericJobs).not.toHaveBeenCalled()
  })

  it('runs a bounded queue pass for GET and POST', async () => {
    await expect(GET(request())).resolves.toMatchObject({ status: 200 })
    await expect(POST(request('POST'))).resolves.toMatchObject({ status: 200 })
    expect(mocks.dispatchGenericJobs).toHaveBeenNthCalledWith(1, {
      'stripe.billing.reconcile': expect.any(Function),
    })
    expect(mocks.dispatchGenericJobs).toHaveBeenNthCalledWith(2, {
      'stripe.billing.reconcile': expect.any(Function),
    })
  })

  it('fails the scheduler gate on retry or review work without leaking internals', async () => {
    mocks.dispatchGenericJobs.mockResolvedValue({
      claimed: 1,
      completed: 0,
      retried: 1,
      reviewRequired: 0,
    })
    const retry = await GET(request())
    expect(retry.status).toBe(503)
    await expect(retry.json()).resolves.toMatchObject({ error: 'job_review_required' })

    mocks.dispatchGenericJobs.mockRejectedValue(new Error('sensitive database message'))
    const failed = await GET(request())
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'cron_failed' })
  })
})
