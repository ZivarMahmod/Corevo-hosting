import 'server-only'

// Structured logging + error reporting (G10 step 6). Workers-safe: console.* goes
// to the Cloudflare Workers log stream (and Logpush, if enabled); error reporting
// is an optional Sentry POST over fetch (no Node SDK — that breaks on Workers).
//
// Graceful degrade (mirrors lib/stripe + lib/platform/service): with SENTRY_DSN
// unset, captureException just logs. Reporting is ALWAYS best-effort — telemetry
// must never throw into, or block, the path it observes.

type Level = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

/** One-line structured JSON event. Cheap; safe to call on any runtime. */
export function log(level: Level, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, message, ...redact(fields) })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (m: string, f?: LogFields) => log('debug', m, f),
  info: (m: string, f?: LogFields) => log('info', m, f),
  warn: (m: string, f?: LogFields) => log('warn', m, f),
  error: (m: string, f?: LogFields) => log('error', m, f),
}

/**
 * Named auth-denial event (goal-44 Spår A, log-contract event (b)). One structured
 * warn line when an authorization fence rejects a request. Fält-form: pass the user
 * uuid + roleLevel + what was required — NEVER email/name (PII). Cheap + best-effort.
 */
export function logAuthDenied(fields: LogFields = {}): void {
  log('warn', 'auth.denied', fields)
}

// Never let obvious secrets ride a log line, even by accident.
const SECRET_KEY = /(secret|token|password|api[_-]?key|authorization|service[_-]?role)/i
function redact(fields: LogFields): LogFields {
  const out: LogFields = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SECRET_KEY.test(k) ? '[redacted]' : typeof v === 'string' ? scrubPII(v) : v
  }
  return out
}

// Plan 002 steg 4: VÄRDE-scrub, inte bara nyckel-scrub. Ett kastat fel med
// interpolerad användardata (mejl/telefon i Error.message) får aldrig loggas rått.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g
// Telefonmönster: 7+ tecken av siffror/mellanslag/bindestreck med valfritt +läge —
// medvetet snålt (fångar +46 70-123 45 67 / 0701234567, inte order-id:n med bokstäver).
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/g
const MAX_MESSAGE_LEN = 500
export function scrubPII(text: string): string {
  return text.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[tel]')
}

/**
 * Report an error to Sentry (if configured) and always log it. Returns a promise
 * that resolves once the report is sent/skipped — await it where you can, or fire
 * and forget. Swallows every internal failure.
 */
export async function captureException(err: unknown, context: LogFields = {}): Promise<void> {
  // Trunkera + värde-scrubba felmeddelandet: Error.message är fri text och kan
  // bära PII; loggen och Sentry får den sanerade formen.
  const message = scrubPII(err instanceof Error ? err.message : String(err)).slice(
    0,
    MAX_MESSAGE_LEN,
  )
  const stack = err instanceof Error ? err.stack : undefined
  // Stacken utelämnas ur konsolloggen i produktion (kodvägar är inte hemliga, men
  // stackar bär interpolerade värden); Sentry-payloaden behåller den — det är
  // poängen med Sentry, och den scrubbas nedan.
  const includeStack = process.env.NODE_ENV !== 'production'
  log('error', message, { ...context, ...(stack && includeStack ? { stack } : {}) })

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  try {
    await sendToSentry(dsn, {
      message,
      stack: stack ? scrubPII(stack) : undefined,
      context: redact(context),
    })
  } catch {
    // reporting is best-effort — a Sentry outage must not surface here.
  }
}

// ── Minimal Sentry envelope over fetch (Workers-compatible) ──────────────────
// DSN shape: https://<publicKey>@<host>/<projectId>. We POST a single event to
// the envelope endpoint. Deliberately tiny — no breadcrumbs/transactions; just
// enough to land an exception with a stack and tags. Verified at deploy time
// (needs a real DSN); locally it is a no-op when SENTRY_DSN is unset.
type SentryPayload = { message: string; stack?: string; context: LogFields }

async function sendToSentry(dsn: string, p: SentryPayload): Promise<void> {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn)
  if (!m) return
  const [, publicKey, host, projectId] = m
  const endpoint = `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`

  const eventId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '')
  const sentAt = new Date().toISOString()
  const event = {
    event_id: eventId,
    timestamp: sentAt,
    platform: 'javascript',
    level: 'error',
    environment: process.env.NODE_ENV ?? 'production',
    tags: { ...p.context },
    exception: {
      values: [{ type: 'Error', value: p.message, stacktrace: p.stack ? { frames: [{ function: p.stack }] } : undefined }],
    },
  }
  const body =
    JSON.stringify({ event_id: eventId, sent_at: sentAt }) +
    '\n' +
    JSON.stringify({ type: 'event' }) +
    '\n' +
    JSON.stringify(event)

  await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-sentry-envelope' },
    body,
  })
}
