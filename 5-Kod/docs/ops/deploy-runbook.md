# Deploy runbook — Corevo bokningsplattform (G11)

CI/CD, environments, secrets, the live-blocker checklist, and rollback. Pipeline
files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`. Worker config:
`5-Kod/apps/web/wrangler.jsonc`.

> **Verifierat 2026-07-17 (read-only mot prod)** — Worker `bokningsplatformen` är
> live; Supabase-projektet `clylvowtowbtotrahuad` är ACTIVE_HEALTHY på Pro och har
> migrationer till och med **0082** registrerade. R2 används för media men backup/
> versionering är inte verifierad. Den aktuella kodrundan kräver 0083–0088 och får
> inte deployas före separat migrationsapply + checkpoint enligt §3.

---

## 1. Topology

| Env | Worker | Host | Supabase |
|-----|--------|------|----------|
| Production | `bokningsplatformen` (top-level `wrangler.jsonc`) | `booking.corevo.se` (platform) + `frisorN.corevo.se` (tenants, OPS routing) | `clylvowtowbtotrahuad` (prod) |
| Staging | `bokningsplatformen-staging` (`--env staging`) | `*.workers.dev` | separate staging project (OPS) |

Account: `0be2655be66efbfa5d9b36721ddae008` (Zivar68). R2 binding `BUCKET` →
`corevo-media` in both envs.

## 2. CI (`ci.yml`) — PR gate

`pull_request` + `push:main` kör **lint → typecheck → unit → build** samt en separat
lokal Supabase-jobb som applicerar migrationer och kör pgTAP/RLS. Fel blockerar PR.
`next build` kör produktionsformade `NEXT_PUBLIC_*` så fel host-default inte kan gå ut.

Full Playwright E2E (`e2e` job) runs only when repo **variable** `E2E_ENABLED=true`
(set it after staging secrets exist). It builds with staging env, `next start`s the
app, and runs the whole suite incl. `@mutating` against the seeded staging DB.
Without the flag the job is **skipped** (not failed) so an unconfigured repo isn't
red-washed.

## 3. CD (`deploy.yml`)

- **Staging** — endast manual dispatch → staging. Runs Supabase
  migrations against staging, OpenNext build (staging env), `wrangler deploy --env staging`.
- **Production** — only on a `v*` **tag** or manual dispatch → production, behind the
  `production` GitHub Environment approval gate. **Never auto from a PR** (DoD).
  Production migrations appliceras **out-of-band** efter granskning. Workflowen
  kräver därefter GitHub Environment-variabeln `PROD_DB_MIGRATION=0116` innan
  OpenNext build (prod env), sedan **`node scripts/deploy-prod.mjs`**
  — NOT bare `wrangler deploy`. Since **fix-35** the per-customer storefront domains
  (`<slug>.corevo.se`) live in **committed `wrangler.jsonc`** top-level `routes[]`
  (alongside the 3 fixed back-office hosts), so deploying that file re-asserts every
  one and can NEVER detach it. `deploy-prod.mjs` runs a fail-closed VALIDATOR
  (`gen-deploy-config.mjs`) proving committed `wrangler.jsonc` ⊇ what is LIVE + active,
  then deploys `wrangler.jsonc` directly (no DB-generated `-c` file). The earlier
  goal-32 DB-gen path (`wrangler.deploy.json`) was the FX-14 hole — a bare deploy or an
  RLS-hidden `paused` salon dropped a live domain; it is retired. See §3.1.

OpenNext bundling runs on Linux (live-blocker #3); the Windows EPERM-symlink bundle
failure is irrelevant in CI.

### 3.1 Safe deploy — deploys must never tear down domains/vars (FX-14)

`wrangler deploy` (and `opennextjs-cloudflare deploy`, which wraps it) **replaces**
the worker's entire plaintext `vars` set and its custom-domain/route list with
whatever the targeted config declares. Anything that exists only in the Cloudflare
dashboard — not in `wrangler.jsonc` — is **removed** on deploy. goal-14's deploy hit
exactly this: wrangler reported it would drop `demo.corevo.se` + `booking.corevo.se`
and `vars.NOTIFICATIONS_FROM` because they were dashboard-only.

Rules:
- **Prod deploy path = `scripts/deploy-prod.mjs`, never bare `wrangler deploy`.**
  Since **fix-35** the source of truth is ONE committed file: ALL live hostnames —
  the 3 fixed back-office doors, the `*.boka` wildcard, AND every per-customer
  `<slug>.corevo.se` — are `custom_domain`/route entries in committed `wrangler.jsonc`.
  `deploy-prod.mjs` runs the fail-closed validator (committed ⊇ live + active; exit 1
  on drift) then deploys `wrangler.jsonc`. Because the customer domains are now IN the
  base file, even a bare `wrangler deploy` would no longer detach them — but keep
  using `deploy-prod.mjs` for the validator pre-flight + dry-run.
- **Add a new customer domain WITHOUT a deploy:** `node scripts/add-domain.mjs <slug>`
  does both halves — (a) live-attach `<slug>.corevo.se` via the CF Workers Domains API
  (live in seconds, no redeploy) and (b) insert it as a committed `custom_domain` route
  in `wrangler.jsonc` (comment-preserving, idempotent). **Writing the line is a COMMIT,
  not a deploy — you must commit `wrangler.jsonc`** so future deploys re-assert it.
  Needs `CLOUDFLARE_API_TOKEN` with **Zone DNS:Edit** (+ Workers Routes:Edit) for a NEW
  subdomain's DNS+cert; without a token it still file-protects (goes live next deploy).
  `attachWorkerSubdomain` (`lib/cloudflare/worker-domains.ts`) is the runtime twin for a
  future onboarding-auto path; the shared file-edit contract is
  `upsertCustomDomainRoute(wranglerPath, slug)` in `scripts/domain-routes.mjs`.
- **Validator (`gen-deploy-config.mjs`, repurposed from the generator):** guard #1
  LIVE ⊆ FILE (lists CF Workers Domains for our service — sees PAUSED salons too,
  because it reads Cloudflare, not the DB → neutralizes the old anon-RLS trap where a
  `paused` salon was invisible to `tenants_public_read = USING (status='active')`);
  guard #2 ACTIVE ⊆ FILE (anon read, best-effort). After any prod deploy also run
  `node scripts/check_domains.mjs` (exit 0 = all live).
- **Target the right env.** Top-level config = production worker `bokningsplatformen`;
  prod ships via `deploy-prod.mjs` (deploys `wrangler.jsonc` directly — no `-c`
  override). Staging is `wrangler deploy --env staging` (`bokningsplatformen-staging`,
  *.workers.dev, **no** custom domains, `routes: []` → cannot detach prod domains).
- **Prefer CD** (§3): production from a `v*` tag, staging from `push:main`, both on
  Linux. A local deploy is a fallback.
- **Local deploy (Windows, only if unavoidable):** OpenNext's build crashes on the
  `ö` in the repo path, so build from an ASCII copy. ⚠️ **`.env.local` (dev,
  `NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000`) MUST NOT reach the build tree** — Next
  inlines `NEXT_PUBLIC_*` at build time and `.env.local` outranks `.env.production`,
  so a leaked `.env.local` bakes `localhost:3000` into the middleware bundle →
  **every tenant storefront subdomain 404s** (`x-corevo-tenant-kind: unknown`;
  `booking.corevo.se` admin stays up and HIDES it). `/XF .env.local` blocks the
  *copy* but NOT `/PURGE`, so a pre-existing copy survives — delete it explicitly:
  ```
  Remove-Item C:\tmp\kod\apps\web\.env.local,C:\tmp\kod\apps\web\.next,C:\tmp\kod\apps\web\.open-next -Recurse -Force -ErrorAction SilentlyContinue
  robocopy <5-Kod> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local
  pnpm --dir C:\tmp\kod --filter @corevo/web run deploy
  ```
  **Guard (the only check independent of the copy mechanism):** after build, fail if
  `Select-String C:\tmp\kod\apps\web\.next\server\middleware.js localhost:3000` matches.
  **Post-deploy:** verify a REAL tenant storefront (`freshcut.corevo.se` → 200 +
  `x-corevo-tenant-kind: tenant`), not just the admin host.
- **Pre-deploy check (no live deploy needed):** confirm `wrangler.jsonc` still declares
  both custom domains + every remote plaintext var before shipping. The live set is
  read via the Cloudflare API — worker settings `bindings` (plain_text) +
  `GET /accounts/<id>/workers/domains` (filter `service=bokningsplatformen`).

## 4. Secrets & variables (OPS — set once)

### GitHub → repo Settings → Secrets and variables → Actions
**Variables:** `E2E_ENABLED=true` (efter seedad staging) och
`PROD_DB_MIGRATION=0116` i production-miljön **först efter verifierad DB-apply**.
**Secrets:**

| Secret | Used by |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit + Workers R2:Edit + Workers Routes:Edit) | deploy |
| `CLOUDFLARE_ACCOUNT_ID` = `0be2655be66efbfa5d9b36721ddae008` | deploy |
| `CF_WORKERS_SUBDOMAIN` (your `*.workers.dev` subdomain) | staging SITE_URL |
| `SUPABASE_ACCESS_TOKEN` | staging-migrationer |
| `STAGING_SUPABASE_PROJECT_REF` | staging-migrationer |
| `STAGING_SUPABASE_DB_PASSWORD` | staging-migrationer |
| `STAGING_SUPABASE_URL` / `PROD_SUPABASE_URL` | build (NEXT_PUBLIC) |
| `STAGING_SUPABASE_ANON_KEY` / `PROD_SUPABASE_ANON_KEY` | build (NEXT_PUBLIC) |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | E2E runtime |

> `PROD_SUPABASE_PROJECT_REF` = `clylvowtowbtotrahuad`.

### Worker secrets (server-only; set with `wrangler secret put NAME [--env staging]`, run in `5-Kod/apps/web`)
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`EMAIL_RELAY_URL` + `EMAIL_RELAY_SECRET` (one.com email relay, goal-14 — see `docs/ops/mejl-egen-smtp.md`),
`SENTRY_DSN` (if used), `CRON_SECRET` (if the cron route checks it),
plus R2 access keys if `lib/r2/upload.ts` uses the S3 API (`R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`).

### Public Worker vars (committed in `wrangler.jsonc`, NOT secrets — FX-14)
`NOTIFICATIONS_FROM` (`Corevo <booking@corevo.se>`, two-o address for SPF/DKIM) and
`R2_PUBLIC_BASE_URL` (the r2.dev public origin) are PUBLIC runtime values read via
`process.env`, so they live as `vars` in `wrangler.jsonc` — committed, not
dashboard-only. A top-level `deploy` replaces the **entire** plaintext var set, so a
dashboard-only value is wiped on the next deploy. Change them in `wrangler.jsonc`
(then redeploy), never only in the dashboard. See §3.1.

> **Build-time vs runtime (live-blocker #1):** every `NEXT_PUBLIC_*` is inlined at
> `next build`. They are set as **build env** in the workflows, NOT as Worker vars.
> Changing them requires a rebuild+redeploy; a runtime Worker var does nothing.

## 5. Live-blocker checklist

| # | Item | Status / action |
|---|------|-----------------|
| 1 | `NEXT_PUBLIC_ROOT_DOMAIN=corevo.se` + `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se` as **build** vars | ✅ wired into both workflows. Without them tenants 404 ("salongen inte tillgänglig"). |
| 2 | Tenant routing: `booking.corevo.se`=platform done; `frisorN.corevo.se`→Worker | ✅ **`demo.corevo.se` + `booking.corevo.se` are active `custom_domain` routes in `wrangler.jsonc`** (FX-14), bound to the worker and re-asserted on every deploy. Further tenants: add a Custom Domain per tenant **or** the wildcard `*.corevo.se` route (touches the POS zone → needs Zivar's domain approval). |
| 3 | Deploy via CI (Linux), not Windows | ✅ CD runs OpenNext on `ubuntu-latest`. |
| 4 | Stripe `STRIPE_SECRET_KEY` (test) + `STRIPE_WEBHOOK_SECRET` | **OPS.** Webhook **MUST** be a Stripe **Connect** endpoint at `/api/stripe/webhook` (events carry `account`); a plain account endpoint silently never flips bookings to `confirmed`. Verify test-mode: onboarding · payment (`application_fee`=0) · refund · idempotency. |
| 5 | Activate G10: email relay (`EMAIL_RELAY_URL`/`EMAIL_RELAY_SECRET`/`NOTIFICATIONS_FROM` + one.com Edge Function secrets, goal-14), Sentry DSN, CF WAF rate-limit (login/boka), Cron `/api/cron/reminders` | **OPS.** Email = Worker + Edge Function secrets (`docs/ops/mejl-egen-smtp.md`). Sentry = Worker secret. WAF rule = dashboard. Cron = a CF Cron Trigger or external scheduler hitting the route. |
| 6 | R2 binding `corevo-media` | ✅ **Bucket exists** (verified). Binding present in both envs in `wrangler.jsonc`. `R2_PUBLIC_BASE_URL` set as a committed var in `wrangler.jsonc` (r2.dev origin, FX-14) so public image URLs resolve and survive deploys. |
| 7 | Prod-schema matchar Worker-koden | ✅ Prod verifierad till `0116`; checkpoint + `PROD_DB_MIGRATION=0116` krävs av workflowen. |

## 6. Stripe Connect webhook (live-blocker #4 detail)

1. Stripe Dashboard (test mode) → Developers → Webhooks → **+ Add endpoint** →
   choose **"Listen to events on Connected accounts"** (Connect endpoint).
2. URL: `https://booking.corevo.se/api/stripe/webhook` (or staging worker URL).
3. Events: `checkout.session.completed`, `charge.refunded`, `account.updated`
   (match what `app/api/stripe/webhook/route.ts` handles).
4. Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` Worker secret.
5. Local test: `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`
   then `stripe trigger checkout.session.completed`.

## 7. Rollback

**Worker (Cloudflare):**
```
cd 5-Kod/apps/web
pnpm exec wrangler deployments list                 # find the last-good version id
pnpm exec wrangler rollback [<version-id>]           # add --env staging for staging
```
`wrangler rollback` re-points traffic to a previous version without rebuilding.

**Code:** revert the offending commit/tag and re-run CD, or push a fixed tag.
Production is tag-gated, so reverting the tag + cutting a new one is the clean path.

**Database:** migrations are **forward-only**. Never edit an applied migration —
add a new compensating migration and deploy it. Take a Supabase backup/PITR
checkpoint before a risky migration; restore via the Supabase dashboard if needed.
See `docs/ops/backup-restore.md`.

## 8. First production cutover (one-time, OPS)

1. Set all GitHub secrets (§4) + Worker secrets for production.
2. Ta backup-checkpoint, granska/applicera 0083–0088 på prod och verifiera
   `supabase_migrations.schema_migrations`; sätt därefter `PROD_DB_MIGRATION=0116`.
3. Decide tenant routing (#2) with Zivar; add Custom Domains or the wildcard route.
4. Register the Stripe **Connect** webhook (§6); set `STRIPE_WEBHOOK_SECRET`.
5. Tag `vX.Y.Z` → approve the `production` environment → CD deploys.
6. Smoke: `frisor1.corevo.se` loads as Frisör Ett (not "salongen inte tillgänglig");
   a test booking with a Stripe test card flips to `confirmed` via the Connect webhook.
