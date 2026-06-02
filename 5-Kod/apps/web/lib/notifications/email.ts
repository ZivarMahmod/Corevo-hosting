import 'server-only'
import { logger } from '@/lib/observability'

// Transactional email transport (goal-14). The booking platform runs on the
// Cloudflare Workers runtime, where classic SMTP (nodemailer's TCP sockets) is
// unavailable — so this module is a thin HTTPS client that POSTs an
// already-rendered email to our Supabase Edge Function SMTP relay
// (supabase/functions/send-email), which in turn talks to one.com SMTP.
// Templates live in ./templates, orchestration + branding in ./booking + ./brand.
//
// Auth to the relay = a shared secret (`x-relay-secret`). Graceful degrade
// (mirrors lib/stripe + lib/platform/service): with EMAIL_RELAY_URL or
// EMAIL_RELAY_SECRET unset (local/dev/CI, or before one.com secrets are set),
// sendEmail logs the intent and returns { skipped:true } instead of throwing.
// Every caller treats notifications as best-effort — a mail failure must never
// block a booking, cancellation, or payment.

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; skipped?: true; error?: string }

/** Default platform sender; override per-deploy via NOTIFICATIONS_FROM. */
function defaultFrom(): string {
  return process.env.NOTIFICATIONS_FROM ?? 'Corevo <bokning@corevo.se>'
}

/**
 * Build a From header that carries the salon's name as the display name while the
 * address stays the configured platform address (so one.com's SPF/DKIM align).
 * `fromName` missing/blank → the platform default ("Corevo <bokning@corevo.se>").
 *
 * The address is taken from NOTIFICATIONS_FROM ("Name <addr>" or bare "addr").
 * The display name is wrapped in an RFC 5322 quoted-string (quotes/backslashes
 * escaped); we do NOT RFC 2047-encode non-ASCII (ö/å/ä) here — nodemailer in the
 * relay re-parses this string and encodes the display name itself, so manual
 * encoding would double-encode.
 */
export function buildFrom(fromName?: string | null): string {
  const def = defaultFrom()
  const name = fromName?.trim()
  if (!name) return def
  const m = /<([^>]+)>/.exec(def)
  const addr = (m?.[1] ?? def).trim()
  const safe = name.replace(/[\\"]/g, '\\$&')
  return `"${safe}" <${addr}>`
}

export async function sendEmail(args: {
  to: string
  subject: string
  html: string
  /** Override the From header (e.g. salon display name); defaults to NOTIFICATIONS_FROM. */
  from?: string
  /** Reply-To (salon's own inbox); omitted when absent (replies then go to From). */
  replyTo?: string
}): Promise<SendResult> {
  const to = args.to?.trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: 'invalid_recipient' }
  }

  const relayUrl = process.env.EMAIL_RELAY_URL
  const relaySecret = process.env.EMAIL_RELAY_SECRET
  if (!relayUrl || !relaySecret) {
    // No relay configured → degrade. Log so the intent is observable in dev.
    logger.info('email.skipped (EMAIL_RELAY_URL/EMAIL_RELAY_SECRET unset)', {
      to,
      subject: args.subject,
    })
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'x-relay-secret': relaySecret, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: args.from ?? defaultFrom(),
        to,
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { replyTo: args.replyTo } : {}),
      }),
    })
    if (!res.ok) {
      logger.warn('email.send_failed', { to, status: res.status })
      return { ok: false, error: `http_${res.status}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    logger.warn('email.send_threw', { to, error: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: 'exception' }
  }
}
