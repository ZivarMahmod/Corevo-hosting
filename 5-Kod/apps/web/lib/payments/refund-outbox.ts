import 'server-only'

import { createServiceClient } from '@/lib/platform/service'
import { getStripe } from '@/lib/stripe/client'

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const PROVIDER_ID = /^(?:pi|acct)_[A-Za-z0-9_]{1,196}$/
const IDEMPOTENCY_KEY = /^refund_[0-9a-f-]{36}$/

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

type ClaimedRefund = {
  id: string
  tenantId: string
  paymentId: string
  bookingId: string
  paymentIntentId: string
  connectedAccountId: string
  idempotencyKey: string
  attemptCount: number
  leaseToken: string
}

export type RefundDispatchRun = {
  claimed: number
  completed: number
  retried: number
  reviewRequired: number
  stale: number
  failed: number
}

export type PaymentRefundHealth = {
  queued: number
  attempting: number
  providerStarted: number
  reviewRequired: number
  stuckProviderStarted: number
  overduePending: number
}

function emptyRun(): RefundDispatchRun {
  return { claimed: 0, completed: 0, retried: 0, reviewRequired: 0, stale: 0, failed: 0 }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseClaim(value: unknown): ClaimedRefund | null {
  if (!record(value)) return null
  const fields = [value.id, value.tenant_id, value.payment_id, value.booking_id, value.lease_token]
  if (!fields.every((field) => typeof field === 'string' && UUID.test(field))) return null
  if (
    typeof value.payment_intent_id !== 'string' || !PROVIDER_ID.test(value.payment_intent_id)
    || typeof value.connected_account_id !== 'string' || !PROVIDER_ID.test(value.connected_account_id)
    || typeof value.provider_idempotency_key !== 'string'
    || !IDEMPOTENCY_KEY.test(value.provider_idempotency_key)
    || typeof value.attempt_count !== 'number'
    || !Number.isSafeInteger(value.attempt_count)
    || value.attempt_count < 1
  ) return null
  return {
    id: value.id as string,
    tenantId: value.tenant_id as string,
    paymentId: value.payment_id as string,
    bookingId: value.booking_id as string,
    paymentIntentId: value.payment_intent_id,
    connectedAccountId: value.connected_account_id,
    idempotencyKey: value.provider_idempotency_key,
    attemptCount: value.attempt_count,
    leaseToken: value.lease_token as string,
  }
}

function claimIdentity(value: unknown): { id: string; leaseToken: string } | null {
  if (!record(value) || typeof value.id !== 'string' || !UUID.test(value.id)
    || typeof value.lease_token !== 'string' || !UUID.test(value.lease_token)) return null
  return { id: value.id, leaseToken: value.lease_token }
}

function retryAt(attempt: number): string {
  const delayMs = Math.min(30 * 60_000, 30_000 * 2 ** Math.min(6, Math.max(0, attempt - 1)))
  return new Date(Date.now() + delayMs).toISOString()
}

async function markReview(client: RpcClient, job: ClaimedRefund, reason: string): Promise<boolean> {
  const result = await client.rpc('review_payment_refund_job', {
    p_id: job.id,
    p_lease_token: job.leaseToken,
    p_reason: reason,
  })
  return !result.error && result.data === true
}

async function processClaim(client: RpcClient, job: ClaimedRefund): Promise<keyof RefundDispatchRun> {
  const stripe = getStripe()
  if (!stripe) {
    const retry = await client.rpc('retry_payment_refund_job', {
      p_id: job.id,
      p_lease_token: job.leaseToken,
      p_reason: 'provider_unavailable_before_request',
      p_retry_at: retryAt(job.attemptCount),
    })
    return !retry.error && retry.data === 'queued' ? 'retried'
      : !retry.error && retry.data === 'review_required' ? 'reviewRequired'
        : 'stale'
  }

  const begun = await client.rpc('begin_payment_refund_delivery', {
    p_id: job.id,
    p_lease_token: job.leaseToken,
  })
  if (begun.error || begun.data !== true) return 'stale'

  let providerRef: string
  try {
    const refund = await stripe.refunds.create(
      { payment_intent: job.paymentIntentId },
      { stripeAccount: job.connectedAccountId, idempotencyKey: job.idempotencyKey },
    )
    providerRef = refund.id
  } catch (error) {
    const status = record(error) && typeof error.statusCode === 'number' ? error.statusCode : null
    const type = record(error) && typeof error.type === 'string' ? error.type : null
    const unknown = status === null || status >= 500 || type === 'StripeConnectionError'
    return await markReview(client, job, unknown ? 'provider_outcome_unknown' : 'provider_rejected')
      ? 'reviewRequired'
      : 'failed'
  }

  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(providerRef)) {
    return await markReview(client, job, 'provider_outcome_unknown') ? 'reviewRequired' : 'failed'
  }
  const completed = await client.rpc('complete_payment_refund_job', {
    p_id: job.id,
    p_lease_token: job.leaseToken,
    p_provider_ref: providerRef,
  })
  return !completed.error && completed.data === true ? 'completed' : 'failed'
}

async function dispatch(options: { id?: string; limit?: number }): Promise<RefundDispatchRun> {
  const client = createServiceClient() as unknown as RpcClient | null
  if (!client) throw new Error('refund_outbox_service_role_unavailable')
  const leaseToken = crypto.randomUUID()
  const now = new Date().toISOString()
  const claim = options.id
    ? await client.rpc('claim_payment_refund_job_by_id', {
        p_id: options.id,
        p_lease_token: leaseToken,
        p_now: now,
        p_lease_seconds: 120,
      })
    : await client.rpc('claim_payment_refund_jobs', {
        p_lease_token: leaseToken,
        p_now: now,
        p_lease_seconds: 120,
        p_limit: Math.max(1, Math.min(options.limit ?? 5, 20)),
      })
  if (claim.error) throw new Error('refund_outbox_claim_failed')

  const raw = Array.isArray(claim.data) ? claim.data : []
  const run = emptyRun()
  run.claimed = raw.length
  for (const value of raw) {
    const job = parseClaim(value)
    if (!job) {
      const identity = claimIdentity(value)
      if (!identity) {
        run.failed += 1
        continue
      }
      const reviewed = await client.rpc('review_payment_refund_job', {
        p_id: identity.id,
        p_lease_token: identity.leaseToken,
        p_reason: 'refund_data_invalid',
      })
      if (!reviewed.error && reviewed.data === true) run.reviewRequired += 1
      else run.stale += 1
      continue
    }
    try {
      run[await processClaim(client, job)] += 1
    } catch {
      run.failed += 1
    }
  }
  return run
}

export function dispatchPaymentRefundJobById(id: string): Promise<RefundDispatchRun> {
  if (!UUID.test(id)) throw new Error('refund_job_id_invalid')
  return dispatch({ id })
}

export function dispatchPaymentRefundJobs(limit = 5): Promise<RefundDispatchRun> {
  return dispatch({ limit })
}

export async function readPaymentRefundHealth(): Promise<PaymentRefundHealth> {
  const client = createServiceClient() as unknown as RpcClient | null
  if (!client) throw new Error('refund_outbox_service_role_unavailable')
  const result = await client.rpc('payment_refund_health', {})
  if (result.error || !record(result.data)) throw new Error('refund_outbox_health_failed')
  const data = result.data
  const keys = [
    'queued', 'attempting', 'providerStarted', 'reviewRequired',
    'stuckProviderStarted', 'overduePending',
  ] as const
  if (!keys.every((key) => typeof data[key] === 'number'
    && Number.isSafeInteger(data[key]) && data[key] >= 0)) {
    throw new Error('refund_outbox_health_invalid')
  }
  return Object.fromEntries(keys.map((key) => [key, data[key]])) as PaymentRefundHealth
}
