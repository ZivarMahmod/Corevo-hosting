import 'server-only'
import { logger } from '@/lib/observability'

// Transactional email transport (G10 step 3). Resend over fetch — the Resend HTTP
// API is plain JSON, so it runs on the Cloudflare Workers runtime with no Node-only
// SMTP (which would break the bundle). One module, one responsibility: deliver an
// already-rendered email. Templates live in ./templates, orchestration in ./booking.
//
// Graceful degrade (mirrors lib/stripe + lib/platform/service): with RESEND_API_KEY
// unset (local/dev/CI), sendEmail logs the intent and returns { skipped:true } instead
// of throwing. Every caller treats notifications as best-effort — a mail failure must
// never block a booking, cancellation, or payment.

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; skipped?: true; error?: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Default platform sender; override per-deploy via NOTIFICATIONS_FROM (verified domain). */
function fromAddress(): string {
  return process.env.NOTIFICATIONS_FROM ?? 'Corevo <bokning@corevo.se>'
}

export async function sendEmail(args: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const to = args.to?.trim()
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: 'invalid_recipient' }
  }
  if (!key) {
    // No transport configured → degrade. Log so the intent is observable in dev.
    logger.info('email.skipped (RESEND_API_KEY unset)', { to, subject: args.subject })
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
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
