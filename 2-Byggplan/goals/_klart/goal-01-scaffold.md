## Goal 01 — Projektscaffold (Next.js + Supabase + Cloudflare + repo + env)

**Spår:** Fundament · **Beror på:** — · **Modul:** infra (förkrav för M9)

**Mål:** Sätt upp ett tomt men körbart Next.js-projekt i `5-Kod/` med Supabase-klienter, Cloudflare/OpenNext-deploy-konfig, R2-binding och fullständig env-struktur — så att alla efterföljande goals har en stabil grund.

**Kontext:** `5-Kod/` är tom med egen git (ej initierad). Ingen kod finns. Inga env-filer finns.

**Omfattning (bygg detta):**
- Next.js App Router-projekt (TypeScript, pnpm) i `5-Kod/`.
- Tailwind CSS + en minimal UI-grund (shadcn/ui valfritt men förbered struktur).
- Supabase-klienter enligt 2026 App Router-mönster med `@supabase/ssr`:
  - `lib/supabase/server.ts` (Server Components/Actions, cookie-baserad).
  - `lib/supabase/client.ts` (browser).
  - `lib/supabase/middleware.ts` + rot-`middleware.ts` för session-refresh.
- Cloudflare-deploy via `@opennextjs/cloudflare`: `wrangler.toml`/`wrangler.jsonc` med Workers + R2-bucket-binding (`BUCKET`).
- `.env.example` med alla nycklar (se Tekniska noter). `.env.local` skapas lokalt, gitignoreras.
- `package.json`-scripts: `dev`, `build`, `lint`, `preview` (opennext), `deploy` (opennext→wrangler).
- ESLint + Prettier + `tsconfig` strikt.
- `git init`, `.gitignore` (node_modules, `.env*` utom `.env.example`, `.open-next/`, `.wrangler/`).
- En "hello"-route `/` som renderar tenant-neutral landing-placeholder och bekräftar Supabase-anslutning server-side.

**Utanför scope:**
- Inga DB-tabeller/migrations (det är G02).
- Ingen affärslogik, ingen auth-UI.
- Ingen Stripe.

**Berörda områden/filer:** `5-Kod/` (rot), `5-Kod/app/`, `5-Kod/lib/supabase/`, `5-Kod/middleware.ts`, `5-Kod/wrangler.*`, `5-Kod/.env.example`.

**Steg:**
1. `pnpm create next-app@latest` i `5-Kod/` (TS, App Router, Tailwind, ESLint, src ej obligatoriskt — använd `app/` i rot).
2. Installera `@supabase/supabase-js @supabase/ssr`.
3. Skapa de tre supabase-filerna + `middleware.ts` enligt `@supabase/ssr`-mönstret.
4. Installera `@opennextjs/cloudflare` + `wrangler`. Skapa `open-next.config.ts` och `wrangler` med R2-binding `BUCKET`.
5. Skriv `.env.example` (alla nycklar nedan).
6. Lägg `dev/build/lint/preview/deploy`-scripts.
7. `git init` + commit "G01 scaffold".
8. Kör `pnpm build` och `pnpm lint`.

**Verifieras (DoD):**
- `pnpm build` grön, `pnpm lint` grön.
- `pnpm dev` startar, `/` renderar utan fel.
- `lib/supabase/server.ts` kan instansiera klient utan runtime-fel (med dummy-env).
- `wrangler` config validerar (`wrangler deploy --dry-run` eller `opennextjs-cloudflare build` utan fel).
- `.env.example` finns och committad; `.env.local` gitignoreras.

**Tekniska noter:**
- `.env.example`-nycklar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `STRIPE_SECRET_KEY` (placeholder), `STRIPE_WEBHOOK_SECRET` (placeholder), `STRIPE_CONNECT_CLIENT_ID` (placeholder).
- OpenNext på Cloudflare: använd `@opennextjs/cloudflare` (Workers-runtime, ej Pages) — det är 2026-rekommendationen för Next App Router på CF.
- Service role-nyckeln får ALDRIG exponeras mot klient; använd endast i server-kod/Actions.
- Förbered för multi-tenant: lägg en tom `lib/tenant.ts` med `getTenantFromHost(host)`-stub (subdomän/domän→tenant) som G03 fyller.
