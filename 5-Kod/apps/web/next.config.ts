import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

// Pin the file-tracing root to the monorepo (avoids picking up a stray
// lockfile elsewhere on disk; matters for OpenNext output tracing).
const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

// ── Security headers + CSP (G10 step 4) ──────────────────────────────────────
// Static headers live HERE (next.config) rather than middleware.ts: they cover
// EVERY route, leave the Wave-0-frozen middleware untouched, and need no per-
// request nonce (a nonce CSP would force dynamic rendering and break Next/React
// hydration). CSP is conservative-static: self + the exact third parties we call
// (Stripe for Checkout/Elements, Supabase for auth/data). `'unsafe-inline'` is
// allowed for style (Next injects inline styles) and for script (App Router emits
// inline bootstrap; without a nonce there is no stricter option) — documented
// trade-off, revisit with a nonce if we ever leave the frozen-middleware regime.
//
// Dev relaxes the policy (HMR/React-Refresh need 'unsafe-eval' + ws:); production
// drops both and adds upgrade-insecure-requests. NOTE: whether OpenNext emits
// next.config headers on the Workers runtime is a DEPLOY-TIME verification — the
// policy is proven in `next dev` here; confirm the response headers after deploy.
const isProd = process.env.NODE_ENV === 'production'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const csp = [
  `default-src 'self'`,
  // Stripe.js is loaded from js.stripe.com; inline bootstrap needs 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProd ? '' : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  // Tenant logos (R2 / arbitrary branding URLs) + Stripe assets → allow https images.
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  // Supabase REST/Realtime/Auth + Stripe API. ws: only in dev (HMR).
  `connect-src 'self' https://api.stripe.com ${supabaseUrl} https://*.supabase.co wss://*.supabase.co${isProd ? '' : ' ws:'}`,
  // Stripe Checkout/Elements iframes.
  `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com`,
  `form-action 'self' https://checkout.stripe.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  ...(isProd ? [`upgrade-insecure-requests`] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  // Workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ['@corevo/db', '@corevo/auth', '@corevo/ui'],
  // Lint runs as its own task (`pnpm lint`); don't couple it to build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
