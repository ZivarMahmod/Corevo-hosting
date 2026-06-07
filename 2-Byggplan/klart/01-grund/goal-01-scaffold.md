## Goal 01 — Projektscaffold (Next.js + Supabase + Cloudflare + repo + env)

> ⛔ **DOMÄN-SPÄRR:** Tenants kör LIVE på `*.corevo.se` (frisor1.corevo.se, frisor2.corevo.se …), admin/plattform på `booking.corevo.se`. Wildcard `*.corevo.se` → plattform-Workern (Cloudflare). corevo.se = goto under bygget. INGEN riktig kunddomän, INGEN CNAME på kundnamn förrän Zivar godkänner. localhost (frisor1.localhost:3000 / `?tenant=`) OK för dev.

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
- **Tenant-resolution via subdomän-parse:** `lib/tenant.ts`-stub ska parsa `host` → slug genom att strippa `ROOT_DOMAIN` (`corevo.se`): `frisor1.corevo.se` → slug `frisor1`. Reserverade subdomäner (`booking`, `admin`, `app`, `www`, `api`) kan ALDRIG bli tenant. Lokalt under dev: subdomän-på-localhost (`frisor1.localhost:3000`) ELLER fallback `?tenant=frisor1` / `/t/frisor1`. Env `NEXT_PUBLIC_TENANT_MODE` (`localhost` | `live`) + `NEXT_PUBLIC_ROOT_DOMAIN` (default `localhost:3000` i dev, `corevo.se` live) styr host-parse. Auth-cookie-domän = `.corevo.se` (session över subdomäner). Ingen riktig kunddomän i config.
- `package.json`-scripts: `dev`, `build`, `lint`, `preview` (opennext), `deploy` (opennext→wrangler).
- ESLint + Prettier + `tsconfig` strikt.
- `git init`, `.gitignore` (node_modules, `.env*` utom `.env.example`, `.open-next/`, `.wrangler/`).
- En "hello"-route `/` som renderar tenant-neutral landing-placeholder och bekräftar Supabase-anslutning server-side.

**Utanför scope:**
- Inga DB-tabeller/migrations (det är G02).
- Ingen affärslogik, ingen auth-UI.
- Ingen Stripe.
- **Ingen riktig kunddomän, ingen CNAME på kundnamn, ingen Cloudflare custom hostname** — det är SENARE (G08, spärrat). Tenants körs på `*.corevo.se`-subdomäner (test/live under bygget) + localhost för dev. Wildcard-DNS-deploy (`*.corevo.se` → plattform-Workern) FÖRBEREDS i config men själva DNS-aktiveringen körs när Zivar säger till.

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
- Tenant-stub parsar subdomän → slug: `frisor1.corevo.se` → `frisor1` (och lokalt `frisor1.localhost:3000` ELLER `?tenant=frisor1`/`/t/frisor1` ger samma tenant-id). Reserverade subdomäner (`booking`/`admin`/`app`/`www`/`api`) löser INTE till en tenant. Ingen riktig kunddomän eller CNAME på kundnamn finns i repo/config.

**Tekniska noter:**
- `.env.example`-nycklar: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TENANT_MODE` (`localhost`|`live`), `NEXT_PUBLIC_ROOT_DOMAIN` (default `localhost:3000` i dev, `corevo.se` live), `NEXT_PUBLIC_PLATFORM_HOST` (default `booking.corevo.se`), `NEXT_PUBLIC_RESERVED_SUBDOMAINS` (default `booking,admin,app,www,api`), `AUTH_COOKIE_DOMAIN` (default `.corevo.se` live; tom i dev), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `STRIPE_SECRET_KEY` (placeholder), `STRIPE_WEBHOOK_SECRET` (placeholder), `STRIPE_CONNECT_CLIENT_ID` (placeholder).
- OpenNext på Cloudflare: använd `@opennextjs/cloudflare` (Workers-runtime, ej Pages) — det är 2026-rekommendationen för Next App Router på CF.
- Service role-nyckeln får ALDRIG exponeras mot klient; använd endast i server-kod/Actions.
- Förbered för multi-tenant: lägg en tom `lib/tenant.ts` med `getTenantFromHost(host)`-stub (subdomän-parse → slug) som G03 fyller.
- **Tenant-resolution via subdomän-parse:** `request.headers.get('host')` ger `frisor1.corevo.se` live (och `frisor1.localhost:3000` på dev). Stub:en strippar `NEXT_PUBLIC_ROOT_DOMAIN` från host → slug, kollar slug mot `NEXT_PUBLIC_RESERVED_SUBDOMAINS` (reserverad → ej tenant, t.ex. `booking`→plattform), med fallback till `?tenant=`/`/t/`-segment under dev. NB: Next.js 16 byter namn `middleware.ts`→`proxy.ts` (funktion `proxy`) — följ aktuell version vid scaffold.
- **Auth-cookie över subdomäner:** Supabase auth cookie-domän sätts till `.corevo.se` (`AUTH_COOKIE_DOMAIN`) så session funkar över `frisorN.corevo.se` + `booking.corevo.se`. Data-isolering sker via RLS + `tenant_id`, ALDRIG via cookie.
- **Wildcard-deploy förbereds:** `*.corevo.se` → plattform-Workern (Cloudflare) konfigureras i wrangler/route-config men DNS-aktiveringen körs när Zivar säger till. Ingen CNAME på riktiga kundnamn, ingen Cloudflare for SaaS / custom hostname i config. corevo.se = goto under bygget; riktiga kunddomäner rörs INTE förrän Zivar godkänner.
