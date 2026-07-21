import 'server-only'

import { prepareBookingDelivery } from './booking-delivery'
import { sendEmail } from './email'
import { sendGiadaMessage } from './giada'
import type {
  ClaimedNotificationOutboxRow,
  NotificationDeliveryResult,
} from './outbox'

/**
 * Direct adapter for the one verified booking event returned by finalize.
 * SMS remains idempotent through `outbox:<uuid>` all the way into Giada.
 */
export async function deliverImmediateBookingOutbox(
  row: ClaimedNotificationOutboxRow,
): Promise<NotificationDeliveryResult> {
  const prepared = await prepareBookingDelivery(row)
  if (!prepared.ok) {
    if (prepared.reason === 'no_recipient') return { status: 'skipped', reason: 'no_recipient' }
    if (prepared.reason === 'consent_denied') return { status: 'skipped', reason: 'consent_denied' }
    if (prepared.reason === 'gdpr_erased') return { status: 'skipped', reason: 'gdpr_erased' }
    if (prepared.reason === 'link_unavailable') return { status: 'retry', error: 'provider_unavailable' }
    return { status: 'failed', reason: 'payload_invalid' }
  }

  if (prepared.channel === 'sms') {
    const result = await sendGiadaMessage({
      to: prepared.to,
      message: prepared.body,
      idempotencyKey: `outbox:${row.id}`,
    })
    if (result.ok) return { status: 'sent', providerRef: `giada:${result.id}` }
    if (result.reason === 'rejected') return { status: 'failed', reason: 'provider_rejected' }
    if (result.reason === 'disabled') return { status: 'skipped', reason: 'transport_off' }
    // A response loss is safe to retry because Giada persists the same
    // idempotency key before modem delivery and returns the existing row.
    return { status: 'retry', error: 'provider_unavailable' }
  }

  if (prepared.channel !== 'email') return { status: 'failed', reason: 'payload_invalid' }
  const result = await sendEmail({
    to: prepared.to,
    subject: prepared.subject,
    html: prepared.html,
    from: prepared.from,
    replyTo: prepared.replyTo,
  })
  if (result.ok) {
    return {
      status: 'sent',
      ...(result.id ? { providerRef: `email:${result.id}` } : {}),
    }
  }
  if (result.skipped) return { status: 'skipped', reason: 'transport_off' }
  if (result.error === 'invalid_recipient') return { status: 'failed', reason: 'payload_invalid' }
  if (result.error === 'http_429') return { status: 'retry', error: 'provider_rate_limited' }
  // The current e-mail relay has no end-to-end idempotency key. A timeout or
  // 5xx may follow provider acceptance, so terminalize for manual reconciliation
  // rather than risk sending the customer's confirmation twice.
  return { status: 'failed', reason: 'delivery_uncertain' }
}
