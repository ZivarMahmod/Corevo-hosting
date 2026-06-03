## Goal 11 — E2E-test & deploy-pipeline

**Spår:** Härdning · **Beror på:** G10 · Release.

**Mål:** E2E-tester över kritiska flöden + CI/CD som bygger & deployar Next→Cloudflare (OpenNext/Workers), staging→prod. PLUS: stäng live-blockers funna 2026-06-01 så `frisorN.corevo.se` laddar skarpt.

**E2E (Playwright):** publik sajt per tenant · boka end-to-end (gäst+inloggad, Stripe testläge) · av-/ombokning · personal time_off→slots · salon_admin tjänst+branding→publikt · platform_admin skapar tenant.

**CI/CD:** PR = lint+typecheck+unit+E2E. CD = `opennextjs-cloudflare build`→`wrangler deploy` staging (auto) + prod (tag/manuell). Supabase-migrations i pipeline. Staging/prod env+secrets i CF.

**Live-blockers (MÅSTE — verifierade live mot Cloudflare):**
1. **`NEXT_PUBLIC_ROOT_DOMAIN=corevo.se`** + `NEXT_PUBLIC_PLATFORM_HOST=booking.corevo.se`. Utan: `frisor1.corevo.se` → "salongen inte tillgänglig" (`lib/tenant.ts` defaultar `localhost:3000`). ⚠️ `NEXT_PUBLIC_*` bakas vid BUILD → sätt som **byggvariabel** + bygg om. Runtime-var hjälper EJ.
2. **Tenant-routing:** `booking.corevo.se`=plattform (klar). `frisor1/2/3.corevo.se`→worker via Custom Domain (test) ELLER wildcard `*.corevo.se` route (explicita POS-poster vinner). ⛔ Wildcard rör POS-zonen = kräver Zivars domän-OK.
3. **Deploy via CI (Linux), ej Windows** — EPERM symlink stoppar lokal bundle; `next build` är grön.
4. **Stripe:** secrets `STRIPE_SECRET_KEY` (test) + `STRIPE_WEBHOOK_SECRET`. ⚠️ webhook MÅSTE vara Stripe **Connect**-endpoint, annars flippar bokning aldrig till confirmed (tyst). Verifiera test-mode: onboarding · betalning (app_fee=0) · refund · idempotens. (Låser upp G09:s overifierade DoD.)
5. **Aktivera G10-overifierat:** `RESEND_API_KEY` (e-post), Sentry-DSN, CF WAF rate-limit (login/boka), Cron-trigger `/api/cron/reminders`.
6. **R2-binding** `corevo-media` — finns; verifiera bindning i deploy.

**Berörda:** `5-Kod/e2e/`, `.github/workflows/`, `playwright.config.ts`, `supabase/migrations/` (CI), deploy-runbook.

**DoD:**
- E2E-specs gröna lokalt + i CI; CI blockerar PR vid lint/type/test-fel.
- CD deployar fungerande staging på Cloudflare.
- **`frisor1.corevo.se` laddar = Frisör Ett skarpt** (white-label, ej "salong inte tillgänglig").
- Testbokning m. Stripe-testkort → confirmed via Connect-webhook.
- Migrations körs auto mot rätt miljö. Runbook m. rollback. `pnpm build` grön.

**Noter:** prod-deploy gate-styrd (tag/approval), aldrig auto-prod från PR. E2E mot staging-Supabase m. seed (ej prod-data). Stripe E2E = testnycklar + Stripe CLI för webhook-events. Node-API:er som ej stöds på Workers ska vara borta efter G10.

---

## ✅ KLART (2026-06-01) — kod-klar + verifierad där möjligt; resten OPS-handoff

**Levererat (kod/config):**
- **Playwright-harness** — `5-Kod/playwright.config.ts` + `5-Kod/e2e/` (helpers, public-site,
  booking, cancel-rebook, staff-timeoff, admin, platform). Tenant nås via `?tenant=<slug>`
  dev-override (cookie-persisterad i middleware) → ingen subdomän/DNS krävs för test.
  `@readonly` = säkra reads (kör var som helst). `@mutating` = skrivningar (ENDAST seedad staging).
- **CI** `.github/workflows/ci.yml` — lint→typecheck→unit→build blockerar PR. Full E2E-job
  (`E2E_ENABLED=true`-gate) bygger m. staging-env, `next start`, kör hela sviten mot staging.
- **CD** `.github/workflows/deploy.yml` — staging auto på `push:main`, prod gate-styrd
  (`v*`-tagg/dispatch + `production`-environment approval). OpenNext-build på Linux (blocker #3),
  Supabase-migrations per miljö, `wrangler deploy [--env staging]`.
- **wrangler.jsonc** — `env.staging` (`bokningsplatformen-staging`, egen R2+observability).
  Top-level = prod-worker `bokningsplatformen` (rör ej den redan live-deployade). Wildcard-routes
  kvar förberedda/kommenterade (kräver Zivars domän-OK).
- **Runbook** `5-Kod/docs/ops/deploy-runbook.md` — topologi, alla GitHub-/Worker-secrets,
  live-blocker-checklista, Stripe Connect-webhook-steg, rollback (`wrangler rollback` + forward-only
  migrations), first-cutover. `5-Kod/e2e/README.md` — körning, seed-creds, staging-seed-gap.

**Verifierat lokalt/mot molnet (via MCP + körning):**
- `pnpm build` GRÖN · lint GRÖN · typecheck GRÖN · unit 43/43 GRÖN.
- `@readonly` E2E **4/4 GRÖNA** mot `next dev` → white-label bevisad: `frisor1`=Frisör Ett,
  `frisor2`=Salong Två, okänd slug→404. (`/?tenant=frisor1` renderar "Frisör Ett"+"Klippning".)
- Supabase `clylvowtowbtotrahuad`: migr 0001–0008 applied. Säkerhets-advisors: bara kända WARN
  (anon-RPC:er är SECURITY DEFINER by design; btree_gist-in-public + leaked-password = pending).
- Cloudflare: Worker `bokningsplatformen` deployad; **R2-bucket `corevo-media` EXISTERAR**
  (minnesnoten "R2 ej aktiverad" var inaktuell — blocker #6 är ✅).

**Kvar = OPS (Zivars händer, ej kod — kan ej fakas):**
1. ✅ Build-vars `NEXT_PUBLIC_ROOT_DOMAIN/PLATFORM_HOST` — inbyggt i workflows.
2. ⏳ Tenant-routing `frisorN.corevo.se` → Custom Domain (säkert) ELLER wildcard `*.corevo.se`
   (rör POS-zon → **kräver Zivars domän-OK**). `booking.corevo.se`=plattform klar.
3. ✅ Deploy via CI (Linux).
4. ⏳ Stripe: secrets + **Connect**-webhook-registrering (annars flippar bokning aldrig→confirmed).
5. ⏳ G10-aktivering: `RESEND_API_KEY`, Sentry-DSN, CF WAF rate-limit, Cron `/api/cron/reminders`.
6. ✅ R2-bucket finns + binding i wrangler.
- ⏳ Staging-Supabase-projekt + seed (för `@mutating` E2E i CI) + `E2E_ENABLED=true` + alla
  GitHub-/Worker-secrets (lista i runbook §4).

**DoD-status:** kod/config + lokalt verifierbart = KLART. Live-deploy/DNS/Stripe-Connect/staging-seed
= OPS-prereqs (dokumenterade i runbook), kan ej slutföras utan Zivars dashboard-/domänåtkomst.
