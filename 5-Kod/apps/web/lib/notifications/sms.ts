import 'server-only'
import { logger } from '@/lib/observability'

// SMS transport STUB (NOTIF-GUEST). Mirrors lib/notifications/email.ts's contract:
// one module, one responsibility — deliver an already-rendered short message. No
// provider is wired this wave; this is the hook so callers can dispatch best-effort
// SMS today and a real provider drops in behind a single fetch later.
//
// Graceful degrade (mirrors email.ts / lib/platform/service): while the transport is
// unavailable, sendSms logs a non-PII status and returns an explicit skipped result.
// SMS is ALWAYS best-effort and a
// SECONDARY channel: email stays the primary confirmation/reminder regardless, so a
// missing/failed SMS must never block a booking, reminder, or cancellation.

export type SmsResult = { ok: boolean; skipped?: boolean; error?: string }

/**
 * Send a single SMS. NEVER throws — every failure path returns a typed result so
 * callers can treat it as fire-and-forget. Until a provider has been implemented it
 * always degrades to an explicit logged no-op.
 *
 * `to` is a phone number (loosely validated — provider does the real E.164 work);
 * `body` is a short plain-text Swedish message.
 */
export async function sendSms(args: { to: string; body: string }): Promise<SmsResult> {
  const to = args.to?.trim()
  // Loose guard: at least a few digits. The provider normalises/validates E.164.
  if (!to || !/\d{4,}/.test(to)) {
    return { ok: false, error: 'invalid_recipient' }
  }
  if (!args.body?.trim()) {
    return { ok: false, error: 'empty_body' }
  }
  logger.info('sms.skipped_transport_unavailable')
  return { ok: false, skipped: true, error: 'transport_unavailable' }
}

/**
 * Pull the phone number out of the guest-contact note seam (G04):
 * `Gäst: <name> <email> <phone> [— note]` — phone is the text AFTER the email
 * bracket and BEFORE any ` — `-delimited free-text note. Returns null when absent.
 *
 * Lives here (not in ./parse, which is out of revir for this wave) so the SMS path
 * is self-contained; booking.ts + reminders.ts import it.
 */
export function parseGuestPhone(note: string | null | undefined): string | null {
  if (!note) return null
  // Everything after the email bracket `>`.
  const after = /<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*(.*)$/.exec(note)?.[1]
  if (!after) return null
  // Strip a trailing ` — note` (em dash or hyphen) free-text segment.
  const phone = after.split(/\s+[—-]\s+/)[0]?.trim()
  if (!phone) return null
  // Must contain at least a few digits to be a plausible phone number.
  return /\d{4,}/.test(phone) ? phone : null
}
