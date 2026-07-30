import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  runMediaCleanup: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({
  createServiceClient: mocks.createServiceClient,
}))
vi.mock('@/lib/media/cleanup', () => ({
  runMediaCleanup: mocks.runMediaCleanup,
}))

import { GET, POST } from './route'

const original = process.env.CRON_SECRET
afterAll(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})

describe('media cleanup cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mocks.createServiceClient.mockReturnValue({ rpc: vi.fn() })
    mocks.runMediaCleanup.mockResolvedValue({
      claimed: 0,
      deleted: 0,
      retried: 0,
      failed: 0,
    })
  })

  it('rejects unauthenticated callers before creating a service client', async () => {
    const response = await GET(
      new Request('https://booking.corevo.se/api/cron/media-cleanup'),
    )

    expect(response.status).toBe(401)
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.runMediaCleanup).not.toHaveBeenCalled()
  })

  it('returns service_unavailable when the service client is not configured', async () => {
    mocks.createServiceClient.mockReturnValue(null)

    const response = await GET(new Request(
      'https://booking.corevo.se/api/cron/media-cleanup',
      { headers: { authorization: 'Bearer test-secret' } },
    ))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'service_unavailable' })
  })

  it('runs the bounded worker for GET and POST', async () => {
    for (const handler of [GET, POST]) {
      const response = await handler(new Request(
        'https://booking.corevo.se/api/cron/media-cleanup',
        {
          method: handler === POST ? 'POST' : 'GET',
          headers: { authorization: 'Bearer test-secret' },
        },
      ))
      expect(response.status).toBe(200)
    }

    expect(mocks.runMediaCleanup).toHaveBeenCalledTimes(2)
    expect(mocks.runMediaCleanup).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ rpc: expect.any(Function) }),
      20,
    )
  })

  it('fails the scheduler gate when cleanup fails or needs an R2 retry', async () => {
    for (const degraded of [
      { retried: 0, failed: 1 },
      { retried: 1, failed: 0 },
    ]) {
      mocks.runMediaCleanup.mockResolvedValue({
        claimed: 1,
        deleted: 0,
        ...degraded,
      })

      const response = await GET(new Request(
        'https://booking.corevo.se/api/cron/media-cleanup',
        { headers: { authorization: 'Bearer test-secret' } },
      ))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({
        error: 'media_cleanup_degraded',
        ...degraded,
      })
    }
  })

  it('returns a closed generic 500 without leaking worker errors', async () => {
    mocks.runMediaCleanup.mockRejectedValue(new Error('sensitive R2 response'))

    const response = await GET(new Request(
      'https://booking.corevo.se/api/cron/media-cleanup',
      { headers: { authorization: 'Bearer test-secret' } },
    ))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })
})
