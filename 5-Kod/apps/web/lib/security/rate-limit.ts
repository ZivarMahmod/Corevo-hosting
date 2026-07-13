import 'server-only'
import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { logger } from '@/lib/observability'

// App-layer rate limiting (G10 step 5). Backed by the Postgres check_rate_limit
// RPC (migration 0008) — the ONLY Workers-safe limiter, since per-isolate memory
// can't see other requests. This is the COMPLEMENT to the primary defence at the
// Cloudflare WAF layer (see docs/ops/backup-restore.md §rate-limiting), which is
// documented-only for now (the live CF config is on hold until G11 + Zivar's ok).
//
// Fails OPEN: any RPC/transport error returns "allowed". A limiter that locks
// every customer out when the DB hiccups is worse than the abuse it prevents.

export type RateLimit = { max: number; windowSecs: number }

// Tunables (conservative; raise if false positives appear in real traffic).
export const LIMITS = {
  login: { max: 8, windowSecs: 300 } as RateLimit, // 8 attempts / 5 min per IP
  booking: { max: 12, windowSecs: 300 } as RateLimit, // 12 booking writes / 5 min per IP+tenant
  offert: { max: 12, windowSecs: 300 } as RateLimit, // 12 offert submissions / 5 min per IP+tenant
  event: { max: 12, windowSecs: 300 } as RateLimit, // 12 kurs-anmälningar / 5 min per IP+tenant
  // goal-64: "GÅ MED" i klubben. Snålare än de andra — en riktig människa går med EN
  // gång; ett högt tak här skulle bara låta någon pumpa in e-postadresser i kundregistret.
  loyalty: { max: 6, windowSecs: 300 } as RateLimit, // 6 klubb-anmälningar / 5 min per IP+tenant
  // goal-64: kontaktformuläret. Den enda anonyma skrivningen som finns på VARJE mall —
  // /kontakt är ingen modul och kan därför aldrig stängas av. Snålt tak: en människa
  // skriver ETT meddelande, medan varje rad här kostar kunden ett mejl i inkorgen.
  kontakt: { max: 6, windowSecs: 300 } as RateLimit, // 6 kontaktmeddelanden / 5 min per IP+tenant
} as const

/** Best-guess client IP from Cloudflare / proxy headers (never trusted for auth). */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  return (
    h.get('cf-connecting-ip') ??
    (xff ? xff.split(',')[0]?.trim() : null) ??
    h.get('x-real-ip') ??
    'unknown'
  )
}

/** True when the action is ALLOWED under `key`'s window. Fails open on error. */
export async function checkRateLimit(key: string, limit: RateLimit): Promise<boolean> {
  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max: limit.max,
      p_window_secs: limit.windowSecs,
    })
    if (error) {
      logger.warn('ratelimit.rpc_error', { key, error: error.message })
      return true
    }
    return data !== false
  } catch (e) {
    logger.warn('ratelimit.threw', { key, error: e instanceof Error ? e.message : String(e) })
    return true
  }
}

/** Convenience: build a stable bucket key from an action + parts. */
export function rateLimitKey(action: string, ...parts: string[]): string {
  return [action, ...parts].join(':')
}
