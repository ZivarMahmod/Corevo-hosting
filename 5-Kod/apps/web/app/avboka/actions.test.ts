import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createServiceClient: vi.fn(),
  getClientIp: vi.fn(),
  verifyCancelToken: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: vi.fn(() => 'avboka:test'),
  LIMITS: { kontakt: { max: 5, windowSeconds: 60 } },
}))
vi.mock('@/lib/booking/cancel-token', () => ({ verifyCancelToken: mocks.verifyCancelToken }))
vi.mock('@/lib/kund/settings', () => ({
  getCancellationCutoffHours: vi.fn(async () => 24),
  withinCancellationWindow: vi.fn(() => true),
}))
vi.mock('@/lib/notifications/booking-events', () => ({
  queueBookingEvent: vi.fn(async () => ({ state: 'queued', channel: 'email', inserted: true })),
}))
vi.mock('@/lib/observability', () => ({ logger: { warn: vi.fn() } }))

import { cancelByToken } from './actions'

const bookingId = '123e4567-e89b-42d3-a456-426614174000'
const tenantId = '223e4567-e89b-42d3-a456-426614174000'
const customerId = '323e4567-e89b-42d3-a456-426614174000'

describe('guest cancellation action', () => {
  const maybeSingle = vi.fn()
  const rpc = vi.fn()
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    maybeSingle,
    select: vi.fn(() => query),
    update: vi.fn(() => query),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientIp.mockResolvedValue('127.0.0.1')
    mocks.checkRateLimit.mockResolvedValue(true)
    mocks.verifyCancelToken.mockResolvedValue(true)
    maybeSingle
      .mockResolvedValueOnce({
        data: {
          id: bookingId,
          tenant_id: tenantId,
          status: 'confirmed',
          start_ts: '2030-01-02T10:00:00.000Z',
          customer_id: customerId,
          customer_profile_id: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: bookingId }, error: null })
    rpc.mockResolvedValue({
      data: [{ outcome: 'cancelled', booking_status: 'cancelled', refund_job_id: null }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue({ from: vi.fn(() => query), rpc })
  })

  it('stops before database access when the capability token is invalid', async () => {
    mocks.verifyCancelToken.mockResolvedValue(false)

    await expect(cancelByToken(bookingId, 'bad-token')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_token',
    })

    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('delegates the verified booking to the single cancellation RPC owner', async () => {
    await expect(cancelByToken(bookingId, 'valid-token')).resolves.toEqual({ ok: true })

    expect(rpc).toHaveBeenCalledWith('cancel_verified_customer_booking', {
      p_tenant: tenantId,
      p_booking: bookingId,
      p_customer: customerId,
      p_customer_profile: null,
    })
  })
})
