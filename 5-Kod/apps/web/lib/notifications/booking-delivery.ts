import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { createCustomerClaimLink } from '@/lib/kund/customer-claim-server'
import { isSafeCustomerClaimOrigin } from '@/lib/kund/customer-claim'
import { buildCancelToken, buildManageUrl } from '@/lib/booking/cancel-token'
import { getCancellationCutoffHours } from '@/lib/kund/settings'
import {
  CUSTOMER_PORTAL_KEY_VERSION,
  portalDeliverySecret,
  portalLinkDigest,
} from '@/lib/customer-portal/crypto'
import { buildPortalLinkFragment } from '@/lib/customer-portal/link'
import { readCustomerPortalMode } from '@/lib/customer-portal/mode'
import { customerPortalOrigin } from '@/lib/customer-portal/origin'
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
import { DEFAULT_TENANT_REGION } from '@/lib/tenant-region'
import {
  legacyTenantStorefrontHost,
  normalizeTenantStorefrontOrigin,
  tenantStorefrontHost,
} from '@/lib/storefront-url'

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
export type PreparedBookingDelivery =
  | PreparedEmail
  | PreparedSms
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
  tenants: {
    name: string
    slug: string
    tenant_settings: {
      country_code: string
      locale: string
      currency: string
      default_timezone: string
      settings: unknown
    } | null
  } | null
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

function formatWhen(startISO: string, timeZone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
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
  const canonicalHost = tenantStorefrontHost(slug)
  const legacyHost = legacyTenantStorefrontHost(slug)
  if (!canonicalHost || !legacyHost) return null
  const allowed = new Set([
    canonicalHost,
    legacyHost,
    ...(domains ?? []).map((item) => item.domain.toLowerCase()),
  ])
  if (!isSafeCustomerClaimOrigin(raw, allowed, process.env.NODE_ENV !== 'production')) return null
  return normalizeTenantStorefrontOrigin(slug, raw)
}

async function mintPasswordlessPortalUrl(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  outbox: ClaimedNotificationOutboxRow,
  tenantSlug: string,
  customerId: string,
): Promise<string | null> {
  const origin = customerPortalOrigin()
  if (!origin) return null

  try {
    const secret = await portalDeliverySecret(outbox.id)
    const { data, error } = await admin.rpc('customer_portal_mint_link', {
      p_tenant: outbox.tenant_id,
      p_customer: customerId,
      p_purpose: 'booking_access',
      p_token_digest: await portalLinkDigest(secret),
      p_key_version: CUSTOMER_PORTAL_KEY_VERSION,
      // The forward DB owner derives the binding expiry from the booking. This
      // bounded value keeps the call compatible while migrations cut over first.
      p_expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1_000).toISOString(),
      p_delivery_intent_id: outbox.id,
    })
    if (error || !Array.isArray(data) || data.length !== 1) return null
    const linkPublicId = data[0]?.link_public_id
    if (typeof linkPublicId !== 'string') return null
    const fragment = buildPortalLinkFragment({
      linkPublicId,
      secret,
      keyVersion: CUSTOMER_PORTAL_KEY_VERSION,
    })
    return `${origin}/oppna/${tenantSlug}${fragment}`
  } catch {
    return null
  }
}

/**
 * Pure transport preparation boundary for the claimed outbox adapter.
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
    .select('id, tenant_id, customer_id, status, start_ts, services(name), staff(title), locations(timezone), tenants(name,slug,tenant_settings(country_code,locale,currency,default_timezone,settings)), customers(id,tenant_id,email,phone,auth_user_id)')
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
  const region = tenant.tenant_settings
  if (
    !region
    || region.country_code !== DEFAULT_TENANT_REGION.countryCode
    || region.locale !== DEFAULT_TENANT_REGION.locale
    || region.currency !== DEFAULT_TENANT_REGION.currency
  ) return { ok: false, reason: 'payload_invalid' }
  const portalMode = readCustomerPortalMode(region.settings)

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
  const wantsLegacyManage = payload.include_manage_link === true
    && portalMode !== 'passwordless_tenant'
  const wantsAccountClaim = outbox.chosen_channel === 'email'
    && payload.include_account_claim === true
    && portalMode === 'legacy_account'
    && customer.auth_user_id === null
  if (wantsLegacyManage || wantsAccountClaim) {
    if (!rawOrigin) return { ok: false, reason: 'payload_invalid' }
    origin = await tenantOrigin(admin, outbox.tenant_id, tenant.slug, rawOrigin)
    if (!origin) return { ok: false, reason: 'payload_invalid' }
  }

  let manageUrl: string | null = null
  let portalUrl: string | null = null
  let accountClaimUrl: string | null = null
  if (wantsLegacyManage && origin) {
    const token = await buildCancelToken(booking.id)
    if (!token) return { ok: false, reason: 'link_unavailable' }
    manageUrl = buildManageUrl(origin, booking.id, token)
  }
  if (payload.include_manage_link === true && portalMode === 'passwordless_tenant') {
    portalUrl = await mintPasswordlessPortalUrl(admin, outbox, tenant.slug, customer.id)
    if (!portalUrl) return { ok: false, reason: 'link_unavailable' }
  }
  if (wantsAccountClaim && origin) {
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
  const timeZone = booking.locations?.timezone ?? region.default_timezone
  try {
    new Intl.DateTimeFormat(region.locale, { timeZone }).format()
  } catch {
    return { ok: false, reason: 'payload_invalid' }
  }
  const when = formatWhen(booking.start_ts, timeZone, region.locale)

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
    const link = portalUrl
      ? ` Se och hantera bokningen: ${portalUrl}`
      : manageUrl
        ? ` ${manageUrl}`
        : ''
    return {
      ok: true,
      channel: 'sms',
      to: customer.phone,
      from: tenantName,
      body: `${tenantName}: ${eventText}${link}`,
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
    locale: region.locale,
    staffTitle: booking.staff?.title ?? null,
    manageUrl,
    portalUrl,
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
