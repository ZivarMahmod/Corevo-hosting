import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { createCustomerClaimLink } from '@/lib/kund/customer-claim-server'
import { isSafeCustomerClaimOrigin } from '@/lib/kund/customer-claim'
import { buildCancelToken, buildManageUrl } from '@/lib/booking/cancel-token'
import { getCancellationCutoffHours } from '@/lib/kund/settings'
import { loadEmailBrand } from './brand'
import {
  bookingRequestReceivedEmail,
  cancellationEmail,
  confirmationEmail,
  reminderEmail,
  rebookEmail,
  shell,
  type BookingEmailData,
} from './templates'
import type { ClaimedNotificationOutboxRow } from './outbox'

type PreparedEmail = {
  ok: true
  channel: 'email'
  to: string
  subject: string
  html: string
  from?: string
  replyTo?: string
}
type PreparedSms = { ok: true; channel: 'sms'; to: string; body: string; from: string }
type PreparedPush = {
  ok: true
  channel: 'push'
  customerId: string
  title: string
  body: string
  url: string
}
export type PreparedBookingDelivery =
  | PreparedEmail
  | PreparedSms
  | PreparedPush
  | {
      ok: false
      reason:
        | 'payload_invalid'
        | 'booking_outcome_changed'
        | 'no_recipient'
        | 'gdpr_erased'
        | 'link_unavailable'
        | 'consent_denied'
    }

type BookingDeliveryRow = {
  id: string
  tenant_id: string
  customer_id: string | null
  status: string
  start_ts: string
  services: { name: string } | null
  staff: { title: string | null } | null
  locations: { timezone: string } | null
  tenants: { name: string; slug: string } | null
  customers: {
    id: string
    tenant_id: string
    email: string | null
    phone: string | null
    auth_user_id: string | null
  } | null
}

const EXPECTED_STATUSES: Record<string, readonly string[]> = {
  booking_request_received: ['pending'],
  booking_confirmation: ['confirmed'],
  booking_cancelled: ['cancelled'],
  booking_rebooked: ['pending', 'confirmed'],
  booking_reminder: ['pending', 'confirmed'],
  booking_completed: ['completed'],
}

function payloadRecord(row: ClaimedNotificationOutboxRow): Record<string, unknown> | null {
  return row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown>
    : null
}

function formatWhen(startISO: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone,
    }).format(new Date(startISO))
  } catch {
    return startISO
  }
}

async function tenantOrigin(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  slug: string,
  raw: string,
): Promise<string | null> {
  const { data: domains } = await admin
    .from('tenant_domains')
    .select('domain')
    .eq('tenant_id', tenantId)
    .eq('verified', true)
  const suffix = process.env.NEXT_PUBLIC_TENANT_HOST_SUFFIX ?? 'boka.corevo.se'
  const allowed = new Set([
    `${slug}.corevo.se`,
    `${slug}.${suffix}`,
    ...(domains ?? []).map((item) => item.domain.toLowerCase()),
  ])
  return isSafeCustomerClaimOrigin(raw, allowed, process.env.NODE_ENV !== 'production')
    ? new URL(raw).origin
    : null
}

/**
 * Pure transport preparation boundary for the future explicit outbox adapter.
 * Bearer links are minted here, after a row has been claimed, kept only in memory
 * and immediately handed to a provider adapter. This function itself sends nothing.
 */
export async function prepareBookingDelivery(
  outbox: ClaimedNotificationOutboxRow,
): Promise<PreparedBookingDelivery> {
  const payload = payloadRecord(outbox)
  if (!payload || payload.gdpr_erased === true || !outbox.booking_id) {
    return { ok: false, reason: payload?.gdpr_erased === true ? 'gdpr_erased' : 'payload_invalid' }
  }
  if (payload.template !== outbox.event_type || payload.booking_id !== outbox.booking_id) {
    return { ok: false, reason: 'payload_invalid' }
  }

  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'link_unavailable' }
  const { data, error } = await admin
    .from('bookings')
    .select('id, tenant_id, customer_id, status, start_ts, services(name), staff(title), locations(timezone), tenants(name,slug), customers(id,tenant_id,email,phone,auth_user_id)')
    .eq('id', outbox.booking_id)
    .eq('tenant_id', outbox.tenant_id)
    .maybeSingle()
  if (error || !data) return { ok: false, reason: 'payload_invalid' }
  const booking = data as unknown as BookingDeliveryRow
  const expected = EXPECTED_STATUSES[outbox.event_type]
  if (!expected || !expected.includes(booking.status)) {
    return { ok: false, reason: 'booking_outcome_changed' }
  }
  const tenant = booking.tenants
  const customer = booking.customers
  if (
    !tenant
    || !customer
    || customer.id !== outbox.customer_id
    || customer.tenant_id !== outbox.tenant_id
  ) return { ok: false, reason: 'no_recipient' }

  // Relationship/completion messages are marketing. Consent and the explicit
  // recommendation opt-in may be revoked after routing but before delivery, so
  // re-read both at the last preparation boundary and fail closed.
  if (outbox.event_type === 'booking_completed') {
    const { data: prefs, error: prefsError } = await admin
      .from('customer_notification_prefs')
      .select('marketing_consent, want_recommendations')
      .eq('tenant_id', outbox.tenant_id)
      .eq('customer_id', customer.id)
      .maybeSingle()
    if (
      prefsError
      || !prefs
      || prefs.marketing_consent !== true
      || prefs.want_recommendations !== true
    ) return { ok: false, reason: 'consent_denied' }
  }

  const rawOrigin = typeof payload.origin === 'string' ? payload.origin : null
  let origin: string | null = null
  if (payload.include_manage_link === true || payload.include_account_claim === true) {
    if (!rawOrigin) return { ok: false, reason: 'payload_invalid' }
    origin = await tenantOrigin(admin, outbox.tenant_id, tenant.slug, rawOrigin)
    if (!origin) return { ok: false, reason: 'payload_invalid' }
  }

  let manageUrl: string | null = null
  let accountClaimUrl: string | null = null
  if (payload.include_manage_link === true && origin) {
    const token = await buildCancelToken(booking.id)
    if (!token) return { ok: false, reason: 'link_unavailable' }
    manageUrl = buildManageUrl(origin, booking.id, token)
  }
  if (payload.include_account_claim === true && origin && customer.auth_user_id === null) {
    const claim = await createCustomerClaimLink({
      tenantId: outbox.tenant_id,
      customerId: customer.id,
      origin,
    })
    if (!claim.ok) {
      return { ok: false, reason: claim.reason === 'invalid_origin' ? 'payload_invalid' : 'link_unavailable' }
    }
    accountClaimUrl = claim.url
  }

  const tenantName = tenant.name
  const serviceName = booking.services?.name ?? 'Bokning'
  const timeZone = booking.locations?.timezone ?? 'Europe/Stockholm'
  const when = formatWhen(booking.start_ts, timeZone)

  if (outbox.chosen_channel === 'push') {
    const body = outbox.event_type === 'booking_request_received'
      ? `Förfrågan mottagen: ${serviceName} ${when}. Inte bekräftad än.`
      : `${serviceName} ${when}`
    return {
      ok: true,
      channel: 'push',
      customerId: customer.id,
      title: tenantName,
      body,
      url: '/konto',
    }
  }
  if (outbox.chosen_channel === 'sms') {
    if (!customer.phone?.trim()) return { ok: false, reason: 'no_recipient' }
    const eventText = outbox.event_type === 'booking_cancelled'
      ? 'Din tid är avbokad.'
      : outbox.event_type === 'booking_request_received'
        ? `Vi har tagit emot din bokningsförfrågan för ${serviceName} ${when}. Tiden är inte bekräftad än.`
      : outbox.event_type === 'booking_rebooked'
        ? `Din nya tid är ${when}.`
        : outbox.event_type === 'booking_reminder'
          ? `Påminnelse: ${serviceName} ${when}.`
          : outbox.event_type === 'booking_completed'
            ? 'Tack för ditt besök.'
            : `Din tid för ${serviceName} är bokad ${when}.`
    const link = accountClaimUrl ?? manageUrl
    return {
      ok: true,
      channel: 'sms',
      to: customer.phone,
      from: tenantName,
      body: `${tenantName}: ${eventText}${link ? ` ${link}` : ''}`,
    }
  }
  if (!customer.email?.trim()) return { ok: false, reason: 'no_recipient' }

  const [brand, cutoff] = await Promise.all([
    loadEmailBrand(admin, outbox.tenant_id, tenantName),
    getCancellationCutoffHours(admin, outbox.tenant_id),
  ])
  const emailData: BookingEmailData = {
    tenantName,
    serviceName,
    startISO: booking.start_ts,
    timeZone,
    staffTitle: booking.staff?.title ?? null,
    manageUrl,
    accountClaimUrl,
    cancelCutoffHours: cutoff,
    accentColor: brand.accentColor,
    logoUrl: brand.logoUrl,
    slogan: brand.slogan,
  }
  const mail = outbox.event_type === 'booking_cancelled'
    ? cancellationEmail(emailData)
    : outbox.event_type === 'booking_request_received'
      ? bookingRequestReceivedEmail(emailData)
    : outbox.event_type === 'booking_rebooked'
      ? rebookEmail(emailData)
      : outbox.event_type === 'booking_reminder'
        ? reminderEmail(emailData)
        : outbox.event_type === 'booking_completed'
          ? {
              subject: `Tack för ditt besök — ${tenantName}`,
              html: shell(
                'Tack för ditt besök',
                `<p>Vi hoppas att du är nöjd. Varmt välkommen tillbaka.</p>`,
                tenantName,
                'Vi minns dig',
                brand,
              ),
            }
          : confirmationEmail(emailData)
  return {
    ok: true,
    channel: 'email',
    to: customer.email,
    subject: mail.subject,
    html: mail.html,
    from: brand.from,
    replyTo: brand.replyTo,
  }
}
