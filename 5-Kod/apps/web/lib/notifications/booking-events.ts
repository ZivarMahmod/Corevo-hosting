import 'server-only'
import type { Json } from '@corevo/db'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'
import { isSafeCustomerClaimOrigin } from '@/lib/kund/customer-claim'

export type BookingNotificationEventType =
  | 'booking_request_received'
  | 'booking_confirmation'
  | 'booking_cancelled'
  | 'booking_rebooked'
  | 'booking_reminder'
  | 'booking_completed'

export type BookingNotificationSkipReason =
  | 'actor_opted_out'
  | 'tenant_disabled'
  | 'booking_outcome_changed'
  | 'no_channel'
  | 'no_consent'
  | 'type_opt_out'
  | 'customer_missing'

export type BookingNotificationEvent = {
  tenantId: string
  bookingId: string
  type: BookingNotificationEventType
  /** Stable timestamp from the business mutation, never a send timestamp. */
  occurredAt: string
  /** Required for reminder/rebook event-key snapshots. */
  startISO?: string
  staffId?: string | null
  allow?: boolean
  skipReason?: BookingNotificationSkipReason
  /** U9's transaction-created status=routing row. */
  outboxId?: string | null
  /** Tokens are minted only inside a future delivery adapter and never persisted. */
  includeManageLink?: boolean
  includeAccountClaim?: boolean
  origin?: string | null
}

export type BookingNotificationQueueResult =
  | { state: 'queued'; channel: 'push' | 'email' | 'sms'; inserted: boolean }
  | { state: 'skipped'; reason: string; inserted: boolean }
  | { state: 'error'; reason: 'service_role_unavailable' | 'enqueue_failed' | 'invalid_result' }

type EventPolicy = {
  suffix: string
  category: 'transactional' | 'marketing'
  expectedStatuses: string[]
  typeOptIn: 'reminders' | 'recommendations' | null
}

const EVENT_POLICY: Record<BookingNotificationEventType, EventPolicy> = {
  booking_request_received: {
    suffix: 'request-received',
    category: 'transactional',
    expectedStatuses: ['pending'],
    typeOptIn: null,
  },
  booking_confirmation: {
    suffix: 'confirmation',
    category: 'transactional',
    expectedStatuses: ['confirmed'],
    typeOptIn: null,
  },
  booking_cancelled: {
    suffix: 'cancelled',
    category: 'transactional',
    expectedStatuses: ['cancelled'],
    typeOptIn: null,
  },
  booking_rebooked: {
    suffix: 'rebook',
    category: 'transactional',
    expectedStatuses: ['pending', 'confirmed'],
    typeOptIn: null,
  },
  booking_reminder: {
    suffix: 'reminder',
    category: 'transactional',
    expectedStatuses: ['pending', 'confirmed'],
    typeOptIn: 'reminders',
  },
  booking_completed: {
    suffix: 'completed',
    category: 'marketing',
    expectedStatuses: ['completed'],
    typeOptIn: 'recommendations',
  },
}

export function bookingEventKey(event: BookingNotificationEvent): string {
  const policy = EVENT_POLICY[event.type]
  if (event.type === 'booking_rebooked' || event.type === 'booking_reminder') {
    return `booking:${event.bookingId}:${policy.suffix}:${event.startISO ?? 'unknown'}`
  }
  return `booking:${event.bookingId}:${policy.suffix}`
}

function isChannel(value: unknown): value is 'push' | 'email' | 'sms' {
  return value === 'push' || value === 'email' || value === 'sms'
}

async function canonicalTenantOrigin(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  proposedOrigin: string | null,
): Promise<string> {
  const [{ data: tenant, error: tenantError }, { data: domains, error: domainsError }] =
    await Promise.all([
      admin.from('tenants').select('slug').eq('id', tenantId).eq('status', 'active').maybeSingle(),
      admin.from('tenant_domains').select('domain').eq('tenant_id', tenantId).eq('verified', true),
    ])
  if (tenantError || domainsError || !tenant?.slug) throw new Error('tenant_origin_unavailable')

  const suffix = process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? 'boka.corevo.se'
  const verifiedDomains = (domains ?? [])
    .map(({ domain }) => domain.trim().toLowerCase())
    .filter(Boolean)
    .sort()
  const allowedHosts = new Set([
    `${tenant.slug}.corevo.se`,
    `${tenant.slug}.${suffix}`,
    ...verifiedDomains,
  ])
  if (
    proposedOrigin
    && isSafeCustomerClaimOrigin(proposedOrigin, allowedHosts, process.env.NODE_ENV !== 'production')
  ) {
    return new URL(proposedOrigin).origin
  }
  return `https://${verifiedDomains[0] ?? `${tenant.slug}.${suffix}`}`
}

/**
 * The only producer API for booking-related customer notifications.
 * It records/routs a durable event after the business mutation. A queue failure
 * is returned separately and can never roll back or disguise the booking result.
 */
export async function queueBookingEvent(
  event: BookingNotificationEvent,
): Promise<BookingNotificationQueueResult> {
  let admin: ReturnType<typeof createServiceClient>
  try {
    admin = createServiceClient()
  } catch {
    return { state: 'error', reason: 'service_role_unavailable' }
  }
  if (!admin) return { state: 'error', reason: 'service_role_unavailable' }

  const policy = EVENT_POLICY[event.type]
  let data: unknown
  let error: { message?: string } | null
  try {
    const needsOrigin = event.includeManageLink || event.includeAccountClaim
    const origin = needsOrigin
      ? await canonicalTenantOrigin(admin, event.tenantId, event.origin ?? null)
      : null

    // No bearer token is allowed here. The delivery adapter receives only intent
    // flags and a tenant-verified origin, then mints links immediately pre-transport.
    const payload: Json = {
      template: event.type,
      booking_id: event.bookingId,
      occurred_at: event.occurredAt,
      ...(event.startISO ? { start_iso: event.startISO } : {}),
      ...(origin ? { origin } : {}),
      include_manage_link: event.includeManageLink === true,
      include_account_claim: event.includeAccountClaim === true,
    }

    const result = await admin.rpc('route_booking_notification', {
      p_tenant: event.tenantId,
      p_booking: event.bookingId,
      p_staff: event.staffId ?? null,
      p_event_type: event.type,
      p_event_key: bookingEventKey(event),
      p_category: policy.category,
      p_type_opt_in: policy.typeOptIn,
      p_expected_statuses: policy.expectedStatuses,
      p_payload: payload,
      p_allow: event.allow !== false,
      p_skip_reason: event.allow === false
        ? event.skipReason ?? 'actor_opted_out'
        : null,
      p_outbox_id: event.outboxId ?? null,
    })
    data = result.data
    error = result.error
  } catch {
    logger.warn('booking_notification.enqueue_failed', {
      event: event.type,
      bookingId: event.bookingId,
      error: 'enqueue_failed',
    })
    return { state: 'error', reason: 'enqueue_failed' }
  }

  if (error) {
    logger.warn('booking_notification.enqueue_failed', {
      event: event.type,
      bookingId: event.bookingId,
      error: 'enqueue_failed',
    })
    return { state: 'error', reason: 'enqueue_failed' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return { state: 'error', reason: 'invalid_result' }
  const value = row as Record<string, unknown>
  if (value.status === 'queued' && isChannel(value.chosen_channel)) {
    return {
      state: 'queued',
      channel: value.chosen_channel,
      inserted: value.inserted === true,
    }
  }
  if (value.status === 'skipped' && typeof value.skip_reason === 'string') {
    return {
      state: 'skipped',
      reason: value.skip_reason,
      inserted: value.inserted === true,
    }
  }
  // An idempotent retry can observe a row already claimed or terminally sent.
  // That is still an accepted durable event, never a fresh send.
  if (
    ['attempting', 'delivery_started', 'sent', 'delivered', 'simulated'].includes(
      String(value.status),
    ) && isChannel(value.chosen_channel)
  ) {
    return { state: 'queued', channel: value.chosen_channel, inserted: false }
  }
  return { state: 'error', reason: 'invalid_result' }
}

export function notificationQueueMessage(result: BookingNotificationQueueResult): string {
  if (result.state === 'queued') return 'Meddelandet är köat via vald tillgänglig kanal.'
  if (result.state === 'skipped') {
    if (result.reason === 'actor_opted_out') return 'Inget meddelande valdes.'
    if (result.reason === 'no_channel' || result.reason === 'customer_missing') {
      return 'Inget meddelande kunde köas eftersom kunden saknar en tillgänglig kontaktkanal.'
    }
    if (result.reason === 'tenant_disabled' || result.reason === 'type_opt_out') {
      return 'Inget meddelande köades eftersom den här notisen är avstängd.'
    }
    if (result.reason === 'no_consent') return 'Inget meddelande köades utan kundens samtycke.'
    return 'Inget meddelande köades.'
  }
  return 'Bokningen är sparad, men meddelandet kunde inte köas. Försök igen eller kontakta kunden manuellt.'
}
