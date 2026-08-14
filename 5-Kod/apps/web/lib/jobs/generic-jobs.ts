import 'server-only'

import { z } from 'zod'
import { createServiceClient } from '@/lib/platform/service'

const MAX_ATTEMPTS = 8

const stripeBillingReconcileSchema = z
  .object({
    v: z.literal(1),
    type: z.literal('stripe.billing.reconcile'),
    eventId: z.string().trim().min(1).max(255),
    objectId: z.string().trim().min(1).max(255),
  })
  .strict()

export type StripeBillingReconcileJob = z.infer<typeof stripeBillingReconcileSchema>
export type GenericJobHandlers = {
  'stripe.billing.reconcile'?: (job: StripeBillingReconcileJob) => Promise<void>
}

type QueueRow = {
  msg_id: number
  read_ct: number
  message: unknown
}

type RpcResult = { data: unknown; error: unknown }
type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>
}

export type GenericJobDispatchResult = {
  claimed: number
  completed: number
  retried: number
  reviewRequired: number
}

type RejectionReason = 'invalid_payload' | 'unknown_version' | 'unknown_type'

function classifyJob(
  value: unknown,
): { success: true; job: StripeBillingReconcileJob } | { success: false; reason: RejectionReason } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, reason: 'invalid_payload' }
  }
  const candidate = value as Record<string, unknown>
  if (candidate.v !== 1) return { success: false, reason: 'unknown_version' }
  if (candidate.type !== 'stripe.billing.reconcile') {
    return { success: false, reason: 'unknown_type' }
  }
  const parsed = stripeBillingReconcileSchema.safeParse(value)
  return parsed.success
    ? { success: true, job: parsed.data }
    : { success: false, reason: 'invalid_payload' }
}

function queueRows(value: unknown): QueueRow[] {
  if (!Array.isArray(value)) throw new Error('generic_jobs_read_invalid')
  return value.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('generic_jobs_read_invalid')
    const candidate = row as Record<string, unknown>
    if (
      !Number.isSafeInteger(candidate.msg_id) ||
      Number(candidate.msg_id) <= 0 ||
      !Number.isSafeInteger(candidate.read_ct) ||
      Number(candidate.read_ct) <= 0
    ) {
      throw new Error('generic_jobs_read_invalid')
    }
    return {
      msg_id: Number(candidate.msg_id),
      read_ct: Number(candidate.read_ct),
      message: candidate.message,
    }
  })
}

async function rpc(client: RpcClient, name: string, args?: Record<string, unknown>) {
  const result = await client.rpc(name, args)
  if (result.error) throw new Error(`generic_jobs_${name}_failed`)
  return result.data
}

async function failForReview(
  client: RpcClient,
  msgId: number,
  reason: RejectionReason | 'max_attempts',
) {
  const archived = await rpc(client, 'fail_corevo_job_for_review', {
    p_msg_id: msgId,
    p_reason: reason,
  })
  if (archived !== true) throw new Error('generic_jobs_review_archive_failed')
}

export async function dispatchGenericJobs(
  handlers: GenericJobHandlers,
): Promise<GenericJobDispatchResult> {
  const client = createServiceClient() as unknown as RpcClient | null
  if (!client) throw new Error('generic_jobs_service_unavailable')

  const rows = queueRows((await rpc(client, 'read_corevo_jobs')) ?? [])
  const result: GenericJobDispatchResult = {
    claimed: rows.length,
    completed: 0,
    retried: 0,
    reviewRequired: 0,
  }

  for (const row of rows) {
    const parsed = classifyJob(row.message)
    if (!parsed.success) {
      await failForReview(client, row.msg_id, parsed.reason)
      result.reviewRequired += 1
      continue
    }

    const handler = handlers[parsed.job.type]
    try {
      if (!handler) throw new Error('generic_jobs_handler_unavailable')
      await handler(parsed.job)
    } catch {
      if (row.read_ct >= MAX_ATTEMPTS) {
        await failForReview(client, row.msg_id, 'max_attempts')
        result.reviewRequired += 1
      } else {
        result.retried += 1
      }
      continue
    }

    const archived = await rpc(client, 'archive_corevo_job', { p_msg_id: row.msg_id })
    if (archived !== true) throw new Error('generic_jobs_archive_failed')
    result.completed += 1
  }

  return result
}
