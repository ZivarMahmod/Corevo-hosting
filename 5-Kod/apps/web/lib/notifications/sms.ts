import 'server-only'
import { logger } from '@/lib/observability'
import { createServiceClient } from '@/lib/platform/service'
import { prepareBookingDelivery } from './booking-delivery'
import type { ClaimedNotificationOutboxRow, NotificationDeliveryResult } from './outbox'
import { getSmsEnabled, parseSmsDeliveryMode, type SmsDeliveryMode } from './settings'

const ELKS_ENDPOINT = 'https://api.46elks.com/a1/sms'
const DEFAULT_SENDER = 'Corevo'
const CALLBACK_USERNAME = 'corevo'
const PROVIDER_ID = /^s[a-f0-9]{32}$/
const PROVIDER_TIMEOUT_MS = 8_000

export type SmsResult =
  | {
      ok: true
      mode: 'dry_run' | 'live'
      simulated: boolean
      providerId?: string
      parts?: number
      /** 46elks estimated_cost i 1/10000 av kontovalutan. */
      estimatedCost?: number
      /** Kostnad i öre, avrundad från 46elks cost/estimated_cost. */
      costOre?: number
      costCurrency?: string
    }
  | {
      ok: false
      mode: SmsDeliveryMode
      skipped?: boolean
      providerId?: undefined
      parts?: undefined
      costOre?: undefined
      error:
        | 'transport_off'
        | 'dry_run_requires_explicit_canary'
        | 'tenant_sms_disabled'
        | 'recipient_not_canary'
        | 'transport_unavailable'
        | 'invalid_recipient'
        | 'empty_body'
        | 'invalid_provider_response'
        | 'network_error'
        | 'request_timeout'
        | `http_${number}`
    }

export type SendSmsArgs = {
  to: string
  body: string
  from?: string
  /** Krävs explicit i dry_run/live. Saknat värde är fail-closed. */
  tenantSmsEnabled?: boolean
  /** Endast den dedikerade outbox/canary-adaptern får provider-simulera. */
  allowProviderDryRun?: boolean
}

type ResolvedSmsTransport = {
  providerKey: 'corevo_46elks' | 'partner_46elks'
  sender: string | null
  username: string | null
  password: string | null
  callbackSecret: string | null
  callbackUsername: string
  costCurrency: string
}

type SmsTransportResolver = () => Promise<ResolvedSmsTransport | null>

export function toE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned
  if (/^00\d{8,15}$/.test(cleaned)) return `+${cleaned.slice(2)}`
  if (/^0\d{8,9}$/.test(cleaned)) return `+46${cleaned.slice(1)}`
  return null
}

export function sanitizeSenderId(name?: string | null): string {
  const cleaned = (name ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 11)
  return cleaned || DEFAULT_SENDER
}

function callbackUrl(secret: string | null | undefined, username = CALLBACK_USERNAME): string | null {
  const raw = process.env.SMS_46ELKS_CALLBACK_URL
  if (!raw || !secret) return null
  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.search
      || url.hash
    ) return null
    // 46elks dokumenterar Basic Auth via userinfo i whendelivered-URL:en.
    // Providern omvandlar detta till Authorization; request-URL:en som når
    // Workern saknar därför credentials och kan behållas i invocation-loggar.
    url.username = username
    url.password = secret
    return url.toString()
  } catch {
    return null
  }
}

async function resolveTenantSmsTransport(tenantId: string): Promise<ResolvedSmsTransport | null> {
  const service = createServiceClient()
  if (!service) return null
  const { data, error } = await service.rpc('resolve_partner_sms_config', { p_tenant: tenantId })
  const row = Array.isArray(data) ? data[0] : null
  if (
    error
    || !row
    || (row.provider_key !== 'corevo_46elks' && row.provider_key !== 'partner_46elks')
    || typeof row.callback_username !== 'string'
    || typeof row.cost_currency !== 'string'
    || !/^[A-Z]{3}$/.test(row.cost_currency)
  ) return null
  return {
    providerKey: row.provider_key,
    sender: row.sender,
    username: row.username,
    password: row.password,
    callbackSecret: row.callback_secret,
    callbackUsername: row.callback_username,
    costCurrency: row.cost_currency,
  }
}

function canaryRecipients(): Set<string> {
  const recipients = (process.env.SMS_CANARY_RECIPIENTS ?? '')
    .split(',')
    .map((value) => toE164(value.trim()))
    .filter((value): value is string => value !== null)
  return new Set(recipients)
}

function costOre(cost: number): number {
  return Math.round(cost / 100)
}

function validNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validParts(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= 255
}

/**
 * 46elks-transport med fysisk trelägesgrind. Funktionen kastar aldrig och loggar
 * enbart slutna koder. `off` kontrolleras innan payload/credentials och kan därför
 * bevisas göra noll nätverkstrafik.
 */
async function sendSmsWithTransport(
  args: SendSmsArgs,
  resolveTransport?: SmsTransportResolver,
): Promise<SmsResult> {
  const mode = parseSmsDeliveryMode(process.env.SMS_DELIVERY_MODE)
  if (mode === 'off') {
    logger.info('sms.transport_off')
    return { ok: false, skipped: true, mode, error: 'transport_off' }
  }

  if (mode === 'dry_run' && args.allowProviderDryRun !== true) {
    logger.info('sms.dry_run_requires_explicit_canary')
    return {
      ok: false,
      skipped: true,
      mode,
      error: 'dry_run_requires_explicit_canary',
    }
  }

  const to = args.to?.trim()
  if (!to || (to.match(/\d/g)?.length ?? 0) < 4) {
    return { ok: false, mode, error: 'invalid_recipient' }
  }
  if (!args.body?.trim()) return { ok: false, mode, error: 'empty_body' }
  const e164 = toE164(to)
  if (!e164) {
    logger.info('sms.skipped_unparseable_number')
    return { ok: false, mode, error: 'invalid_recipient' }
  }

  if (args.tenantSmsEnabled !== true) {
    logger.info('sms.skipped_tenant_disabled')
    return { ok: false, skipped: true, mode, error: 'tenant_sms_disabled' }
  }

  if (!canaryRecipients().has(e164)) {
    logger.info('sms.skipped_not_canary')
    return { ok: false, skipped: true, mode, error: 'recipient_not_canary' }
  }

  let transport: ResolvedSmsTransport | null = null
  if (resolveTransport) {
    try {
      transport = await resolveTransport()
    } catch {
      transport = null
    }
    if (!transport) {
      logger.info('sms.skipped_transport_unavailable', { mode })
      return { ok: false, skipped: true, mode, error: 'transport_unavailable' }
    }
  }

  const partnerTransport = transport?.providerKey === 'partner_46elks' ? transport : null
  const user = partnerTransport ? partnerTransport.username : process.env.SMS_46ELKS_USERNAME
  const pass = partnerTransport ? partnerTransport.password : process.env.SMS_46ELKS_PASSWORD
  const callbackSecret = partnerTransport
    ? partnerTransport.callbackSecret
    : process.env.SMS_46ELKS_CALLBACK_SECRET
  const callbackUsername = partnerTransport?.callbackUsername ?? CALLBACK_USERNAME
  const deliveryCallback = mode === 'live'
    ? callbackUrl(callbackSecret, callbackUsername)
    : null
  if (!user || !pass || (mode === 'live' && !deliveryCallback)) {
    logger.info('sms.skipped_transport_unavailable', { mode })
    return { ok: false, skipped: true, mode, error: 'transport_unavailable' }
  }

  const form = new URLSearchParams({
    from: sanitizeSenderId(transport?.sender ?? args.from),
    to: e164,
    message: args.body,
    dontlog: 'message',
  })
  if (mode === 'dry_run') form.set('dryrun', 'yes')
  else form.set('whendelivered', deliveryCallback!)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    const response = await fetch(ELKS_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${user}:${pass}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: controller.signal,
    })
    if (!response.ok) {
      logger.warn('sms.provider_rejected', { status: response.status, mode })
      return { ok: false, mode, error: `http_${response.status}` }
    }

    const provider = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (mode === 'dry_run') {
      if (
        provider?.status !== 'created'
        || !validParts(provider.parts)
        || !validNonNegativeInteger(provider.estimated_cost)
      ) {
        logger.warn('sms.provider_response_invalid', { mode })
        return { ok: false, mode, error: 'invalid_provider_response' }
      }
      logger.info('sms.simulated_provider_ok', { parts: provider.parts })
      return {
        ok: true,
        mode,
        simulated: true,
        parts: provider.parts,
        estimatedCost: provider.estimated_cost,
      costOre: costOre(provider.estimated_cost),
      costCurrency: transport?.costCurrency ?? 'SEK',
      }
    }

    if (
      !provider
      || !PROVIDER_ID.test(String(provider.id ?? ''))
      || !['created', 'sent'].includes(String(provider.status ?? ''))
      || (provider.parts !== undefined && !validParts(provider.parts))
      || (provider.cost !== undefined && !validNonNegativeInteger(provider.cost))
    ) {
      logger.warn('sms.provider_response_invalid', { mode })
      return { ok: false, mode, error: 'invalid_provider_response' }
    }
    logger.info('sms.accepted_provider_ok')
    return {
      ok: true,
      mode,
      simulated: false,
      providerId: String(provider.id),
      ...(provider.parts === undefined ? {} : { parts: provider.parts as number }),
      ...(provider.cost === undefined ? {} : { costOre: costOre(provider.cost as number) }),
      ...(provider.cost === undefined
        ? {}
        : { costCurrency: transport?.costCurrency ?? 'SEK' }),
    }
  } catch {
    if (controller.signal.aborted) {
      logger.warn('sms.request_timeout', { mode })
      return { ok: false, mode, error: 'request_timeout' }
    }
    logger.warn('sms.network_error', { mode })
    return { ok: false, mode, error: 'network_error' }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendSms(args: SendSmsArgs): Promise<SmsResult> {
  return sendSmsWithTransport(args)
}

/** Typad U1-adapter. U4 kopplar den till en explicit SMS-worker; cron gör det inte här. */
export async function deliverSmsOutbox(
  args: SendSmsArgs & { tenantId: string },
): Promise<NotificationDeliveryResult> {
  const result = await sendSmsWithTransport(
    { ...args, allowProviderDryRun: true },
    () => resolveTenantSmsTransport(args.tenantId),
  )
  if (result.ok) {
    const receipt = {
      ...(result.providerId === undefined ? {} : { providerRef: result.providerId }),
      ...(result.costOre === undefined ? {} : { costOre: result.costOre }),
      ...(result.costCurrency === undefined ? {} : { costCurrency: result.costCurrency }),
      ...(result.parts === undefined ? {} : { parts: result.parts }),
    }
    return result.mode === 'dry_run'
      ? { status: 'simulated', ...receipt }
      : { status: 'sent', ...receipt }
  }
  if (result.error === 'transport_off') return { status: 'skipped', reason: 'transport_off' }
  if (result.error === 'dry_run_requires_explicit_canary') {
    return { status: 'skipped', reason: 'transport_off' }
  }
  if (result.error === 'tenant_sms_disabled' || result.error === 'recipient_not_canary') {
    return { status: 'skipped', reason: 'channel_disabled' }
  }
  if (result.error === 'transport_unavailable') {
    return { status: 'retry', error: 'provider_unavailable' }
  }
  if (result.error === 'invalid_recipient' || result.error === 'empty_body') {
    return { status: 'failed', reason: 'payload_invalid' }
  }
  if (result.error === 'http_429') return { status: 'retry', error: 'provider_rate_limited' }
  if (/^http_5\d\d$/.test(result.error)) return { status: 'failed', reason: 'delivery_uncertain' }
  if (
    result.error === 'network_error'
    || result.error === 'request_timeout'
    || result.error === 'invalid_provider_response'
  ) {
    return { status: 'failed', reason: 'delivery_uncertain' }
  }
  return { status: 'failed', reason: 'provider_rejected' }
}

export async function deliverClaimedSmsOutbox(
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
  if (prepared.channel !== 'sms') return { status: 'failed', reason: 'payload_invalid' }

  const service = createServiceClient()
  if (!service) return { status: 'retry', error: 'provider_unavailable' }
  const tenantSmsEnabled = await getSmsEnabled(service, row.tenant_id)
  return deliverSmsOutbox({
    tenantId: row.tenant_id,
    to: prepared.to,
    body: prepared.body,
    from: prepared.from,
    tenantSmsEnabled,
  })
}

export function parseGuestPhone(note: string | null | undefined): string | null {
  if (!note) return null
  const after = /<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*(.*)$/.exec(note)?.[1]
  if (!after) return null
  const phone = after.split(/\s+[—-]\s+/)[0]?.trim()
  if (!phone) return null
  return (phone.match(/\d/g)?.length ?? 0) >= 4 ? phone : null
}
