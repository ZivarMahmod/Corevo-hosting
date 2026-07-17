import 'server-only'
import Stripe from 'stripe'

// Stripe SDK pinned for the Cloudflare Workers runtime (OpenNext). The Node http
// client uses APIs that don't exist on Workers, so we hand Stripe the fetch-based
// client. Webhook signature verification additionally needs the async crypto path
// (constructEventAsync + SubtleCryptoProvider) — see lib/stripe/webhook helpers.
//
// Graceful degrade (mirrors lib/platform/service.ts + R2): when STRIPE_SECRET_KEY
// is unset (local without secrets, `pnpm build`, CI), getStripe() returns null and
// every caller falls back to the no-payment / "betala på plats" path. Stripe is
// wired as a Worker secret in prod (G09 ops).

let cached: Stripe | null = null

/** Stripe client configured for Workers, or null when STRIPE_SECRET_KEY is unset. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (cached) return cached
  cached = new Stripe(key, {
    apiVersion: '2026-05-27.dahlia',
    httpClient: Stripe.createFetchHttpClient(),
  })
  return cached
}

/** Stripe Connect webhook secret (Connect endpoint — events carry `account`). */
export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null
}
