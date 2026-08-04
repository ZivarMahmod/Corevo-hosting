'use server'

import { createServiceClient } from '@/lib/platform/service'
import type { BookingNotificationQueueResult } from '@/lib/notifications/booking-events'
import {
  checkRateLimitFailClosed,
  getClientIp,
  LIMITS,
  rateLimitKey,
} from '@/lib/security/rate-limit'
import { sanitizeBookingNote } from '@/lib/booking/note'
import { commerceReleaseGate } from '@/lib/release/commerce'
import {
  getBookingContactMode,
  type BookingContactAvailability,
  type BookingContactMode,
} from '@/lib/notifications/giada'
import {
  readActiveBookingVerificationMode,
  type BookingVerificationMode,
} from '@/lib/platform/booking-variant'
import {
  bookingContactDigest,
  bookingPinDigest,
  deliverBookingPin,
  generateBookingPin,
  maskBookingContact,
  normalizeBookingContact,
} from '@/lib/booking/verification'
import { dispatchNotificationOutboxById } from '@/lib/notifications/outbox'
import { deliverImmediateBookingOutbox } from '@/lib/notifications/booking-immediate'
import { logger } from '@/lib/observability'
import { canonicalInstant } from '@/lib/booking/tz'
import { buildCancelToken } from '@/lib/booking/cancel-token'
import { getPublicBookingContext, publicBookingIsLive } from './public-context'

export type BookingVerificationSelection = {
  serviceId: string
  staffId: string
  startISO: string
  locationId?: string | null
}

export type StartBookingVerificationInput = BookingVerificationSelection & { contact: string }

export type ResendBookingVerificationInput = StartBookingVerificationInput & {
  channel: BookingContactMode
  challengeId: string
  sessionToken: string
}

export type CancelBookingVerificationInput = {
  challengeId: string
  sessionToken: string
}

export type CancelBookingVerificationResult = { ok: true } | { ok: false; message: string }

export type BookingVerificationStarted = {
  ok: true
  channel: BookingContactMode
  challengeId: string
  sessionToken: string
  maskedContact: string
  expiresAt: string
  resendAt: string
}

export type BookingVerificationStartResult =
  | BookingVerificationStarted
  | {
      ok: false
      reason: 'invalid' | 'slot_taken' | 'rate_limited' | 'delivery_unavailable' | 'error'
      message: string
      channel?: BookingContactMode
    }

export type VerifyBookingInput = BookingVerificationSelection & {
  challengeId: string
  sessionToken: string
  channel: BookingContactMode
  contact: string
  pin: string
  name: string
  note?: string
  requestId?: string
}

export type VerifyBookingResult =
  | {
      ok: true
      bookingId: string
      confirmationToken: string
      outboxId: string
      requiresPayment: boolean
      bookingStatus: 'pending' | 'confirmed'
      notification: BookingNotificationQueueResult
    }
  | {
      ok: false
      reason: 'invalid_pin' | 'expired' | 'slot_taken' | 'rate_limited' | 'invalid' | 'error'
      message: string
      attemptsRemaining?: number
    }

type RpcError = { code?: string; message?: string }
type StartVerificationRow = {
  challenge_id: string
  hold_id: string
  pin_outbox_id: string
  expires_at: string
  resend_after: string
}
type StartVerificationRpc = {
  rpc: (
    name: 'start_booking_verification',
    args: {
      p_tenant_slug: string
      p_staff: string
      p_service: string
      p_start: string
      p_session_token: string
      p_channel: BookingContactMode
      p_contact_digest: string
      p_contact_masked: string
      p_pin_digest: string
      p_previous_challenge?: string
    },
  ) => Promise<{ data: StartVerificationRow[] | null; error: RpcError | null }>
}
type DeliveryVerificationRpc = {
  rpc: (
    name: 'record_booking_verification_delivery',
    args: { p_challenge: string; p_session_token: string },
  ) => Promise<{ data: boolean | null; error: RpcError | null }>
}
type CancelVerificationRpc = {
  rpc: (
    name: 'cancel_booking_verification',
    args: { p_tenant_slug: string; p_challenge: string; p_session_token: string },
  ) => Promise<{ data: boolean | null; error: RpcError | null }>
}
type ReleaseHoldRpc = {
  rpc: (
    name: 'release_slot_hold',
    args: { p_staff: string; p_start: string; p_token: string },
  ) => Promise<{ data: unknown; error: RpcError | null }>
}
type FinalizeVerificationRow = {
  outcome: string
  booking_id: string | null
  outbox_id: string | null
  requires_payment: boolean
  booking_status: string | null
  attempts_remaining: number
}
type FinalizeVerificationRpc = {
  rpc: (
    name: 'finalize_verified_storefront_booking',
    args: {
      p_challenge: string
      p_session_token: string
      p_contact_digest: string
      p_pin_digest: string
      p_tenant_slug: string
      p_service: string
      p_staff: string
      p_start: string
      p_note?: string
      p_guest_name: string
      p_guest_email?: string
      p_guest_phone?: string
      p_location?: string
      p_request_id?: string
      p_online_payment_released: boolean
    },
  ) => Promise<{ data: FinalizeVerificationRow[] | null; error: RpcError | null }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function invalidContext(): Extract<BookingVerificationStartResult, { ok: false }> {
  return {
    ok: false,
    reason: 'invalid',
    message: 'Något gick fel — ladda om sidan och försök igen.',
  }
}

function validSelection(input: BookingVerificationSelection): boolean {
  if (!input.serviceId || !input.staffId || !input.startISO) return false
  return Number.isFinite(Date.parse(input.startISO))
}

function startRpcError(error: RpcError): BookingVerificationStartResult {
  if (error.code === '23P01') {
    return { ok: false, reason: 'slot_taken', message: 'Tyvärr, tiden togs precis. Välj en annan tid.' }
  }
  if (error.code === 'P0001' && error.message?.includes('resend_too_soon')) {
    return { ok: false, reason: 'rate_limited', message: 'Vänta en liten stund innan du skickar en ny kod.' }
  }
  if (error.code === 'P0001') {
    return { ok: false, reason: 'slot_taken', message: 'Den tiden är inte längre ledig — välj en ny tid.' }
  }
  if (error.code === 'P0002' || error.code === '42501' || error.code === '22023') {
    return { ok: false, reason: 'invalid', message: 'Bokningen har ändrats. Börja om och välj tiden igen.' }
  }
  return { ok: false, reason: 'error', message: 'Kunde inte skicka verifieringskoden. Försök igen.' }
}

async function safeReleaseSlotHold(
  writer: unknown,
  args: { p_staff: string; p_start: string; p_token: string },
): Promise<void> {
  try {
    const released = await (writer as ReleaseHoldRpc).rpc('release_slot_hold', args)
    if (released.error) throw new Error('release_rejected')
  } catch {
    logger.warn('booking_verification.hold_release_failed', { error: 'hold_release_failed' })
  }
}

async function getTenantBookingVerificationMode(tenantId: string): Promise<BookingVerificationMode | null> {
  const reader = createServiceClient()
  if (!reader) return null
  const { data, error } = await reader
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return error ? null : readActiveBookingVerificationMode(data?.settings)
}

export async function getBookingContactModeAction(): Promise<{ mode: BookingContactAvailability }> {
  const ctx = await getPublicBookingContext()
  if (!ctx || !(await publicBookingIsLive(ctx))) return { mode: 'unavailable' }
  const policy = await getTenantBookingVerificationMode(ctx.tenantId)
  return { mode: policy ? await getBookingContactMode(policy) : 'unavailable' }
}

async function startBookingVerificationInternal(
  input: StartBookingVerificationInput,
  previous?: Pick<ResendBookingVerificationInput, 'channel' | 'challengeId' | 'sessionToken'>,
): Promise<BookingVerificationStartResult> {
  const ctx = await getPublicBookingContext()
  if (!ctx) return invalidContext()
  if (!(await publicBookingIsLive(ctx))) {
    return { ok: false, reason: 'invalid', message: 'Onlinebokningen är inte öppen just nu.' }
  }
  if (!validSelection(input)) return { ok: false, reason: 'invalid', message: 'Ofullständig bokning. Börja om.' }

  const policy = await getTenantBookingVerificationMode(ctx.tenantId)
  if (!policy) return { ok: false, reason: 'error', message: 'Verifieringen är inte tillgänglig just nu.' }
  const liveMode = await getBookingContactMode(policy)
  if (!previous && liveMode === 'unavailable') {
    return { ok: false, reason: 'delivery_unavailable', message: 'SMS är tillfälligt nere. Försök igen om en stund.' }
  }
  const channel = previous?.channel ?? liveMode
  if (channel === 'unavailable') {
    return { ok: false, reason: 'delivery_unavailable', message: 'SMS är tillfälligt nere. Försök igen om en stund.' }
  }
  if (previous?.channel === 'sms' && liveMode !== 'sms') {
    return {
      ok: false,
      reason: 'delivery_unavailable',
      ...(liveMode === 'email' ? { channel: 'email' as const } : {}),
      message: liveMode === 'email'
        ? 'SMS är tillfälligt nere. Gå tillbaka och fortsätt med e-post i stället.'
        : 'SMS är tillfälligt nere. Försök igen om en stund.',
    }
  }

  const contact = normalizeBookingContact(channel, input.contact, ctx.countryCode)
  if (!contact) {
    return {
      ok: false,
      reason: 'invalid',
      message: channel === 'sms' ? 'Skriv ett giltigt mobilnummer.' : 'Skriv en giltig e-postadress.',
      channel,
    }
  }

  let sessionToken: string
  let contactDigest: string
  let pinDigest: string
  const pin = generateBookingPin()
  try {
    sessionToken = previous?.sessionToken ?? crypto.randomUUID()
    contactDigest = await bookingContactDigest(channel, contact)
    pinDigest = await bookingPinDigest(sessionToken, pin)
  } catch {
    return { ok: false, reason: 'error', message: 'Verifieringen är inte tillgänglig just nu.' }
  }

  const ip = await getClientIp()
  const limit = previous ? LIMITS.bookingPinResend : LIMITS.bookingPinStart
  const bucket = previous ? 'booking-pin-resend' : 'booking-pin-start'
  const limiterPart = previous?.challengeId ?? contactDigest.slice(0, 24)
  const [ipAllowed, targetAllowed] = await Promise.all([
    checkRateLimitFailClosed(rateLimitKey(bucket, ctx.tenantId, 'ip', ip), limit),
    checkRateLimitFailClosed(rateLimitKey(bucket, ctx.tenantId, 'target', limiterPart), limit),
  ])
  if (!ipAllowed || !targetAllowed) {
    return { ok: false, reason: 'rate_limited', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  const writer = createServiceClient()
  if (!writer) return { ok: false, reason: 'error', message: 'Verifieringen är inte tillgänglig just nu.' }
  const startISO = canonicalInstant(input.startISO)
  let startResult: Awaited<ReturnType<StartVerificationRpc['rpc']>>
  try {
    startResult = await (writer as unknown as StartVerificationRpc).rpc(
      'start_booking_verification',
      {
        p_tenant_slug: ctx.slug,
        p_staff: input.staffId,
        p_service: input.serviceId,
        p_start: startISO,
        p_session_token: sessionToken,
        p_channel: channel,
        p_contact_digest: contactDigest,
        p_contact_masked: maskBookingContact(channel, contact, ctx.countryCode),
        p_pin_digest: pinDigest,
        ...(previous ? { p_previous_challenge: previous.challengeId } : {}),
      },
    )
  } catch {
    await safeReleaseSlotHold(writer, { p_staff: input.staffId, p_start: startISO, p_token: sessionToken })
    logger.warn('booking_verification.start_rpc_failed', { error: 'start_rpc_transport_failed' })
    return { ok: false, reason: 'error', message: 'Kunde inte skapa verifieringen. Försök igen.' }
  }
  const { data, error } = startResult
  if (error) return startRpcError(error)
  const row = data?.[0]
  if (!row?.challenge_id || !row.pin_outbox_id || !row.expires_at || !row.resend_after) {
    await safeReleaseSlotHold(writer, { p_staff: input.staffId, p_start: startISO, p_token: sessionToken })
    return { ok: false, reason: 'error', message: 'Kunde inte skapa verifieringen. Försök igen.' }
  }

  let deliveryAccepted = false
  try {
    const run = await dispatchNotificationOutboxById(row.pin_outbox_id, async (claimed) => {
      if (claimed.event_type !== 'booking_verification_pin' || claimed.chosen_channel !== channel) {
        return { status: 'failed', reason: 'payload_invalid' } as const
      }
      const delivery = await deliverBookingPin({
        channel,
        contact,
        pin,
        outboxId: claimed.id,
        tenantName: ctx.name,
        expiresAt: row.expires_at,
      })
      if (delivery.accepted) return { status: 'sent', providerRef: delivery.providerRef } as const
      if (delivery.reason === 'disabled' || delivery.reason === 'offline' || delivery.reason === 'transport_unavailable') {
        return { status: 'skipped', reason: 'transport_off' } as const
      }
      if (delivery.reason === 'rejected' || delivery.reason === 'unauthorized') {
        return { status: 'failed', reason: 'provider_rejected' } as const
      }
      return { status: 'failed', reason: 'delivery_uncertain' } as const
    })
    deliveryAccepted = run.sent === 1
  } catch {
    logger.warn('booking_verification.pin_dispatch_failed', {
      outboxId: row.pin_outbox_id,
      error: 'pin_dispatch_failed',
    })
  }

  let recorded: Awaited<ReturnType<DeliveryVerificationRpc['rpc']>>
  try {
    recorded = await (writer as unknown as DeliveryVerificationRpc).rpc(
      'record_booking_verification_delivery',
      { p_challenge: row.challenge_id, p_session_token: sessionToken },
    )
  } catch {
    logger.warn('booking_verification.delivery_record_failed', { error: 'delivery_record_transport_failed' })
    recorded = { data: false, error: { code: 'transport_error' } }
  }
  if (!deliveryAccepted || recorded.error || recorded.data !== true) {
    await safeReleaseSlotHold(writer, { p_staff: input.staffId, p_start: startISO, p_token: sessionToken })
    return {
      ok: false,
      reason: 'delivery_unavailable',
      ...(channel === 'sms' && policy === 'sms_with_email_fallback' ? { channel: 'email' as const } : {}),
      message: channel === 'sms'
        ? policy === 'sms_with_email_fallback'
          ? 'SMS kunde inte skickas. Fortsätt med e-post i stället.'
          : 'SMS kunde inte skickas. Försök igen om en stund.'
        : 'Mejlet kunde inte skickas. Kontrollera adressen och försök igen.',
    }
  }

  return {
    ok: true,
    channel,
    challengeId: row.challenge_id,
    sessionToken,
    maskedContact: maskBookingContact(channel, contact, ctx.countryCode),
    expiresAt: row.expires_at,
    resendAt: row.resend_after,
  }
}

export async function startBookingVerification(
  input: StartBookingVerificationInput,
): Promise<BookingVerificationStartResult> {
  return startBookingVerificationInternal(input)
}

export async function resendBookingVerification(
  input: ResendBookingVerificationInput,
): Promise<BookingVerificationStartResult> {
  const result = await startBookingVerificationInternal(input, {
    channel: input.channel,
    challengeId: input.challengeId,
    sessionToken: input.sessionToken,
  })
  if (!result.ok && result.reason === 'delivery_unavailable' && input.channel === 'sms') {
    const cancelled = await cancelBookingVerification(input)
    if (!cancelled.ok) {
      return {
        ok: false,
        reason: 'error',
        message: 'SMS är nere, men tiden kunde inte släppas ännu. Försök igen om en stund.',
      }
    }
  }
  return result
}

export async function cancelBookingVerification(
  input: CancelBookingVerificationInput,
): Promise<CancelBookingVerificationResult> {
  if (!UUID_RE.test(input.challengeId) || !UUID_RE.test(input.sessionToken)) {
    return { ok: false, message: 'Verifieringen kunde inte avslutas. Ladda om sidan och försök igen.' }
  }
  const ctx = await getPublicBookingContext()
  if (!ctx) {
    return { ok: false, message: 'Verifieringen kunde inte avslutas. Ladda om sidan och försök igen.' }
  }
  const writer = createServiceClient()
  if (!writer) return { ok: false, message: 'Verifieringen kunde inte avslutas. Försök igen.' }
  try {
    const { data, error } = await (writer as unknown as CancelVerificationRpc).rpc(
      'cancel_booking_verification',
      {
        p_tenant_slug: ctx.slug,
        p_challenge: input.challengeId,
        p_session_token: input.sessionToken,
      },
    )
    if (error || data !== true) {
      return { ok: false, message: 'Tiden kunde inte släppas ännu. Försök igen om en stund.' }
    }
    return { ok: true }
  } catch {
    logger.warn('booking_verification.cancel_failed', { error: 'cancel_rpc_transport_failed' })
    return { ok: false, message: 'Tiden kunde inte släppas ännu. Försök igen om en stund.' }
  }
}

export async function verifyAndCreateBooking(input: VerifyBookingInput): Promise<VerifyBookingResult> {
  const ctx = await getPublicBookingContext()
  if (!ctx) return { ...invalidContext(), reason: 'invalid' }
  if (!(await publicBookingIsLive(ctx))) {
    return { ok: false, reason: 'invalid', message: 'Onlinebokningen är inte öppen just nu.' }
  }
  const name = input.name.trim()
  const contact = normalizeBookingContact(input.channel, input.contact, ctx.countryCode)
  if (!validSelection(input) || !name || name.length > 200 || !contact || !/^\d{4}$/.test(input.pin)) {
    return { ok: false, reason: 'invalid', message: 'Kontrollera uppgifterna och den fyrsiffriga koden.' }
  }

  const ip = await getClientIp()
  if (!(await checkRateLimitFailClosed(
    rateLimitKey('booking-pin-verify', ctx.tenantId, ip, input.challengeId),
    LIMITS.bookingPinVerify,
  ))) {
    return { ok: false, reason: 'rate_limited', message: 'För många kodförsök. Vänta en stund och försök igen.' }
  }

  let contactDigest: string
  let pinDigest: string
  try {
    contactDigest = await bookingContactDigest(input.channel, contact)
    pinDigest = await bookingPinDigest(input.sessionToken, input.pin)
  } catch {
    return { ok: false, reason: 'error', message: 'Verifieringen är inte tillgänglig just nu.' }
  }

  const writer = createServiceClient()
  if (!writer) return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  let finalizeResult: Awaited<ReturnType<FinalizeVerificationRpc['rpc']>>
  try {
    finalizeResult = await (writer as unknown as FinalizeVerificationRpc).rpc(
      'finalize_verified_storefront_booking',
      {
        p_challenge: input.challengeId,
        p_session_token: input.sessionToken,
        p_contact_digest: contactDigest,
        p_pin_digest: pinDigest,
        p_tenant_slug: ctx.slug,
        p_service: input.serviceId,
        p_staff: input.staffId,
        p_start: canonicalInstant(input.startISO),
        p_note: sanitizeBookingNote(input.note) ?? undefined,
        p_guest_name: name,
        ...(input.channel === 'email' ? { p_guest_email: contact } : { p_guest_phone: contact }),
        p_location: input.locationId ?? ctx.locationId ?? undefined,
        p_request_id: input.requestId ?? undefined,
        p_online_payment_released: commerceReleaseGate(ctx.tenantId).bookingPayment,
      },
    )
  } catch {
    logger.warn('booking_finalize.rpc_transport_failed', { error: 'finalize_rpc_transport_failed' })
    return {
      ok: false,
      reason: 'error',
      message: 'Svaret kunde inte hämtas. Tryck på bekräfta igen — samma bokning återanvänds.',
    }
  }
  const { data, error } = finalizeResult
  if (error) {
    if (error.code === '23P01' || error.code === 'P0001') {
      return { ok: false, reason: 'slot_taken', message: 'Den tiden är inte längre ledig — välj en ny tid.' }
    }
    return { ok: false, reason: 'error', message: 'Kunde inte slutföra bokningen. Försök igen.' }
  }

  const row = data?.[0]
  if (!row) return { ok: false, reason: 'error', message: 'Kunde inte slutföra bokningen. Försök igen.' }
  if (row.outcome === 'invalid_pin') {
    return {
      ok: false,
      reason: 'invalid_pin',
      message: 'Koden stämmer inte. Försök igen.',
      attemptsRemaining: row.attempts_remaining,
    }
  }
  if (row.outcome === 'attempts_exhausted') {
    return {
      ok: false,
      reason: 'invalid_pin',
      message: 'För många felaktiga försök. Skicka en ny kod.',
      attemptsRemaining: 0,
    }
  }
  if (row.outcome === 'expired' || row.outcome === 'hold_expired') {
    return { ok: false, reason: 'expired', message: 'Koden eller reservationen har gått ut. Börja om.' }
  }
  if (row.outcome !== 'booked' || !row.booking_id || !row.outbox_id) {
    return { ok: false, reason: 'invalid', message: 'Verifieringen matchar inte bokningen. Börja om.' }
  }

  try {
    await dispatchNotificationOutboxById(row.outbox_id, deliverImmediateBookingOutbox)
  } catch {
    logger.warn('booking_confirmation.immediate_dispatch_failed', {
      outboxId: row.outbox_id,
      error: 'immediate_dispatch_failed',
    })
  }

  const bookingStatus = row.booking_status === 'confirmed' ? 'confirmed' : 'pending'
  const confirmationToken = await buildCancelToken(row.booking_id)
  return {
    ok: true,
    bookingId: row.booking_id,
    confirmationToken,
    outboxId: row.outbox_id,
    requiresPayment: Boolean(row.requires_payment),
    bookingStatus,
    notification: { state: 'queued', channel: input.channel, inserted: true },
  }
}
