## Goal 11 — E2E-test & deploy-pipeline

**Spår:** Härdning · **Beror på:** G10 · **Modul:** tvärgående (release)

**Mål:** Säkra release: end-to-end-tester över de kritiska flödena + en CI/CD-pipeline som bygger och deployar Next.js till Cloudflare (OpenNext/Workers) med staging→prod, så att Corevo kan släppas med självförtroende.

**Kontext:** Hela plattformen (M2–M8) byggd och härdad (G10). OpenNext/Cloudflare-konfig finns sedan G01. Supabase migrations finns i repo.

**Omfattning (bygg detta):**
- **E2E-tester** (Playwright) över kritiska flöden:
  - Publik sajt laddar per tenant (white-label).
  - Boka tid end-to-end (gäst + inloggad), inkl. betalning i Stripe-testläge.
  - Kund av-/ombokar.
  - Personal ser bokning + sätter time_off (påverkar slots).
  - Salon_admin skapar tjänst + branding → syns publikt.
  - Platform_admin skapar tenant.
- **CI** (GitHub Actions el. motsv.): lint + typecheck + unit + E2E vid PR.
- **CD:** bygg via `@opennextjs/cloudflare` och deploya med `wrangler` till **staging** (auto) och **prod** (manuell/tag); kör Supabase-migrations som del av pipeline.
- Miljöhantering: staging vs prod env/secrets i CF.
- Deploy-runbook (kort) i repo.

**Utanför scope:**
- Lasttest/perf-budget (senare).
- Multi-region/avancerad infra.

**Berörda områden/filer:** `5-Kod/e2e/`, `5-Kod/.github/workflows/`, `5-Kod/playwright.config.ts`, `5-Kod/supabase/migrations/` (CI-körning), deploy-runbook i `5-Kod/README` eller `2-Byggplan`.

**Steg:**
1. Sätt upp Playwright + config (mot lokal/preview-miljö med seedad demo-tenant).
2. Skriv E2E-specs för de kritiska flödena ovan (Stripe i testläge).
3. CI-workflow: install, lint, typecheck, unit, E2E.
4. CD-workflow: `opennextjs-cloudflare build` → `wrangler deploy` till staging; manuellt/tag-gate till prod.
5. Lägg Supabase migration-steg i pipeline (db push mot rätt miljö).
6. Konfigurera CF secrets för staging/prod.
7. Skriv kort deploy-runbook (rollback ingår).
8. Kör pipeline grön på staging.

**Verifieras (DoD):**
- Alla E2E-specs gröna lokalt och i CI.
- CI blockerar PR vid fel (lint/type/test).
- CD deployar en fungerande staging-miljö på Cloudflare; publik sajt + boka-flöde funkar live.
- Migrations körs automatiskt mot rätt miljö.
- Runbook beskriver deploy + rollback.
- `pnpm build` grön.

**Tekniska noter:**
- Deploy: `@opennextjs/cloudflare` bygger Worker; `wrangler deploy` med R2-binding + secrets. Verifiera runtime-kompatibilitet (Node-API:er som inte stöds på Workers ska redan vara borta efter G10).
- E2E mot en isolerad staging-Supabase med seed (inte prod-data).
- Stripe E2E: använd testnycklar + Stripe CLI/test-events för webhook.
- Prod-deploy bör vara gate-styrd (tag/manuell approval); aldrig auto-prod från PR.
