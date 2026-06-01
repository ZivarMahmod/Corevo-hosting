import { defineConfig, devices } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// E2E harness for Corevo (G11). Drives the critical user flows against a running
// Next app.
//
// Tenant resolution: in non-subdomain environments (localhost, *.workers.dev) the
// app resolves the tenant from the `?tenant=<slug>` dev override, which middleware
// then persists in a cookie (see lib/tenant.ts + middleware.ts). The e2e helpers
// always enter via `?tenant=frisor1`, so no DNS/subdomain is needed to test.
//
// Two run targets:
//   • LOCAL  → no E2E_BASE_URL set ⇒ this config starts `next dev` on :3000.
//     Run ONLY the read-only specs locally so the canonical cloud DB is never
//     mutated:                pnpm test:e2e --grep @readonly
//   • CI / STAGING → set E2E_BASE_URL to the deployed staging URL (or build+start
//     locally with staging Supabase secrets). No webServer is started then, and
//     the full suite — including the @mutating specs — runs against the seeded,
//     disposable staging database. NEVER point the @mutating suite at prod data.
// ─────────────────────────────────────────────────────────────────────────────

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const startServer = !process.env.E2E_BASE_URL
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Mutating specs share the single seeded tenant (frisor1); keep them serial so
  // they don't race on availability/booking rows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startServer
    ? {
        // Run from the repo root; pnpm filter targets the web app.
        command: process.env.E2E_WEBSERVER_CMD ?? 'pnpm --filter @corevo/web dev',
        // Readiness probe must hit a route that returns <400. The root `/` 404s on
        // a non-tenant host (root → notFound), so probe `/login` (always 200,
        // tenant-independent, no DB round-trip).
        url: `${baseURL}/login`,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      }
    : undefined,
})
