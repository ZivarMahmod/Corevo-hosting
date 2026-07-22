import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getStripe: vi.fn(),
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/stripe/client', () => ({ getStripe: mocks.getStripe }))

import { dispatchPaymentRefundJobById, dispatchPaymentRefundJobs } from './refund-outbox'

const jobId = '123e4567-e89b-42d3-a456-426614174000'
const leaseToken = '223e4567-e89b-42d3-a456-426614174000'
const job = {
  id: jobId,
  tenant_id: '323e4567-e89b-42d3-a456-426614174000',
  payment_id: '423e4567-e89b-42d3-a456-426614174000',
  booking_id: '523e4567-e89b-42d3-a456-426614174000',
  payment_intent_id: 'pi_safe_1',
  connected_account_id: 'acct_safe_1',
  provider_idempotency_key: 'refund_523e4567-e89b-42d3-a456-426614174000',
  attempt_count: 1,
  lease_token: leaseToken,
}

describe('payment refund outbox worker', () => {
  const rpc = vi.fn()
  const createRefund = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.getStripe.mockReturnValue({ refunds: { create: createRefund } })
  })

  it('claims one exact job, begins by CAS, calls the connected account and completes atomically', async () => {
    rpc
      .mockResolvedValueOnce({ data: [job], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    createRefund.mockResolvedValue({ id: 're_safe_1' })

    await expect(dispatchPaymentRefundJobById(jobId)).resolves.toMatchObject({ completed: 1 })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_payment_refund_job_by_id',
      'begin_payment_refund_delivery',
      'complete_payment_refund_job',
    ])
    expect(createRefund).toHaveBeenCalledWith(
      { payment_intent: 'pi_safe_1' },
      {
        stripeAccount: 'acct_safe_1',
        idempotencyKey: 'refund_523e4567-e89b-42d3-a456-426614174000',
      },
    )
    expect(rpc).toHaveBeenLastCalledWith('complete_payment_refund_job', {
      p_id: jobId,
      p_lease_token: leaseToken,
      p_provider_ref: 're_safe_1',
    })
  })

  it('never calls Stripe when begin CAS is stale', async () => {
    rpc
      .mockResolvedValueOnce({ data: [job], error: null })
      .mockResolvedValueOnce({ data: false, error: null })

    await expect(dispatchPaymentRefundJobById(jobId)).resolves.toMatchObject({ stale: 1 })
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('marks unknown timeout and 5xx outcomes for review without automatic retry', async () => {
    for (const error of [
      Object.assign(new Error('contains customer data'), { type: 'StripeConnectionError' }),
      Object.assign(new Error('upstream failed'), { statusCode: 503 }),
    ]) {
      rpc.mockReset()
      createRefund.mockReset()
      rpc
        .mockResolvedValueOnce({ data: [job], error: null })
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: true, error: null })
      createRefund.mockRejectedValueOnce(error)

      await expect(dispatchPaymentRefundJobById(jobId)).resolves.toMatchObject({ reviewRequired: 1 })
      expect(rpc).toHaveBeenLastCalledWith('review_payment_refund_job', {
        p_id: jobId,
        p_lease_token: leaseToken,
        p_reason: 'provider_outcome_unknown',
      })
      expect(rpc.mock.calls.some(([name]) => name === 'retry_payment_refund_job')).toBe(false)
      expect(JSON.stringify(rpc.mock.calls)).not.toContain('customer data')
    }
  })

  it('retries only before provider start when local Stripe configuration is unavailable', async () => {
    mocks.getStripe.mockReturnValue(null)
    rpc
      .mockResolvedValueOnce({ data: [job], error: null })
      .mockResolvedValueOnce({ data: 'queued', error: null })

    await expect(dispatchPaymentRefundJobById(jobId)).resolves.toMatchObject({ retried: 1 })
    expect(rpc).toHaveBeenLastCalledWith('retry_payment_refund_job', {
      p_id: jobId,
      p_lease_token: leaseToken,
      p_reason: 'provider_unavailable_before_request',
      p_retry_at: expect.any(String),
    })
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('moves a claimed row with missing connected-account data to review instead of stranding it', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ ...job, connected_account_id: null }], error: null })
      .mockResolvedValueOnce({ data: true, error: null })

    await expect(dispatchPaymentRefundJobById(jobId)).resolves.toMatchObject({ reviewRequired: 1 })
    expect(rpc).toHaveBeenLastCalledWith('review_payment_refund_job', {
      p_id: jobId,
      p_lease_token: leaseToken,
      p_reason: 'refund_data_invalid',
    })
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('isolates one failed job while processing a bounded batch', async () => {
    const second = { ...job, id: '623e4567-e89b-42d3-a456-426614174000' }
    rpc
      .mockResolvedValueOnce({ data: [job, second], error: null })
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    createRefund.mockResolvedValue({ id: 're_second' })

    await expect(dispatchPaymentRefundJobs(2)).resolves.toMatchObject({ claimed: 2, failed: 1, completed: 1 })
  })
})
