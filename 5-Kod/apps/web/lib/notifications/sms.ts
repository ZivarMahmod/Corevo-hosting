import 'server-only'
import { logger } from '@/lib/observability'

// SMS transport via 46elks (plan 006). Mirrors lib/notifications/email.ts's contract:
// one module, one responsibility — deliver an already-rendered short message.
//
// Provider contract (46elks, verified against their API docs 2026-07-17):
//   POST https://api.46elks.com/a1/sms
//   Basic auth (api_username:api_password) — NOT Bearer.
//   form-urlencoded body: from / to / message.
//   `from` = alphanumeric sender id (max 11 chars a-z/0-9) OR an E.164 number.
//   `to`   = recipient in E.164 (+46...).
//
// Graceful degrade (mirrors email.ts / lib/platform/service): without credentials,
// sendSms logs a non-PII status and returns an explicit skipped result. SMS is
// ALWAYS best-effort and a SECONDARY channel: email stays the primary
// confirmation/reminder regardless, so a missing/failed SMS must never block a
// booking, reminder, or cancellation.

export type SmsResult = {
  ok: boolean
  skipped?: boolean
  error?: string
  /** 46elks meddelande-id — outbox.provider_ref (plan 014). */
  providerId?: string
  /** Kostnad i öre ur provider-svaret (46elks `cost` är i 1/10000 SEK). */
  costOre?: number
}

const ELKS_ENDPOINT = 'https://api.46elks.com/a1/sms'
const DEFAULT_SENDER = 'Corevo'

/**
 * Normalisera ett svenskt/internationellt nummer till E.164. Returnerar null när
 * numret är tvetydigt — vi skickar ALDRIG till en gissning.
 *  - `+46701234567` (redan E.164, med ev. mellanslag/bindestreck) → behålls rensat
 *  - `0046701234567` → `+46701234567`
 *  - `0701234567` (svenskt nationellt format, ledande 0) → `+46701234567`
 *  - allt annat → null
 */
export function toE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned
  if (/^00\d{8,15}$/.test(cleaned)) return `+${cleaned.slice(2)}`
  // Svenskt nationellt format: ledande 0 + 8-9 siffror (mobil 07x xxx xx xx).
  if (/^0\d{8,9}$/.test(cleaned)) return `+46${cleaned.slice(1)}`
  return null
}

/**
 * 46elks alfanumeriskt avsändar-ID: max 11 tecken a-z/A-Z/0-9. Tar salongsnamnet,
 * strippar allt otillåtet (mellanslag, åäö → bort), klipper till 11. Tomt resultat
 * → plattformsdefault 'Corevo'.
 */
export function sanitizeSenderId(name?: string | null): string {
  const cleaned = (name ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 11)
  return cleaned || DEFAULT_SENDER
}

/**
 * Send a single SMS via 46elks. NEVER throws — every failure path returns a typed
 * result so callers can treat it as fire-and-forget.
 *
 * `to` is a phone number (normalised to E.164 here; ambiguous numbers are refused);
 * `body` is a short plain-text Swedish message; `from` is the salon name (sanitised
 * to a valid alphanumeric sender id, default 'Corevo').
 */
export async function sendSms(args: { to: string; body: string; from?: string }): Promise<SmsResult> {
  const to = args.to?.trim()
  // Räkna TOTALA siffror, inte siffror-i-rad: '070-123 45 67' är ett giltigt nummer
  // fast längsta sifferrunt bara är 3 (den gamla \d{4,}-vakten tappade formaterade nummer).
  if (!to || (to.match(/\d/g)?.length ?? 0) < 4) {
    return { ok: false, error: 'invalid_recipient' }
  }
  if (!args.body?.trim()) {
    return { ok: false, error: 'empty_body' }
  }
  const e164 = toE164(to)
  if (!e164) {
    // Icke-PII: logga aldrig själva numret.
    logger.info('sms.skipped_unparseable_number')
    return { ok: false, error: 'invalid_recipient' }
  }

  const user = process.env.SMS_46ELKS_USERNAME
  const pass = process.env.SMS_46ELKS_PASSWORD
  if (!user || !pass) {
    logger.info('sms.skipped_credentials_unset')
    return { ok: false, skipped: true, error: 'transport_unavailable' }
  }

  try {
    // Workers-runtime: btoa finns alltid; Buffer kräver nodejs_compat. btoa räcker
    // (credentials är ASCII).
    const auth = btoa(`${user}:${pass}`)
    const res = await fetch(ELKS_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        from: sanitizeSenderId(args.from),
        to: e164,
        message: args.body,
      }),
    })
    if (!res.ok) {
      logger.warn('sms.send_failed', { status: res.status })
      return { ok: false, error: `http_${res.status}` }
    }
    logger.info('sms.sent_provider_ok')
    // Kostnad + id ur svaret (best-effort — ett oparsebart svar ändrar inte ok).
    const body = (await res.json().catch(() => null)) as { id?: string; cost?: number } | null
    return {
      ok: true,
      providerId: typeof body?.id === 'string' ? body.id : undefined,
      costOre: typeof body?.cost === 'number' ? Math.round(body.cost / 100) : undefined,
    }
  } catch (err) {
    logger.warn('sms.send_threw', { error: err instanceof Error ? err.message : String(err) })
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
  // Must contain at least a few digits (TOTAL, not consecutive — '070-123 45 67'
  // is a real phone; the old \d{4,} check silently dropped formatted numbers).
  return (phone.match(/\d/g)?.length ?? 0) >= 4 ? phone : null
}
