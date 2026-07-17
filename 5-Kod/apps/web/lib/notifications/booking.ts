import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'
import { sendEmail, buildFrom, type SendResult } from './email'
import { sendSms } from './sms'
import { sendPushToCustomer } from './push'
import { resolveChannel, type CustomerPrefs, type NotificationChannel } from './router'
import { logOutbox } from './outbox'
import { logger } from '@/lib/observability'
import { getSmsEnabled } from './settings'
import { loadEmailBrand } from './brand'
import { getCancellationCutoffHours } from '@/lib/kund/settings'
import { buildCancelToken, buildManageUrl } from '@/lib/booking/cancel-token'
import {
  confirmationEmail,
  cancellationEmail,
  reminderEmail,
  receiptEmail,
  rebookEmail,
  type BookingEmailData,
} from './templates'

// Tenant context for resolving per-salon email brand (From name, Reply-To, accent,
// logo, slogan). When ABSENT, senders still set the From display name from
// d.tenantName but send no Reply-To and no brand — fully backwards-compatible.
export type BrandCtx = { supabase: SupabaseClient<Database>; tenantId: string }

/**
 * Fold per-salon brand into the email data + From/Reply-To. With no ctx, degrades
 * to the salon name as From display (no Reply-To, Corevo-gold template). Best-effort:
 * a brand-load failure is swallowed inside loadEmailBrand, never blocks the send.
 */
async function applyBrand(
  d: BookingEmailData,
  ctx?: BrandCtx,
): Promise<{ data: BookingEmailData; from?: string; replyTo?: string }> {
  if (!ctx?.supabase || !ctx.tenantId) {
    return { data: d, from: buildFrom(d.tenantName) }
  }
  const brand = await loadEmailBrand(ctx.supabase, ctx.tenantId, d.tenantName)
  return {
    data: { ...d, accentColor: brand.accentColor, logoUrl: brand.logoUrl, slogan: brand.slogan },
    from: brand.from,
    replyTo: brand.replyTo,
  }
}

// Optional, additive context for the confirmation send. When ABSENT, the sender
// behaves exactly as before (email-only, no manage link, no SMS) — so the existing
// (to, data) call shape and any caller outside this wave keep compiling/working.
export type ConfirmationContext = {
  /** Tenant-scoped or service-role client used to read sms_enabled + cutoff. */
  supabase?: SupabaseClient<Database>
  tenantId?: string
  /** Booking id — required to mint the HMAC self-service cancel token. */
  bookingId?: string
  /** Absolute origin for the manage link, e.g. https://frisor1.corevo.se. */
  origin?: string
  /** Guest phone (note seam or user's phone) — SMS recipient when sms_enabled. */
  phone?: string | null
}

// Booking notification orchestration (G10 step 3). Each function is BEST-EFFORT:
// it never throws and never returns a rejected promise into the caller, so a mail
// hiccup can't break a booking/cancel/payment. Callers may `await` (to keep the
// Workers request alive long enough to send) or fire-and-forget.

// Guest-note parsers live in ./parse (pure, unit-tested); re-exported here so
// callers keep importing them from the orchestration module.
export { parseGuestEmail, parseGuestName } from './parse'

async function safeSend(
  kind: string,
  to: string | null | undefined,
  mail: { subject: string; html: string },
  opts?: { from?: string; replyTo?: string },
): Promise<SendResult> {
  if (!to) {
    logger.info('notify.skipped_no_recipient', { kind })
    return { ok: false, error: 'missing_recipient' }
  }
  const res = await sendEmail({ to, subject: mail.subject, html: mail.html, from: opts?.from, replyTo: opts?.replyTo })
  if (res.ok) logger.info('notify.sent', { kind })
  else if (!res.skipped) logger.warn('notify.failed', { kind, error: res.error })
  return res
}

// Short Swedish SMS body for a booking confirmation. Plain text, no links/PII.
function confirmationSmsBody(d: BookingEmailData): string {
  let when = d.startISO
  try {
    when = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: d.timeZone,
    }).format(new Date(d.startISO))
  } catch {
    /* fall back to the raw ISO string */
  }
  return `${d.tenantName}: din tid för ${d.serviceName} är bokad ${when}. Välkommen!`
}

/** Kundens routing-kontext (plan 014): prefs-rad, aktiv push-sub och kund-id.
 *  Best-effort — varje miss ⇒ gäst-defaults (null/false), aldrig ett kast.
 *  RLS gör grovjobbet: en anon-klient kan inte läsa prefs ⇒ gäst-vägen. */
async function loadRoutingContext(
  supabase: SupabaseClient<Database>,
  bookingId: string | undefined,
): Promise<{ customerId: string | null; prefs: CustomerPrefs | null; hasPush: boolean }> {
  const none = { customerId: null, prefs: null, hasPush: false }
  if (!bookingId) return none
  try {
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', bookingId)
      .maybeSingle()
    const customerId = booking?.customer_id ?? null
    if (!customerId) return none
    const [{ data: prefsRow }, { count }] = await Promise.all([
      supabase
        .from('customer_notification_prefs')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle(),
      supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .is('revoked_at', null),
    ])
    return {
      customerId,
      prefs: (prefsRow as CustomerPrefs | null) ?? null,
      hasPush: (count ?? 0) > 0,
    }
  } catch {
    return none
  }
}

/**
 * Booking confirmation — pilotkanalen genom kanalroutern + outboxen (plan 014).
 * EN kanal väljs (push → e-post → SMS efter samtycke/opt-in); fallback provas
 * bara när primärkanalen FAILAR. Den gamla "e-post + extra-SMS"-dubbelvägen är
 * borttagen (plan 012/014 STOP: aldrig två kanaler för samma händelse).
 * Varje beslut skrivs till notifications_outbox (best-effort, service-role).
 * Utan `ctx` (legacy-anropare) skickas e-posten precis som förr, utan ledger.
 */
export async function sendBookingConfirmation(
  to: string,
  d: BookingEmailData,
  ctx?: ConfirmationContext,
): Promise<void> {
  let data = d
  const phone = ctx?.phone ?? null
  let from: string | undefined = buildFrom(d.tenantName)
  let replyTo: string | undefined

  if (ctx?.supabase && ctx.tenantId) {
    // Self-service manage link + cutoff + per-salon brand (best-effort; failures
    // degrade to no link / Corevo-default brand).
    try {
      const cutoff = await getCancellationCutoffHours(ctx.supabase, ctx.tenantId)
      let manageUrl: string | null = null
      if (ctx.bookingId && ctx.origin) {
        const token = await buildCancelToken(ctx.bookingId)
        if (token) manageUrl = buildManageUrl(ctx.origin, ctx.bookingId, token)
      }
      const brand = await loadEmailBrand(ctx.supabase, ctx.tenantId, d.tenantName)
      from = brand.from
      replyTo = brand.replyTo
      data = {
        ...d,
        manageUrl,
        cancelCutoffHours: cutoff,
        accentColor: brand.accentColor,
        logoUrl: brand.logoUrl,
        slogan: brand.slogan,
      }
    } catch (err) {
      logger.warn('notify.confirmation_enrich_failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Legacy-väg utan tenant-kontext: e-post rakt av, ingen router/ledger.
  if (!ctx?.supabase || !ctx.tenantId) {
    await safeSend('booking.confirmation', to, confirmationEmail(data), { from, replyTo })
    return
  }

  const tenantId = ctx.tenantId
  let tenantSmsEnabled = false
  try {
    tenantSmsEnabled = await getSmsEnabled(ctx.supabase, tenantId)
  } catch {
    /* gäst-SMS-fallback stängd vid läsfel — e-posten bär bekräftelsen */
  }
  const routing = await loadRoutingContext(ctx.supabase, ctx.bookingId)
  const decision = resolveChannel({
    category: 'transactional',
    type: 'booking_confirmation',
    prefs: routing.prefs,
    hasPushSubscription: routing.hasPush,
    hasEmail: !!to,
    hasPhone: !!phone?.trim(),
    tenantSmsEnabled,
  })

  if (!decision.allowed || !decision.channel) {
    await logOutbox({
      tenantId,
      customerId: routing.customerId,
      bookingId: ctx.bookingId ?? null,
      eventType: 'booking_confirmation',
      category: 'transactional',
      decision,
      status: 'skipped',
    })
    return
  }

  // Skicka på vald kanal; fallback provas ENDAST när primären failar.
  const attempt = async (
    channel: NotificationChannel,
  ): Promise<{ ok: boolean; costOre?: number; providerRef?: string }> => {
    if (channel === 'push' && routing.customerId) {
      const res = await sendPushToCustomer({
        customerId: routing.customerId,
        title: data.tenantName,
        body: confirmationSmsBody(data),
      })
      return { ok: res.ok }
    }
    if (channel === 'sms' && phone) {
      try {
        const res = await sendSms({ to: phone, body: confirmationSmsBody(data), from: data.tenantName })
        if (res.ok) logger.info('sms.sent', { kind: 'booking.confirmation' })
        return { ok: res.ok, costOre: res.costOre, providerRef: res.providerId }
      } catch (err) {
        logger.warn('sms.threw', {
          kind: 'booking.confirmation',
          error: err instanceof Error ? err.message : String(err),
        })
        return { ok: false }
      }
    }
    const res = await safeSend('booking.confirmation', to, confirmationEmail(data), { from, replyTo })
    return { ok: res.ok }
  }

  let usedChannel = decision.channel
  let result = await attempt(decision.channel)
  if (!result.ok && decision.fallback) {
    usedChannel = decision.fallback
    result = await attempt(decision.fallback)
  }

  await logOutbox({
    tenantId,
    customerId: routing.customerId,
    bookingId: ctx.bookingId ?? null,
    eventType: 'booking_confirmation',
    category: 'transactional',
    decision,
    status: result.ok ? 'sent' : 'failed',
    usedChannel,
    costOre: result.costOre ?? null,
    providerRef: result.providerRef ?? null,
  })
}

export async function sendBookingCancellation(
  to: string,
  d: BookingEmailData,
  ctx?: BrandCtx,
): Promise<void> {
  const { data, from, replyTo } = await applyBrand(d, ctx)
  await safeSend('booking.cancellation', to, cancellationEmail(data), { from, replyTo })
}

export async function sendBookingReminder(
  to: string,
  d: BookingEmailData,
  ctx?: BrandCtx,
): Promise<SendResult> {
  const { data, from, replyTo } = await applyBrand(d, ctx)
  return safeSend('booking.reminder', to, reminderEmail(data), { from, replyTo })
}

// Rebook / "ny tid"-bekräftelse (M9, additive). Today rebookBooking() reuses
// sendBookingConfirmation for the new time; the orchestrator should switch that
// call site to this dedicated sender (see crossModuleGaps). Same best-effort
// contract as the others — never throws into the caller.
export async function sendBookingRebook(
  to: string,
  d: BookingEmailData,
  ctx?: BrandCtx,
): Promise<void> {
  const { data, from, replyTo } = await applyBrand(d, ctx)
  await safeSend('booking.rebook', to, rebookEmail(data), { from, replyTo })
}

export async function sendPaymentReceipt(
  to: string | null,
  d: BookingEmailData & {
    amountCents: number
    currency: string
    /** Plan 003: org-nr + momssats (settings.legal) — utelämnade → kvittot utan raderna. */
    orgNr?: string | null
    vatRate?: number | null
  },
  ctx?: BrandCtx,
): Promise<void> {
  const { data, from, replyTo } = await applyBrand(d, ctx)
  await safeSend(
    'payment.receipt',
    to,
    receiptEmail({
      ...data,
      amountCents: d.amountCents,
      currency: d.currency,
      orgNr: d.orgNr,
      vatRate: d.vatRate,
    }),
    { from, replyTo },
  )
}
