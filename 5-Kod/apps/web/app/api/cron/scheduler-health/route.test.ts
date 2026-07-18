import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { GET } from './route'

const originalSecret = process.env.CRON_SECRET
const request = (secret = 'test-secret') => new Request(
  'https://booking.corevo.se/api/cron/scheduler-health',
  { headers: { authorization: `Bearer ${secret}` } },
)

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('scheduler heartbeat health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('is secret-gated', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
  })

  it('returns 200 only for a fresh successful primary heartbeat', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { healthy: true, status: 'succeeded', age_seconds: 300 },
        error: null,
      }),
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      healthy: true,
      status: 'succeeded',
      age_seconds: 300,
    })
  })

  it('returns 503 for stale/missing heartbeats or database errors', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: { healthy: false, status: 'failed', age_seconds: 2400 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'missing migration' } })
    mocks.createServiceClient.mockReturnValue({ rpc })

    expect((await GET(request())).status).toBe(503)
    expect((await GET(request())).status).toBe(503)
  })
})
