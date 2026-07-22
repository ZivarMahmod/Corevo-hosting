import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { cancelPortalBooking } from './actions'

const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const bookingId = '223e4567-e89b-42d3-a456-426614174000'
const refundJobId = '323e4567-e89b-42d3-a456-426614174000'
const idempotencyKey = '423e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)

describe('customer portal cancellation action DAL', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: `v1.${sessionId}.${secret}` })),
    })
    mocks.createServiceClient.mockReturnValue({ rpc })
  })

  it.each(['cancelled', 'already_cancelled'] as const)(
    'maps %s to idempotent success without exposing refund metadata',
    async (outcome) => {
      rpc.mockResolvedValue({
        data: [{ outcome, booking_status: 'cancelled', refund_job_id: refundJobId }],
        error: null,
      })

      await expect(cancelPortalBooking({
        bookingPublicId: bookingId,
        expectedCutoffHours: 24,
        idempotencyKey,
      })).resolves.toEqual({ outcome: 'success' })

      expect(rpc).toHaveBeenCalledWith('customer_portal_cancel_booking', {
        p_session_public_id: sessionId,
        p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        p_booking_public_id: bookingId,
        p_expected_cutoff_hours: 24,
        p_idempotency_key: idempotencyKey,
      })
      expect(JSON.stringify(rpc.mock.calls)).not.toContain(secret)
      expect(JSON.stringify(await cancelPortalBookingResult(outcome))).not.toContain(refundJobId)
    },
  )

  it.each(['policy_changed', 'not_allowed'] as const)(
    'maps %s to the canonical policy-blocked result',
    async (outcome) => {
      rpc.mockResolvedValue({
        data: [{ outcome, booking_status: 'confirmed', refund_job_id: null }],
        error: null,
      })
      await expect(cancelPortalBooking({
        bookingPublicId: bookingId,
        expectedCutoffHours: 24,
        idempotencyKey,
      })).resolves.toEqual({ outcome: 'policy_blocked' })
    },
  )

  it.each(['not_found', 'idempotency_conflict'] as const)(
    'maps %s to a neutral unavailable result',
    async (outcome) => {
      rpc.mockResolvedValue({
        data: [{ outcome, booking_status: null, refund_job_id: null }],
        error: null,
      })
      await expect(cancelPortalBooking({
        bookingPublicId: bookingId,
        expectedCutoffHours: 24,
        idempotencyKey,
      })).resolves.toEqual({ outcome: 'unavailable' })
    },
  )

  it('fails closed for invalid input before reading secrets or calling the database', async () => {
    await expect(cancelPortalBooking({
      bookingPublicId: 'not-a-booking',
      expectedCutoffHours: 24,
      idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId,
      expectedCutoffHours: -1,
      idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId,
      expectedCutoffHours: 24,
      idempotencyKey: 'reused-free-text-key',
    })).resolves.toEqual({ outcome: 'unavailable' })
    expect(mocks.cookies).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed for missing session/service, RPC errors and thrown errors', async () => {
    mocks.cookies.mockResolvedValueOnce({ get: vi.fn(() => undefined) })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })

    mocks.createServiceClient.mockReturnValueOnce(null)
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockRejectedValueOnce(new Error('network'))
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })
  })

  it.each([
    null,
    [],
    [{ outcome: 'cancelled', booking_status: 'cancelled', refund_job_id: null }, { outcome: 'cancelled' }],
    [{ outcome: 'cancelled', booking_status: 'pending', refund_job_id: null }],
    [{ outcome: 'cancelled', booking_status: 'cancelled' }],
    [{ outcome: 'cancelled', booking_status: 'cancelled', refund_job_id: 'not-a-uuid' }],
    [{ outcome: 'future_outcome', booking_status: null, refund_job_id: null }],
  ])('fails closed for malformed or unknown RPC data %#', async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })
  })

  it.each([
    { data: [{ outcome: 'policy_changed', booking_status: 'completed', refund_job_id: null }] },
    { data: [{ outcome: 'policy_changed', booking_status: '', refund_job_id: null }] },
    { data: [{ outcome: 'not_allowed', booking_status: 'cancelled', refund_job_id: null }] },
    { data: [{ outcome: 'not_allowed', booking_status: 'future_status', refund_job_id: null }] },
    { data: [{ outcome: 'not_allowed', booking_status: null, refund_job_id: null }] },
    { data: [{ outcome: 'not_found', booking_status: 'confirmed', refund_job_id: null }] },
    { data: [{ outcome: 'idempotency_conflict', booking_status: null, refund_job_id: refundJobId }] },
    { data: [{ outcome: 'already_cancelled', booking_status: 'cancelled', refund_job_id: 42 }] },
  ])('rejects adversarial outcome/shape combinations %#', async ({ data }) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(cancelPortalBooking({
      bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
    })).resolves.toEqual({ outcome: 'unavailable' })
  })

  it.each(['pending', 'confirmed', 'completed', 'no_show'] as const)(
    'accepts the complete 0121 not_allowed booking-status set: %s',
    async (bookingStatus) => {
      rpc.mockResolvedValue({
        data: [{ outcome: 'not_allowed', booking_status: bookingStatus, refund_job_id: null }],
        error: null,
      })
      await expect(cancelPortalBooking({
        bookingPublicId: bookingId, expectedCutoffHours: 24, idempotencyKey,
      })).resolves.toEqual({ outcome: 'policy_blocked' })
    },
  )

  async function cancelPortalBookingResult(outcome: 'cancelled' | 'already_cancelled') {
    rpc.mockResolvedValue({
      data: [{ outcome, booking_status: 'cancelled', refund_job_id: refundJobId }],
      error: null,
    })
    return cancelPortalBooking({
      bookingPublicId: bookingId,
      expectedCutoffHours: 24,
      idempotencyKey,
    })
  }
})
