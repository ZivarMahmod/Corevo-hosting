// Supabase Edge Function: SMTP relay for transactional email (goal-14).
//
// The booking platform runs on Cloudflare Workers, where classic SMTP
// (nodemailer's TCP sockets) is unavailable. This Deno Edge Function is the thin
// SMTP relay: the Worker POSTs an already-rendered email here over HTTPS, and we
// hand it to one.com's SMTP server via nodemailer.
//
// Auth: a shared secret. The caller MUST send `x-relay-secret` matching the
// EMAIL_RELAY_SECRET env. The function is deployed with verify_jwt=false (no
// Supabase JWT required), so this shared secret is the ONLY gate — it fails
// CLOSED: an unset/empty EMAIL_RELAY_SECRET rejects every request with 401, so an
// unconfigured function can never be coaxed open.
//
// SMTP config is read from env (SMTP_HOSTNAME/PORT/USERNAME/PASSWORD); nothing is
// hardcoded. Secrets are never logged.

import nodemailer from 'npm:nodemailer@6.9.16'

type Payload = {
  from?: unknown
  to?: unknown
  subject?: unknown
  html?: unknown
  replyTo?: unknown
}

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' })

  // Shared-secret gate — fail CLOSED. An unset secret means the function is not
  // configured yet (secrets pending) → reject, never run open.
  const expected = Deno.env.get('EMAIL_RELAY_SECRET')
  const provided = req.headers.get('x-relay-secret')
  if (!expected || provided !== expected) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const to = typeof payload.to === 'string' ? payload.to.trim() : ''
  const subject = typeof payload.subject === 'string' ? payload.subject : ''
  const html = typeof payload.html === 'string' ? payload.html : ''
  const from = typeof payload.from === 'string' && payload.from.trim() ? payload.from.trim() : ''
  const replyTo =
    typeof payload.replyTo === 'string' && payload.replyTo.trim() ? payload.replyTo.trim() : undefined
  if (!to || !subject || !html || !from) {
    return json(400, { ok: false, error: 'missing_fields' })
  }

  const host = Deno.env.get('SMTP_HOSTNAME')
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const user = Deno.env.get('SMTP_USERNAME')
  const pass = Deno.env.get('SMTP_PASSWORD')
  if (!host || !user || !pass) {
    // SMTP not configured yet (one.com account/secrets pending). Report cleanly so
    // the caller degrades gracefully, without leaking which piece is missing.
    return json(503, { ok: false, error: 'smtp_not_configured' })
  }

  // one.com: port 465 = implicit TLS (secure:true). nodemailer re-parses the `from`
  // string and RFC 2047-encodes the display name itself, so we pass a plain
  // quoted-string ("<Salong>" <bokning@corevo.se>) — no manual MIME encoding.
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })
    return json(200, { ok: true, id: info?.messageId })
  } catch (err) {
    // Never echo the error verbatim into logs (driver errors can carry config);
    // return a short, creds-free detail to our own caller for diagnostics.
    const msg = err instanceof Error ? err.message : 'send_failed'
    return json(502, { ok: false, error: 'smtp_send_failed', detail: msg.slice(0, 200) })
  }
})
