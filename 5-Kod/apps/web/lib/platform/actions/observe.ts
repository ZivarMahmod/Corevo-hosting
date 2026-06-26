import 'server-only'
import { captureException, type LogFields } from '@/lib/observability'

/**
 * Observability seam for the platform server actions (goal-44 Spår A). Call it on
 * the UNEXPECTED failure branches — the ones that today silently return GENERIC (or
 * a generic DB-error message) and discard the real cause. It is BEST-EFFORT and must
 * NEVER throw into, or block, the action it observes (the goal's hard anti-pattern):
 * the whole body is try/caught, on top of captureException's own swallow. The sink
 * always logs a structured line (Cloudflare Workers log stream) and POSTs Sentry when
 * SENTRY_DSN is set as a Worker secret.
 *
 * PII contract: we log the action label + the supabase error CODE (e.g. 23505) +
 * whatever SAFE fields the caller passes (a tenant uuid, a slug). We deliberately do
 * NOT log the raw supabase message/detail (can echo a value) — only the code. NEVER
 * pass FormData values, email, name, phone, or tokens in `fields`. redact() in the
 * sink masks secret-looking KEYS as a backstop, not a license to pass PII.
 */
export async function reportActionError(
  action: string,
  err: unknown,
  fields: LogFields = {},
): Promise<void> {
  try {
    // Extract a supabase/Postgres-style error code without logging the message body.
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : ''
    // Errors from supabase are plain objects (not Error) → String(err) would be
    // "[object Object]". Use the action label as the message; carry the code in fields.
    const reported = err instanceof Error ? err : new Error(action)
    await captureException(reported, { action, ...(code ? { code } : {}), ...fields })
  } catch {
    // belt-and-suspenders: telemetry must never break the path it observes.
  }
}
