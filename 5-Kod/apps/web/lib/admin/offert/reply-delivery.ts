import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendOffertReplyEmail } from '@/lib/notifications/offert'
import type {
  ClaimedNotificationOutboxRow,
  NotificationDeliveryResult,
} from '@/lib/notifications/outbox'
import { createServiceClient } from '@/lib/platform/service'

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

type RpcClient = SupabaseClient<Database> & {
  rpc: (
    name: 'offert_reply_delivery_target',
    args: { p_outbox: string; p_lease_token: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

type DeliveryTarget = {
  tenantId: string
  tenantName: string
  customerEmail: string
  customerName: string | null
  subject: string | null
  replyMessage: string
  estimateCents: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requestId(row: ClaimedNotificationOutboxRow): string | null {
  if (
    row.event_type !== 'offert_reply'
    || row.chosen_channel !== 'email'
    || !isRecord(row.payload)
  ) return null
  const keys = Object.keys(row.payload)
  return keys.length === 1
    && keys[0] === 'offert_request_id'
    && typeof row.payload.offert_request_id === 'string'
    && UUID_PATTERN.test(row.payload.offert_request_id)
    ? row.payload.offert_request_id
    : null
}

function parseTarget(value: unknown, tenantId: string): DeliveryTarget | null {
  const row = Array.isArray(value) && value.length === 1 && isRecord(value[0])
    ? value[0]
    : null
  if (
    !row
    || row.outcome !== 'target'
    || row.tenant_id !== tenantId
    || typeof row.tenant_name !== 'string'
    || row.tenant_name.length < 1
    || row.tenant_name.length > 200
    || typeof row.customer_email !== 'string'
    || row.customer_email.length < 3
    || row.customer_email.length > 320
    || (row.customer_name !== null && typeof row.customer_name !== 'string')
    || (row.subject !== null && typeof row.subject !== 'string')
    || typeof row.reply_message !== 'string'
    || row.reply_message.length < 1
    || row.reply_message.length > 6000
    || (
      row.estimate_cents !== null
      && (
        typeof row.estimate_cents !== 'number'
        || !Number.isSafeInteger(row.estimate_cents)
        || row.estimate_cents < 0
      )
    )
  ) return null

  return {
    tenantId,
    tenantName: row.tenant_name,
    customerEmail: row.customer_email,
    customerName: row.customer_name as string | null,
    subject: row.subject as string | null,
    replyMessage: row.reply_message,
    estimateCents: row.estimate_cents as number | null,
  }
}

export async function deliverImmediateOffertOutbox(
  row: ClaimedNotificationOutboxRow,
): Promise<NotificationDeliveryResult> {
  if (!requestId(row)) return { status: 'failed', reason: 'payload_invalid' }

  const client = createServiceClient() as RpcClient | null
  if (!client) return { status: 'retry', error: 'provider_unavailable' }

  const targetResult = await client.rpc('offert_reply_delivery_target', {
    p_outbox: row.id,
    p_lease_token: row.lease_token,
  })
  if (targetResult.error) return { status: 'retry', error: 'provider_unavailable' }
  const target = parseTarget(targetResult.data, row.tenant_id)
  if (!target) return { status: 'failed', reason: 'payload_invalid' }

  try {
    const sent = await sendOffertReplyEmail({
      supabase: client,
      tenantId: target.tenantId,
      tenantName: target.tenantName,
      to: target.customerEmail,
      customerName: target.customerName,
      subject: target.subject,
      replyMessage: target.replyMessage,
      estimateCents: target.estimateCents,
    })
    if (sent.ok) {
      return {
        status: 'sent',
        ...(sent.id ? { providerRef: `email:${sent.id}` } : {}),
      }
    }
    if (sent.skipped) return { status: 'skipped', reason: 'transport_off' }
    if (sent.error === 'invalid_recipient') {
      return { status: 'failed', reason: 'payload_invalid' }
    }
    if (sent.error === 'http_429') {
      return { status: 'retry', error: 'provider_rate_limited' }
    }
    return { status: 'failed', reason: 'delivery_uncertain' }
  } catch {
    return { status: 'failed', reason: 'delivery_uncertain' }
  }
}
