# E2E tests (Playwright) — G11

Critical-flow end-to-end tests. Config: `../playwright.config.ts`.

## Tags

- **`@readonly`** — pure reads (tenant + branding + service resolution). Safe to
  run anywhere, including locally against the canonical cloud DB.
- **`@mutating`** — writes rows (bookings, time-off, services, tenants). **Run
  ONLY against a seeded, disposable STAGING Supabase**, never prod data.

## Run locally

```bash
# from 5-Kod/
pnpm test:e2e:readonly     # only @readonly — starts `next dev`, probes /login
pnpm test:e2e:ui           # Playwright UI mode
```

The harness enters every tenant via the `?tenant=<slug>` dev override (middleware
persists it in a cookie — see `apps/web/lib/tenant.ts` + `middleware.ts`), so no
subdomain/DNS is needed. `next dev` reads `apps/web/.env.local`.

> Do **not** run `pnpm test:e2e` (full suite) against the canonical cloud DB — the
> `@mutating` specs would write into real tenant data.

## Run the full suite (CI / staging)

Point at a built+started app backed by a seeded staging Supabase:

```bash
E2E_WEBSERVER_CMD="pnpm --filter @corevo/web start" \
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
pnpm test:e2e
```

In CI this is the `e2e` job in `.github/workflows/ci.yml`, gated on the repo
variable `E2E_ENABLED=true`.

## Seed identities

From `supabase/seed.sql` (exist only on a seeded DB):

| Role | Email | Password |
|------|-------|----------|
| salon_admin | `admin@frisor1.se` | `Demo!1234` |
| staff | `klippare@frisor1.se` | `Demo!1234` |
| platform_admin | `platform@corevo.se` | `Demo!1234` |

Tenants: `frisor1` (Frisör Ett), `frisor2` (Salong Två).

## Staging seed gap

`cancel-rebook.spec.ts` needs a **`kund`-role account that owns an active booking**
inside the cancellation window. The base `seed.sql` has no customer booking, so the
staging seed must add one (a kund user + a future pending/confirmed booking). Until
then that spec **skips** gracefully instead of failing.

The Stripe-test-card path (`requiresPayment=true` → Checkout → Connect webhook →
`confirmed`) is verified via the manual checklist in
`docs/ops/deploy-runbook.md` §6 (needs a connected account + `stripe listen`).
