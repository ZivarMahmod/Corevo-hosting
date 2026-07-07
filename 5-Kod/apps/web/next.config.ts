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

const cspDirectives = [
  `default-src 'self'`,
  // Stripe.js is loaded from js.stripe.com; inline bootstrap needs 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline' https://js.stripe.com${isProd ? '' : " 'unsafe-eval'"}`,
  // Google Fonts stylesheet (@import in @corevo/ui/tokens.css) → fonts.googleapis.com.
  // The storefront themes reference literal font families (Playfair, Inter,
  // Cormorant, Bebas, Jost, Archivo, DM Serif) loaded from the Google Fonts CDN.
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  // Tenant logos (R2 / arbitrary branding URLs) + Stripe assets → allow https images.
  `img-src 'self' data: blob: https:`,
  // Google Fonts files are served from fonts.gstatic.com.
  `font-src 'self' data: https://fonts.gstatic.com`,
  // Supabase REST/Realtime/Auth + Stripe API. ws: only in dev (HMR).
  // goal-44 Spår A: `https://*.sentry.io` is a STATIC allowance. Today error reporting
  // (lib/observability captureException) runs SERVER-SIDE in the Worker, where CSP
  // connect-src — a browser policy — does not apply, so this is a no-op for the current
  // path. It is kept harmless + future-proof so a browser-side Sentry SDK could POST
  // without a CSP regression. NOT build-env-conditional on SENTRY_DSN: headers() is
  // evaluated at build time but the DSN is a runtime Worker secret (would be empty here).
  `connect-src 'self' https://api.stripe.com https://*.sentry.io ${supabaseUrl} https://*.supabase.co wss://*.supabase.co${isProd ? '' : ' ws:'}`,
  // Stripe Checkout/Elements iframes + the storefront's embedded OpenStreetMap map.
  `frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://www.openstreetmap.org`,
  `form-action 'self' https://checkout.stripe.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  ...(isProd ? [`upgrade-insecure-requests`] : []),
]
const csp = cspDirectives.join('; ')

// goal-50: the look-preview route (/sajtbyggare-spike/look/[key]) is rendered INSIDE the
// onboarding studio's SAME-ORIGIN <iframe>. The global `frame-ancestors 'none'` +
// `X-Frame-Options: DENY` (correct default everywhere else) would block that → blank
// preview. This variant allows SAME-ORIGIN framing only — no cross-origin embedding.
const framableCsp = cspDirectives
  .map((d) => (d.startsWith('frame-ancestors') ? `frame-ancestors 'self'` : d))
  .join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

// Same headers, but framable by 'self' (for the look-preview route only).
const framableSecurityHeaders = securityHeaders.map((h) =>
  h.key === 'Content-Security-Policy'
    ? { key: h.key, value: framableCsp }
    : h.key === 'X-Frame-Options'
      ? { key: h.key, value: 'SAMEORIGIN' }
      : h,
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  // Workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ['@corevo/db', '@corevo/auth', '@corevo/ui'],
  // Lint runs as its own task (`pnpm lint`); don't couple it to build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    // Global DENY first (covers EVERY route — never a CSP regression). The look-preview
    // override is listed LAST so that for that path it wins (Next applies matching header
    // rules in order; later entries override earlier ones for the same key). Worst case
    // the override doesn't take → look route stays DENY (blank), never a security loss.
    // Verified post-deploy by curling the look route's frame-ancestors.
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sajtbyggare-spike/look/:key*', headers: framableSecurityHeaders },
      // Super-admin live storefront preview (Sida tab) — framed SAME-ORIGIN by
      // /salonger/[id]; same 'self' carve-out as the look route.
      { source: '/salong-preview/:slug*', headers: framableSecurityHeaders },
    ]
  },
}

export default nextConfig
