import 'server-only'
import { logger } from '@/lib/observability'

// SMS transport STUB (NOTIF-GUEST). Mirrors lib/notifications/email.ts's contract:
// one module, one responsibility — deliver an already-rendered short message. No
// provider is wired this wave; this is the hook so callers can dispatch best-effort
// SMS today and a real provider drops in behind a single fetch later.
//
// Graceful degrade (mirrors email.ts / lib/platform/service): with SMS_PROVIDER_API_KEY
// unset (local/dev/CI and — for now — prod too), sendSms logs the intent and returns
// { ok:false, skipped:true } instead of throwing. SMS is ALWAYS best-effort and a
// SECONDARY channel: email stays the primary confirmation/reminder regardless, so a
// missing/failed SMS must never block a booking, reminder, or cancellation.

export type SmsResult = { ok: boolean; skipped?: boolean; error?: string }

/**
 * Send a single SMS. NEVER throws — every failure path returns a typed result so
 * callers can treat it as fire-and-forget. With no provider configured it degrades
 * to a logged no-op ({ skipped:true }).
 *
 * `to` is a phone number (loosely validated — provider does the real E.164 work);
 * `body` is a short plain-text Swedish message.
 */
export async function sendSms(args: { to: string; body: string }): Promise<SmsResult> {
  const key = process.env.SMS_PROVIDER_API_KEY
  const to = args.to?.trim()
  // Loose guard: at least a few digits. The provider normalises/validates E.164.
  if (!to || !/\d{4,}/.test(to)) {
    return { ok: false, error: 'invalid_recipient' }
  }
  if (!args.body?.trim()) {
    return { ok: false, error: 'empty_body' }
  }
  if (!key) {
    // No transport configured → degrade. Log so the intent is observable in dev.
    logger.info('sms.skipped (SMS_PROVIDER_API_KEY unset)', { to })
    return { ok: false, skipped: true }
  }

  try {
    // TODO(provider): wire the real SMS provider fetch here, e.g.
    //   const res = await fetch('https://api.<provider>.com/sms', {
    //     method: 'POST',
    //     headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    //     body: JSON.stringify({ to, from: process.env.SMS_FROM, text: args.body }),
    //   })
    //   if (!res.ok) { logger.warn('sms.send_failed', { to, status: res.status }); return { ok:false, error:`http_${res.status}` } }
    //   return { ok: true }
    // Until a provider is selected, treat a configured-but-unimplemented key as a
    // skip rather than a hard failure, so prod never errors on this path.
    logger.info('sms.skipped (provider not yet implemented)', { to })
    return { ok: false, skipped: true }
  } catch (err) {
    logger.warn('sms.send_threw', { to, error: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: 'exception' }
  }
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
