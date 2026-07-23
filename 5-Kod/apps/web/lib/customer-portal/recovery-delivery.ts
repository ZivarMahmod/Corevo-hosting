import 'server-only'

import { bookingContactDigest, generateBookingPin, normalizeBookingContact } from '@/lib/booking/verification'
import { sendEmail } from '@/lib/notifications/email'
import { sendGiadaMessage } from '@/lib/notifications/giada'
import {
  dispatchNotificationOutboxById,
  type ClaimedNotificationOutboxRow,
  type NotificationDeliveryResult,
  type OutboxDispatchRun,
} from '@/lib/notifications/outbox'
import { createServiceClient } from '@/lib/platform/service'
import { portalRecoveryCodeDigest, portalRecoveryContactDigest } from './crypto'

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const DIGEST_PATTERN = /^[a-f0-9]{64}$/

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

type RecoveryTarget = {
  challengePublicId: string
  channel: 'sms' | 'email'
  destination: string | null
  contactDigest: string
  bookingContactDigest: string | null
  tenantName: string
  expiresAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function parseTarget(data: unknown, row: ClaimedNotificationOutboxRow): RecoveryTarget | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return null
  const target = data[0]
  if (
    target.outcome !== 'target'
    || typeof target.challenge_public_id !== 'string'
    || !UUID_PATTERN.test(target.challenge_public_id)
    || (target.channel !== 'sms' && target.channel !== 'email')
    || target.channel !== row.chosen_channel
    || (target.delivery_destination !== null && typeof target.delivery_destination !== 'string')
    || typeof target.contact_digest !== 'string'
    || !DIGEST_PATTERN.test(target.contact_digest)
    || (target.booking_contact_digest !== null && (
      typeof target.booking_contact_digest !== 'string'
      || !DIGEST_PATTERN.test(target.booking_contact_digest)
    ))
    || typeof target.tenant_name !== 'string'
    || target.tenant_name.length < 1
    || target.tenant_name.length > 200
    || typeof target.expires_at !== 'string'
    || !Number.isFinite(Date.parse(target.expires_at))
  ) return null

  return {
    challengePublicId: target.challenge_public_id,
    channel: target.channel,
    destination: target.delivery_destination,
    contactDigest: target.contact_digest,
    bookingContactDigest: target.booking_contact_digest,
    tenantName: target.tenant_name,
    expiresAt: target.expires_at,
  }
}

async function recordDelivery(
  client: RpcClient,
  row: ClaimedNotificationOutboxRow,
  delivered: boolean,
): Promise<boolean> {
  const result = await client.rpc('customer_portal_record_recovery_outbox_delivery', {
    p_outbox_id: row.id,
    p_lease_token: row.lease_token,
    p_delivered: delivered,
  })
  return !result.error && result.data === 'ok'
}

function recoveryChallengeId(row: ClaimedNotificationOutboxRow): string | null {
  if (row.event_type !== 'customer_portal_recovery_code' || !isRecord(row.payload)) return null
  const keys = Object.keys(row.payload).sort()
  return keys.length === 2
    && keys[0] === 'challenge_id'
    && keys[1] === 'template'
    && row.payload.template === 'customer_portal_recovery_code'
    && typeof row.payload.challenge_id === 'string'
    && UUID_PATTERN.test(row.payload.challenge_id)
    ? row.payload.challenge_id
    : null
}

export async function deliverPortalRecoveryOutbox(
  row: ClaimedNotificationOutboxRow,
): Promise<NotificationDeliveryResult> {
  const client = createServiceClient() as unknown as RpcClient | null
  if (!client) return { status: 'retry', error: 'provider_unavailable' }
  const challengeId = recoveryChallengeId(row)
  if (!challengeId) return { status: 'failed', reason: 'payload_invalid' }

  const targetResult = await client.rpc('customer_portal_recovery_delivery_target', {
    p_outbox_id: row.id,
    p_lease_token: row.lease_token,
  })
  if (targetResult.error) return { status: 'retry', error: 'provider_unavailable' }
  const target = parseTarget(targetResult.data, row)
  if (!target || target.challengePublicId !== challengeId) {
    await recordDelivery(client, row, false)
    return { status: 'failed', reason: 'payload_invalid' }
  }

  const code = generateBookingPin(6)
  const normalized = target.destination === null
    ? null
    : normalizeBookingContact(target.channel, target.destination)
  if (target.destination !== null && !normalized) {
    await recordDelivery(client, row, false)
    return { status: 'failed', reason: 'payload_invalid' }
  }
  const currentContactDigest = normalized === null
    ? null
    : await portalRecoveryContactDigest(target.channel, normalized)
  const currentBookingContactDigest = normalized === null
    ? null
    : await bookingContactDigest(target.channel, normalized)
  const prepared = await client.rpc('customer_portal_prepare_recovery_delivery', {
    p_outbox_id: row.id,
    p_lease_token: row.lease_token,
    p_current_destination: normalized,
    p_current_contact_digest: currentContactDigest,
    p_current_booking_contact_digest: currentBookingContactDigest,
    p_code_digest: await portalRecoveryCodeDigest(target.challengePublicId, code),
  })
  if (prepared.error) return { status: 'retry', error: 'provider_unavailable' }
  if (prepared.data === 'decoy') {
    if (!await recordDelivery(client, row, false)) return { status: 'failed', reason: 'delivery_uncertain' }
    return { status: 'skipped', reason: 'no_recipient' }
  }
  if (prepared.data !== 'ready' || !normalized) {
    await recordDelivery(client, row, false)
    return { status: 'failed', reason: 'payload_invalid' }
  }

  if (target.channel === 'sms') {
    const sent = await sendGiadaMessage({
      to: normalized,
      message: `${target.tenantName.trim() || 'Corevo'}: Din kod för att komma åt dina bokningar är ${code}. Koden gäller i 5 minuter.`,
      idempotencyKey: `portal-recovery:${row.id}`,
      expiresAt: target.expiresAt,
    })
    if (!sent.ok) {
      if (sent.reason === 'disabled' || sent.reason === 'offline') {
        return { status: 'retry', error: 'provider_unavailable' }
      }
      await recordDelivery(client, row, false)
      return sent.reason === 'transport_error'
        ? { status: 'failed', reason: 'delivery_uncertain' }
        : { status: 'failed', reason: 'provider_rejected' }
    }
    if (!await recordDelivery(client, row, true)) return { status: 'failed', reason: 'delivery_uncertain' }
    return { status: 'sent', providerRef: `giada:${sent.id}` }
  }

  const sent = await sendEmail({
    to: normalized,
    subject: `Din kod för Mina bokningar hos ${target.tenantName}`,
    html: `<p>Din kod för att komma åt dina bokningar hos ${escapeHtml(target.tenantName)} är:</p>`
      + `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>`
      + '<p>Koden gäller i 5 minuter.</p>',
  })
  if (!sent.ok) {
    if (sent.skipped) return { status: 'retry', error: 'provider_unavailable' }
    await recordDelivery(client, row, false)
    return { status: 'failed', reason: 'delivery_uncertain' }
  }
  if (!await recordDelivery(client, row, true)) return { status: 'failed', reason: 'delivery_uncertain' }
  return { status: 'sent', providerRef: sent.id ? `email:${sent.id}` : undefined }
}

export function dispatchPortalRecoveryOutboxById(outboxId: string): Promise<OutboxDispatchRun> {
  return dispatchNotificationOutboxById(outboxId, deliverPortalRecoveryOutbox)
}

function emptyRun(): OutboxDispatchRun {
  return { claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0 }
}

export async function dispatchPortalRecoveryOutbox(limit = 50): Promise<OutboxDispatchRun> {
  const client = createServiceClient() as unknown as RpcClient | null
  if (!client) throw new Error('recovery_outbox_service_role_unavailable')
  const { data, error } = await client.rpc('customer_portal_recovery_outbox_candidates', {
    p_now: new Date().toISOString(),
    p_limit: Math.max(1, Math.min(limit, 50)),
  })
  if (error) throw new Error('recovery_outbox_select_failed')

  const total = emptyRun()
  for (const item of Array.isArray(data) ? data : []) {
    if (!isRecord(item) || typeof item.id !== 'string' || !UUID_PATTERN.test(item.id)) {
      total.stale += 1
      continue
    }
    const run = await dispatchPortalRecoveryOutboxById(item.id)
    for (const key of Object.keys(total) as Array<keyof OutboxDispatchRun>) total[key] += run[key]
  }
  return total
}
