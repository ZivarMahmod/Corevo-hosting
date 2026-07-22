import 'server-only'

import { bookingContactDigest, normalizeBookingContact } from '@/lib/booking/verification'
import { createServiceClient } from '@/lib/platform/service'
import { checkRateLimitFailClosed, LIMITS, rateLimitKey } from '@/lib/security/rate-limit'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import {
  portalRecoveryCodeDigest,
  portalRecoveryContactDigest,
  portalRecoverySubjectDigest,
} from './crypto'
import { PORTAL_UUID_PATTERN } from './link'
import { dispatchPortalRecoveryOutboxById } from './recovery-delivery'
import {
  PORTAL_RECOVERY_COOKIE,
  createPortalRecoveryCredential,
  parsePortalRecoveryCookie,
  portalRecoveryCookieOptions,
} from './recovery-cookie'
import {
  PORTAL_SESSION_COOKIE,
  createPortalSessionCredential,
  portalSessionCookieOptions,
} from './session'

type RecoveryChannel = 'sms' | 'email'
type RecoveryStartResult =
  | { state: 'accepted'; retryAfterSeconds: number }
  | { state: 'unavailable' }
  | { state: 'cooldown' | 'max_attempts'; retryAfterSeconds: number }
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizePortalRecoveryLookup(raw: string): {
  channel: RecoveryChannel
  normalized: string
} | null {
  if (typeof raw !== 'string' || raw.length > 200) return null
  const channel: RecoveryChannel = raw.includes('@') ? 'email' : 'sms'
  const normalized = normalizeBookingContact(channel, raw)
  return normalized ? { channel, normalized } : null
}

function scheduleRecoveryDelivery(outboxId: string): void {
  try {
    after(async () => {
      try {
        await dispatchPortalRecoveryOutboxById(outboxId)
      } catch {
        // The durable outbox + authorized cron remain the source of truth.
      }
    })
  } catch {
    // `after` can be unavailable outside a request context. Never turn a
    // successfully queued recovery into an HTTP failure.
  }
}

function parseQueuedRecovery(
  data: unknown,
  expectedChallengeId: string,
): { outcome: 'accepted'; outboxId: string } | { outcome: 'cooldown' } | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return null
  const row = data[0]
  if (row.outcome === 'cooldown' && row.created === false) return { outcome: 'cooldown' }
  if (
    row.outcome !== 'accepted'
    || row.challenge_public_id !== expectedChallengeId
    || row.created !== true
    || typeof row.outbox_id !== 'string'
    || !PORTAL_UUID_PATTERN.test(row.outbox_id)
  ) return null
  return { outcome: 'accepted', outboxId: row.outbox_id }
}

async function start(input: {
  tenantSlug: string
  lookup: string
  ip: string
}): Promise<RecoveryStartResult> {
  if (!TENANT_SLUG_PATTERN.test(input.tenantSlug)) return { state: 'unavailable' }
  const contact = normalizePortalRecoveryLookup(input.lookup)
  if (!contact) return { state: 'unavailable' }

  try {
    const contactDigest = await portalRecoveryContactDigest(contact.channel, contact.normalized)
    if (
      !await checkRateLimitFailClosed(
        rateLimitKey('portal-recovery-start-ip', input.tenantSlug, input.ip),
        LIMITS.portalRecoveryStart,
      )
      || !await checkRateLimitFailClosed(
        rateLimitKey('portal-recovery-start-contact', input.tenantSlug, contactDigest),
        LIMITS.portalRecoveryStart,
      )
    ) return { state: 'max_attempts', retryAfterSeconds: LIMITS.portalRecoveryStart.windowSecs }

    const client = createServiceClient() as unknown as RpcClient | null
    if (!client) return { state: 'unavailable' }
    const credential = await createPortalRecoveryCredential()
    const expiresAt = new Date(Date.now() + 300_000).toISOString()
    const { data, error } = await client.rpc('customer_portal_start_recovery', {
      p_tenant_slug: input.tenantSlug,
      p_lookup: contact.normalized,
      p_booking_contact_digest: await bookingContactDigest(contact.channel, contact.normalized),
      p_public_id: credential.challengePublicId,
      p_subject_digest: credential.subjectDigest,
      p_contact_digest: contactDigest,
      p_code_digest: await portalRecoveryCodeDigest(credential.challengePublicId, 'queued'),
      p_key_version: credential.keyVersion,
      p_expires_at: expiresAt,
    })
    if (error) return { state: 'unavailable' }
    const queued = parseQueuedRecovery(data, credential.challengePublicId)
    if (!queued) return { state: 'unavailable' }
    if (queued.outcome === 'cooldown') return { state: 'cooldown', retryAfterSeconds: 30 }

    const store = await cookies()
    store.set(PORTAL_RECOVERY_COOKIE, credential.cookieValue, portalRecoveryCookieOptions)
    scheduleRecoveryDelivery(queued.outboxId)
    return { state: 'accepted', retryAfterSeconds: 30 }
  } catch {
    return { state: 'unavailable' }
  }
}

export function startPortalRecovery(input: {
  tenantSlug: string
  lookup: string
  ip: string
}): Promise<RecoveryStartResult> {
  return start(input)
}

export async function resendPortalRecovery(input: {
  tenantSlug: string
  ip: string
}): Promise<RecoveryStartResult> {
  if (!TENANT_SLUG_PATTERN.test(input.tenantSlug)) return { state: 'unavailable' }
  try {
    const store = await cookies()
    const previous = parsePortalRecoveryCookie(store.get(PORTAL_RECOVERY_COOKIE)?.value)
    if (!previous) return { state: 'unavailable' }
    if (!await checkRateLimitFailClosed(
      rateLimitKey('portal-recovery-resend', input.tenantSlug, input.ip, previous.challengePublicId),
      LIMITS.portalRecoveryResend,
    )) return { state: 'max_attempts', retryAfterSeconds: LIMITS.portalRecoveryResend.windowSecs }

    const client = createServiceClient() as unknown as RpcClient | null
    if (!client) return { state: 'unavailable' }
    const credential = await createPortalRecoveryCredential()
    const { data, error } = await client.rpc('customer_portal_resend_recovery', {
      p_challenge_public_id: previous.challengePublicId,
      p_subject_digest: await portalRecoverySubjectDigest(previous.subjectSecret),
      p_new_public_id: credential.challengePublicId,
      p_new_subject_digest: credential.subjectDigest,
      p_new_code_digest: await portalRecoveryCodeDigest(credential.challengePublicId, 'queued'),
      p_key_version: credential.keyVersion,
      p_expires_at: new Date(Date.now() + 300_000).toISOString(),
    })
    if (error) return { state: 'unavailable' }
    const queued = parseQueuedRecovery(data, credential.challengePublicId)
    if (!queued) return { state: 'unavailable' }
    if (queued.outcome === 'cooldown') return { state: 'cooldown', retryAfterSeconds: 30 }

    store.set(PORTAL_RECOVERY_COOKIE, credential.cookieValue, portalRecoveryCookieOptions)
    scheduleRecoveryDelivery(queued.outboxId)
    return { state: 'accepted', retryAfterSeconds: 30 }
  } catch {
    return { state: 'unavailable' }
  }
}

export async function getPortalRecoveryState(input: { tenantSlug: string }): Promise<
  | { state: 'sent'; attemptsRemaining: number; resendAfter: string }
  | { state: 'expired' | 'unavailable' }
  | { state: 'max_attempts'; retryAfterSeconds: number }
> {
  if (!TENANT_SLUG_PATTERN.test(input.tenantSlug)) return { state: 'unavailable' }
  try {
    const store = await cookies()
    const credential = parsePortalRecoveryCookie(store.get(PORTAL_RECOVERY_COOKIE)?.value)
    const client = createServiceClient() as unknown as RpcClient | null
    if (!credential || !client) return { state: 'expired' }
    const { data, error } = await client.rpc('customer_portal_recovery_state', {
      p_challenge_public_id: credential.challengePublicId,
      p_subject_digest: await portalRecoverySubjectDigest(credential.subjectSecret),
    })
    if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      return { state: 'unavailable' }
    }
    const row = data[0]
    if (row.tenant_slug !== input.tenantSlug) return { state: 'unavailable' }
    if (row.outcome === 'expired') return { state: 'expired' }
    if (row.outcome === 'max_attempts') {
      return { state: 'max_attempts', retryAfterSeconds: LIMITS.portalRecoveryVerify.windowSecs }
    }
    if (
      row.outcome !== 'sent'
      || typeof row.attempts_remaining !== 'number'
      || !Number.isInteger(row.attempts_remaining)
      || row.attempts_remaining < 0
      || row.attempts_remaining > 5
      || typeof row.resend_after !== 'string'
      || !Number.isFinite(Date.parse(row.resend_after))
    ) return { state: 'unavailable' }
    return {
      state: 'sent',
      attemptsRemaining: row.attempts_remaining,
      resendAfter: row.resend_after,
    }
  } catch {
    return { state: 'unavailable' }
  }
}

export async function verifyPortalRecovery(input: {
  tenantSlug: string
  code: string
  ip: string
}): Promise<
  | { ok: true }
  | {
      ok: false
      reason?: 'invalid' | 'expired' | 'max_attempts'
      attemptsRemaining?: number
      retryAfterSeconds?: number
    }
> {
  if (!TENANT_SLUG_PATTERN.test(input.tenantSlug) || !/^\d{6}$/.test(input.code)) {
    return { ok: false, reason: 'invalid' }
  }

  try {
    const store = await cookies()
    const credential = parsePortalRecoveryCookie(store.get(PORTAL_RECOVERY_COOKIE)?.value)
    if (!credential) return { ok: false, reason: 'expired' }
    if (!await checkRateLimitFailClosed(
      rateLimitKey('portal-recovery-verify', input.tenantSlug, input.ip, credential.challengePublicId),
      LIMITS.portalRecoveryVerify,
    )) return { ok: false }

    const client = createServiceClient() as unknown as RpcClient | null
    if (!client) return { ok: false }
    const session = await createPortalSessionCredential()
    const { data, error } = await client.rpc('customer_portal_verify_recovery_and_mint_session', {
      p_challenge_public_id: credential.challengePublicId,
      p_subject_digest: await portalRecoverySubjectDigest(credential.subjectSecret),
      p_code_digest: await portalRecoveryCodeDigest(credential.challengePublicId, input.code),
      p_new_session_public_id: session.sessionPublicId,
      p_new_session_digest: session.secretDigest,
      p_key_version: session.keyVersion,
    })
    if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return { ok: false }
    const row = data[0]
    if (
      typeof row.attempts_remaining !== 'number'
      || !Number.isInteger(row.attempts_remaining)
      || row.attempts_remaining < 0
      || row.attempts_remaining > 5
    ) return { ok: false }

    if (row.outcome === 'verified' && row.tenant_slug === input.tenantSlug) {
      store.set(PORTAL_SESSION_COOKIE, session.cookieValue, portalSessionCookieOptions)
      store.set(PORTAL_RECOVERY_COOKIE, '', { ...portalRecoveryCookieOptions, maxAge: 0 })
      return { ok: true }
    }
    if (row.tenant_slug !== null || !['invalid', 'expired', 'max_attempts'].includes(String(row.outcome))) {
      return { ok: false }
    }
    return {
      ok: false,
      reason: row.outcome as 'invalid' | 'expired' | 'max_attempts',
      attemptsRemaining: row.attempts_remaining,
      ...(row.outcome === 'max_attempts'
        ? { retryAfterSeconds: LIMITS.portalRecoveryVerify.windowSecs }
        : {}),
    }
  } catch {
    return { ok: false }
  }
}
