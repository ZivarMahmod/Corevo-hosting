import 'server-only'

import { cookies } from 'next/headers'
import {
  bookingContactDigest,
  generateBookingPin,
  maskBookingContact,
  normalizeBookingContact,
  type BookingVerificationChannel,
} from '@/lib/booking/verification'
import { sendEmail } from '@/lib/notifications/email'
import { sendGiadaMessage } from '@/lib/notifications/giada'
import { createServiceClient } from '@/lib/platform/service'
import {
  CUSTOMER_PORTAL_KEY_VERSION,
  createPortalPublicId,
  createPortalSecret,
  portalContactChangeCodeDigest,
  portalContactChangeSessionSecret,
  portalContactChangeSubjectDigest,
  portalSessionDigest,
} from './crypto'
import { getPortalContactChangeEvidence } from './profile'
import {
  PORTAL_SESSION_COOKIE,
  parsePortalSessionCookie,
  portalSessionCookieOptions,
} from './session'
import type { PortalContactChangeAction } from './types'

export const PORTAL_CONTACT_CHANGE_COOKIE = '__Host-corevo-portal-contact-change'
const CONTACT_CHANGE_MAX_AGE_SECONDS = 15 * 60
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/
const DIGEST_PATTERN = /^[a-f0-9]{64}$/
const INVALID_CURRENT_CONTACT_DIGEST = '0'.repeat(64)
const CONTROL = /[\u0000-\u001f\u007f]/

export const portalContactChangeCookieOptions = {
  secure: true,
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: CONTACT_CHANGE_MAX_AGE_SECONDS,
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

type ContactChangeCredential = {
  flowPublicId: string
  secret: string
  subjectDigest: string
}

type PinFailure =
  | { outcome: 'invalid'; attemptsRemaining: number }
  | { outcome: 'expired' }
  | { outcome: 'max_attempts'; retryAfterSeconds: number }
  | { outcome: 'step_up_expired' }
  | { outcome: 'unavailable' }

export type PortalContactChangeStartResult =
  | { outcome: 'sent'; channel: BookingVerificationChannel; maskedDestination: string }
  | { outcome: 'delivery_failed' }
  | { outcome: 'cooldown'; retryAfterSeconds: number }
  | { outcome: 'max_attempts'; retryAfterSeconds: number }
  | { outcome: 'invalid' }
  | { outcome: 'expired' }
  | { outcome: 'unavailable' }

export type PortalContactChangeVerifyResult = { outcome: 'verified' } | PinFailure

export type PortalContactChangeDestinationResult =
  | { outcome: 'sent'; channel: BookingVerificationChannel; maskedDestination: string }
  | { outcome: 'invalid' | 'same' | 'conflict' | 'delivery_failed' | 'expired' | 'step_up_expired' | 'unavailable' }

export type PortalContactChangeFinalizeResult =
  | { outcome: 'success'; action: PortalContactChangeAction }
  | PinFailure
  | { outcome: 'conflict' }

export type PortalContactChangeResendResult =
  | { outcome: 'sent'; channel: BookingVerificationChannel; maskedDestination: string }
  | { outcome: 'cooldown' | 'max_attempts'; retryAfterSeconds: number }
  | { outcome: 'delivery_failed' | 'expired' | 'step_up_expired' | 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function onlyRow(value: unknown): Record<string, unknown> | null {
  return Array.isArray(value) && value.length === 1 && isRecord(value[0]) ? value[0] : null
}

function validMask(channel: BookingVerificationChannel, value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 200 || CONTROL.test(value)) return false
  return channel === 'sms'
    ? /^\+[0-9]{2} ••• •• [0-9]{2}$/.test(value)
    : /^[^@\s•]•••@[^@\s•]+\.[^@\s•]+$/u.test(value)
}

function parseFlowCookie(value: string | null | undefined): { flowPublicId: string; secret: string } | null {
  if (!value) return null
  const match = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(value)
  if (!match?.[1] || !match[2] || !UUID_PATTERN.test(match[1]) || !SECRET_PATTERN.test(match[2])) {
    return null
  }
  return { flowPublicId: match[1].toLowerCase(), secret: match[2] }
}

function validAction(value: unknown): value is PortalContactChangeAction {
  return value === 'change_phone' || value === 'add_phone' || value === 'change_email'
}

async function flowAccess(): Promise<{
  store: Awaited<ReturnType<typeof cookies>>
  client: RpcClient
  sessionPublicId: string
  sessionSecretDigest: string
  flow: ContactChangeCredential
} | 'expired' | 'unavailable'> {
  try {
    const store = await cookies()
    const session = parsePortalSessionCookie(store.get(PORTAL_SESSION_COOKIE)?.value)
    const flow = parseFlowCookie(store.get(PORTAL_CONTACT_CHANGE_COOKIE)?.value)
    if (!session || !flow) return 'expired'
    const client = createServiceClient() as RpcClient | null
    if (!client) return 'unavailable'
    return {
      store,
      client,
      sessionPublicId: session.sessionPublicId,
      sessionSecretDigest: await portalSessionDigest(session.secret),
      flow: {
        ...flow,
        subjectDigest: await portalContactChangeSubjectDigest(flow.secret),
      },
    }
  } catch {
    return 'unavailable'
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

async function deliverPin(input: {
  channel: BookingVerificationChannel
  destination: string
  pin: string
  tenantName: string
  flowPublicId: string
  stage: 'current' | 'new'
  deliveryAttemptPublicId: string
  expiresAt: string
}): Promise<boolean> {
  const tenantName = input.tenantName.trim() || 'Corevo'
  if (input.channel === 'sms') {
    const result = await sendGiadaMessage({
      to: input.destination,
      message: `${tenantName}: Din verifieringskod är ${input.pin}. Koden gäller i 5 minuter.`,
      idempotencyKey: `portal-contact-change:${input.flowPublicId}:${input.stage}:${input.deliveryAttemptPublicId}`,
      expiresAt: input.expiresAt,
    })
    return result.ok
  }
  const result = await sendEmail({
    to: input.destination,
    subject: `Din kod hos ${tenantName}`,
    html: `<p>Din verifieringskod hos ${escapeHtml(tenantName)} är:</p>`
      + `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.pin}</p>`
      + '<p>Koden gäller i 5 minuter.</p>',
  })
  return result.ok
}

async function recordDelivery(input: {
  client: RpcClient
  sessionPublicId: string
  sessionSecretDigest: string
  flow: ContactChangeCredential
  stage: 'current' | 'new'
  codeDigest: string
  delivered: boolean
}): Promise<boolean> {
  const { data, error } = await input.client.rpc('customer_portal_record_contact_change_delivery', {
    p_session_public_id: input.sessionPublicId,
    p_secret_digest: input.sessionSecretDigest,
    p_flow_public_id: input.flow.flowPublicId,
    p_flow_subject_digest: input.flow.subjectDigest,
    p_stage: input.stage,
    p_code_digest: input.codeDigest,
    p_delivered: input.delivered,
  })
  return !error && data === 'ok'
}

export async function startPortalContactChange(
  action: PortalContactChangeAction,
): Promise<PortalContactChangeStartResult> {
  if (!validAction(action)) return { outcome: 'invalid' }
  const evidence = await getPortalContactChangeEvidence()
  if (evidence.outcome !== 'ok') return evidence.outcome === 'expired'
    ? { outcome: 'expired' }
    : { outcome: 'unavailable' }
  if (!evidence.actions.includes(action)) return { outcome: 'invalid' }
  try {
    const store = await cookies()
    const client = createServiceClient() as RpcClient | null
    if (!client) return { outcome: 'unavailable' }
    const flowPublicId = createPortalPublicId()
    const flowSecret = createPortalSecret()
    const subjectDigest = await portalContactChangeSubjectDigest(flowSecret)
    const pin = generateBookingPin(6)
    const codeDigest = await portalContactChangeCodeDigest(flowPublicId, 'current', pin)
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
    const { data, error } = await client.rpc('customer_portal_start_contact_change', {
      p_session_public_id: evidence.sessionPublicId,
      p_secret_digest: evidence.secretDigest,
      p_action: action,
      p_flow_public_id: flowPublicId,
      p_flow_subject_digest: subjectDigest,
      p_current_contact_digest: evidence.contactDigest,
      p_current_destination: evidence.destination,
      p_current_contact_masked: evidence.maskedDestination,
      p_code_digest: codeDigest,
      p_key_version: CUSTOMER_PORTAL_KEY_VERSION,
      p_expires_at: expiresAt,
    })
    if (error) return { outcome: 'unavailable' }
    const row = onlyRow(data)
    if (!row) return { outcome: 'unavailable' }
    if (row.outcome === 'cooldown') return { outcome: 'cooldown', retryAfterSeconds: 30 }
    if (row.outcome === 'max_attempts') return { outcome: 'max_attempts', retryAfterSeconds: 600 }
    if (row.outcome === 'expired') return { outcome: 'expired' }
    if (
      row.outcome !== 'ready'
      || row.flow_public_id !== flowPublicId
      || row.channel !== evidence.channel
      || row.delivery_destination !== evidence.destination
      || row.masked_destination !== evidence.maskedDestination
      || row.tenant_name !== evidence.tenantName
      || !validMask(evidence.channel, row.masked_destination)
      || typeof row.expires_at !== 'string'
      || !Number.isFinite(Date.parse(row.expires_at))
    ) return { outcome: 'unavailable' }

    const flow: ContactChangeCredential = { flowPublicId, secret: flowSecret, subjectDigest }
    store.set(
      PORTAL_CONTACT_CHANGE_COOKIE,
      `v1.${flowPublicId}.${flowSecret}`,
      portalContactChangeCookieOptions,
    )
    const delivered = await deliverPin({
      channel: evidence.channel,
      destination: evidence.destination,
      pin,
      tenantName: evidence.tenantName,
      flowPublicId,
      stage: 'current',
      deliveryAttemptPublicId: createPortalPublicId(),
      expiresAt: row.expires_at,
    })
    const recorded = await recordDelivery({
      client,
      sessionPublicId: evidence.sessionPublicId,
      sessionSecretDigest: evidence.secretDigest,
      flow,
      stage: 'current',
      codeDigest,
      delivered,
    })
    if (!recorded) return { outcome: 'unavailable' }
    if (!delivered) return { outcome: 'delivery_failed' }
    return {
      outcome: 'sent', channel: evidence.channel, maskedDestination: evidence.maskedDestination,
    }
  } catch {
    return { outcome: 'unavailable' }
  }
}

function parsePinFailure(row: Record<string, unknown>): PinFailure {
  if (row.outcome === 'invalid' && Number.isInteger(row.attempts_remaining)) {
    return { outcome: 'invalid', attemptsRemaining: Math.max(0, Number(row.attempts_remaining)) }
  }
  if (row.outcome === 'expired') return { outcome: 'expired' }
  if (row.outcome === 'step_up_expired') return { outcome: 'step_up_expired' }
  if (row.outcome === 'max_attempts') return { outcome: 'max_attempts', retryAfterSeconds: 600 }
  return { outcome: 'unavailable' }
}

function parsePinOutcome(row: Record<string, unknown>): PortalContactChangeVerifyResult {
  return row.outcome === 'verified' ? { outcome: 'verified' } : parsePinFailure(row)
}

export async function verifyPortalContactChangeCurrent(
  code: string,
): Promise<PortalContactChangeVerifyResult> {
  if (!/^\d{6}$/.test(code)) return { outcome: 'invalid', attemptsRemaining: 5 }
  const access = await flowAccess()
  if (access === 'expired') return { outcome: 'expired' }
  if (access === 'unavailable') return { outcome: 'unavailable' }
  try {
    const { data, error } = await access.client.rpc('customer_portal_verify_contact_change_current', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.sessionSecretDigest,
      p_flow_public_id: access.flow.flowPublicId,
      p_flow_subject_digest: access.flow.subjectDigest,
      p_code_digest: await portalContactChangeCodeDigest(access.flow.flowPublicId, 'current', code),
    })
    if (error) return { outcome: 'unavailable' }
    const row = onlyRow(data)
    return row ? parsePinOutcome(row) : { outcome: 'unavailable' }
  } catch {
    return { outcome: 'unavailable' }
  }
}

async function flowAction(access: Exclude<Awaited<ReturnType<typeof flowAccess>>, string>): Promise<PortalContactChangeAction | null> {
  const { data, error } = await access.client.rpc('customer_portal_contact_change_context', {
    p_session_public_id: access.sessionPublicId,
    p_secret_digest: access.sessionSecretDigest,
    p_flow_public_id: access.flow.flowPublicId,
    p_flow_subject_digest: access.flow.subjectDigest,
  })
  const row = !error ? onlyRow(data) : null
  return row?.outcome === 'ready' && validAction(row.action) ? row.action : null
}

async function currentContactDigest(
  access: Exclude<Awaited<ReturnType<typeof flowAccess>>, string>,
): Promise<{ digest: string; destination: string } | 'expired' | 'unavailable'> {
  const evidence = await getPortalContactChangeEvidence()
  if (evidence.outcome !== 'ok') return evidence.outcome
  if (evidence.sessionPublicId !== access.sessionPublicId || !DIGEST_PATTERN.test(evidence.contactDigest)) {
    return 'unavailable'
  }
  return { digest: evidence.contactDigest, destination: evidence.destination }
}

export async function submitPortalContactChangeDestination(
  rawDestination: string,
): Promise<PortalContactChangeDestinationResult> {
  const access = await flowAccess()
  if (access === 'expired') return { outcome: 'expired' }
  if (access === 'unavailable') return { outcome: 'unavailable' }
  try {
    const action = await flowAction(access)
    if (!action) return { outcome: 'step_up_expired' }
    const currentContact = await currentContactDigest(access)
    if (currentContact === 'expired') return { outcome: 'expired' }
    if (currentContact === 'unavailable') return { outcome: 'unavailable' }
    const channel: BookingVerificationChannel = action === 'change_email' ? 'email' : 'sms'
    const normalized = normalizeBookingContact(channel, rawDestination)
    if (!normalized) return { outcome: 'invalid' }
    const masked = maskBookingContact(channel, normalized)
    if (!validMask(channel, masked)) return { outcome: 'invalid' }
    const pin = generateBookingPin(6)
    const codeDigest = await portalContactChangeCodeDigest(access.flow.flowPublicId, 'new', pin)
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
    const { data, error } = await access.client.rpc('customer_portal_prepare_contact_change_destination', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.sessionSecretDigest,
      p_flow_public_id: access.flow.flowPublicId,
      p_flow_subject_digest: access.flow.subjectDigest,
      p_current_contact_digest: currentContact.digest,
      p_current_destination: currentContact.destination,
      p_new_destination: normalized,
      p_new_channel: channel,
      p_new_contact_digest: await portalContactChangeSubjectDigest(`${channel}:${normalized}`),
      p_new_booking_contact_digest: await bookingContactDigest(channel, normalized),
      p_new_contact_masked: masked,
      p_code_digest: codeDigest,
      p_key_version: CUSTOMER_PORTAL_KEY_VERSION,
      p_expires_at: expiresAt,
    })
    if (error) return { outcome: 'unavailable' }
    const row = onlyRow(data)
    if (!row) return { outcome: 'unavailable' }
    if (row.outcome === 'same' || row.outcome === 'conflict' || row.outcome === 'step_up_expired') {
      return { outcome: row.outcome }
    }
    if (
      row.outcome !== 'ready'
      || row.channel !== channel
      || row.delivery_destination !== normalized
      || row.masked_destination !== masked
      || typeof row.tenant_name !== 'string'
      || typeof row.expires_at !== 'string'
      || !Number.isFinite(Date.parse(row.expires_at))
    ) return { outcome: 'unavailable' }
    const delivered = await deliverPin({
      channel,
      destination: normalized,
      pin,
      tenantName: row.tenant_name,
      flowPublicId: access.flow.flowPublicId,
      stage: 'new',
      deliveryAttemptPublicId: createPortalPublicId(),
      expiresAt: row.expires_at,
    })
    const recorded = await recordDelivery({
      ...access, flow: access.flow, stage: 'new', codeDigest, delivered,
    })
    if (!recorded) return { outcome: 'unavailable' }
    if (!delivered) return { outcome: 'delivery_failed' }
    return { outcome: 'sent', channel, maskedDestination: masked }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function resendPortalContactChange(
  stage: 'current' | 'new',
): Promise<PortalContactChangeResendResult> {
  const access = await flowAccess()
  if (access === 'expired') return { outcome: 'expired' }
  if (access === 'unavailable') return { outcome: 'unavailable' }
  try {
    const currentContact = stage === 'current'
      ? await currentContactDigest(access)
      : { digest: INVALID_CURRENT_CONTACT_DIGEST, destination: '' }
    if (currentContact === 'expired') return { outcome: 'expired' }
    if (currentContact === 'unavailable') return { outcome: 'unavailable' }
    const pin = generateBookingPin(6)
    const codeDigest = await portalContactChangeCodeDigest(access.flow.flowPublicId, stage, pin)
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()
    const { data, error } = await access.client.rpc('customer_portal_resend_contact_change', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.sessionSecretDigest,
      p_flow_public_id: access.flow.flowPublicId,
      p_flow_subject_digest: access.flow.subjectDigest,
      p_stage: stage,
      p_current_contact_digest: currentContact.digest,
      p_current_destination: currentContact.destination,
      p_code_digest: codeDigest,
      p_expires_at: expiresAt,
    })
    if (error) return { outcome: 'unavailable' }
    const row = onlyRow(data)
    if (!row) return { outcome: 'unavailable' }
    if (row.outcome === 'cooldown' || row.outcome === 'max_attempts') {
      return {
        outcome: row.outcome,
        retryAfterSeconds: Number.isInteger(row.retry_after_seconds)
          ? Math.max(1, Number(row.retry_after_seconds))
          : row.outcome === 'cooldown' ? 30 : 600,
      }
    }
    if (row.outcome === 'expired' || row.outcome === 'step_up_expired') {
      return { outcome: row.outcome }
    }
    if (
      row.outcome !== 'ready'
      || (row.channel !== 'sms' && row.channel !== 'email')
      || typeof row.delivery_destination !== 'string'
      || !validMask(row.channel, row.masked_destination)
      || typeof row.tenant_name !== 'string'
      || typeof row.expires_at !== 'string'
      || !Number.isFinite(Date.parse(row.expires_at))
    ) return { outcome: 'unavailable' }
    const delivered = await deliverPin({
      channel: row.channel,
      destination: row.delivery_destination,
      pin,
      tenantName: row.tenant_name,
      flowPublicId: access.flow.flowPublicId,
      stage,
      deliveryAttemptPublicId: createPortalPublicId(),
      expiresAt: row.expires_at,
    })
    const recorded = await recordDelivery({
      ...access, flow: access.flow, stage, codeDigest, delivered,
    })
    if (!recorded) return { outcome: 'unavailable' }
    if (!delivered) return { outcome: 'delivery_failed' }
    return { outcome: 'sent', channel: row.channel, maskedDestination: row.masked_destination }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function finalizePortalContactChange(
  code: string,
): Promise<PortalContactChangeFinalizeResult> {
  if (!/^\d{6}$/.test(code)) return { outcome: 'invalid', attemptsRemaining: 5 }
  const access = await flowAccess()
  if (access === 'expired') return { outcome: 'expired' }
  if (access === 'unavailable') return { outcome: 'unavailable' }
  try {
    const exactCurrent = await currentContactDigest(access)
    const currentContact = exactCurrent === 'expired' || exactCurrent === 'unavailable'
      ? { digest: INVALID_CURRENT_CONTACT_DIGEST, destination: '' }
      : exactCurrent
    const rotatedSecret = await portalContactChangeSessionSecret(
      access.flow.flowPublicId,
      access.flow.secret,
    )
    const { data, error } = await access.client.rpc('customer_portal_finalize_contact_change', {
      p_session_public_id: access.sessionPublicId,
      p_secret_digest: access.sessionSecretDigest,
      p_flow_public_id: access.flow.flowPublicId,
      p_flow_subject_digest: access.flow.subjectDigest,
      p_code_digest: await portalContactChangeCodeDigest(access.flow.flowPublicId, 'new', code),
      p_current_contact_digest: currentContact.digest,
      p_current_destination: currentContact.destination,
      p_new_session_public_id: access.flow.flowPublicId,
      p_new_session_digest: await portalSessionDigest(rotatedSecret),
      p_key_version: CUSTOMER_PORTAL_KEY_VERSION,
    })
    if (error) return { outcome: 'unavailable' }
    const row = onlyRow(data)
    if (!row) return { outcome: 'unavailable' }
    if (row.outcome === 'completed' && validAction(row.action)) {
      access.store.set(
        PORTAL_SESSION_COOKIE,
        `v1.${access.flow.flowPublicId}.${rotatedSecret}`,
        portalSessionCookieOptions,
      )
      access.store.set(PORTAL_CONTACT_CHANGE_COOKIE, '', {
        ...portalContactChangeCookieOptions, maxAge: 0,
      })
      return { outcome: 'success', action: row.action }
    }
    if (row.outcome === 'conflict') return { outcome: 'conflict' }
    return parsePinFailure(row)
  } catch {
    return { outcome: 'unavailable' }
  }
}
