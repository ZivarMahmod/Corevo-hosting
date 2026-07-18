# Plan 008: Tidsrobusthet — inget ska tyst sluta funka (prune-svep, retention, versionspinnar, CI-runtime)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/apps/web/app/api/cron .github/workflows/ci.yml 5-Kod/apps/web/lib/stripe/client.ts "5-Kod/apps/web/app/(admin)/admin/kunder"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Why this matters

Ägaren vill vara 1000% säker på att inget tidsbaserat tyst går sönder. En
robusthetssvep hittade tio tidsbomber. De delas i tre klasser: **obegränsad tillväxt**
(rader/lagring som aldrig gallras), **frysta versioner** (pinnar utan bump-process
som driver isär från runtime), och **EOL-runtime i CI**. Alla har låg fix-effort och
tydlig verifiering. Detta är inte en enskild bugg — det är att stänga hela klassen
"funkar idag, kraschar om N månader".

## Status

- **Priority**: P2
- **Effort**: M (många små, oberoende delsteg)
- **Risk**: LOW–MED (Stripe-apiVersion-pin och CI-node-bump kan avslöja latenta
  inkompatibiliteter — därför verifieras varje steg för sig)
- **Depends on**: mjuk koppling till plan 001 + 005 (samma cron-område — se nedan)
- **Category**: tech-debt / robustness
- **Planned at**: commit `6cdd690`, 2026-07-17

## KOORDINERING med andra planer

- **Plan 001** lägger `prune_expired_shop_reserves()` i
  `app/api/cron/pending-expiry/route.ts`. **Detta plan (008) steg 1** lägger
  `prune_expired_slot_holds()` på SAMMA ställe. Gör 001 först, eller lägg båda i samma
  redigering. Kör dem INTE i parallella worktrees mot samma fil.
- **Plan 005** härdar `.github/workflows/cron-booking.yml` (workflow_dispatch + larm).
  Detta plan rör `ci.yml` (annan fil) — ingen konflikt, men CRON-rotationen (steg 5)
  hör ihop med 005:s cron-arbete; nämn korsvis i commits.

## Current state

Repo: pnpm-monorepo i `5-Kod/`. Kommandon från `5-Kod/`. Migrationskonvention:
ny numrerad fil, filnamnskommentar på rad 1, körs av operatören.

Verifierade fynd (file:line):

1. **`slot_holds` sveps aldrig.** `supabase/migrations/0014_slot_holds.sql:183` —
   `prune_expired_slot_holds()` finns + är grantad. **Noll anropare** i repot
   (verifierat: grep utanför migrationsfilen = 0 träffar). Kontrast:
   `prune_expired_shop_reserves` anropas inline i shop-RPC:er. Läsvägen självläker
   (`expires_at <= now()` ignoreras) men raderna ackumuleras för evigt →
   index-/tabellsvällnad på tillgänglighetsläsningen.
2. **`site_revisions` obegränsad publicerad historik.**
   `supabase/migrations/0080_site_revisions.sql` — varje publicering lägger en
   full-site JSONB-snapshot per tenant, immutabel, ingen cap/prune.
3. **`contact_messages` ingen retention** (PII/GDPR-lagringsminimering).
   `supabase/migrations/0057_...:102` — permanent lagring av kontaktformulär.
4. **CI kör Node 20 (EOL 2026-04-30), deploy kör Node 22.**
   `.github/workflows/ci.yml` — `quality`- och `e2e`-jobben `node-version: 20`;
   `.github/workflows/deploy.yml` `node-version: 22`. Grön CI ≠ prod-runtime-paritet.
5. **Stripe-SDK utan `apiVersion`-pin + caret.**
   `apps/web/lib/stripe/client.ts:17` — `new Stripe(key, { httpClient })` utan
   `apiVersion`. `apps/web/package.json:31` — `"stripe": "^22.2.0"` (flytande).
   Nästa bump kan tyst ändra webhook-payloadformer.
6. **`CRON_SECRET` icke-konstanttid + ingen rotation.**
   `app/api/cron/pending-expiry/route.ts:18` + `app/api/cron/reminders/route.ts:17` —
   `header === \`Bearer ${secret}\``.
7. **"NY KUND"-chip på UTC-månad, inte tenant-lokal.**
   `app/(admin)/admin/kunder/[id]/page.tsx:74` —
   `customer.firstSeenAt.slice(0,7) === new Date().toISOString().slice(0,7)`. Nära
   månadsskifte i svensk tid (00–02 lokalt) visas fel märke. Repot har redan
   `todayInTz`-hjälpare (`lib/admin/dates.ts`).

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | gröna               |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope**:
- `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts` (slot-holds-prune)
- Ny migration `5-Kod/supabase/migrations/00XX_retention_sweeps.sql` (site_revisions-cap
  + contact_messages-retention-funktioner)
- `.github/workflows/ci.yml` (Node 20 → 22)
- `5-Kod/apps/web/lib/stripe/client.ts` (apiVersion-pin) + `apps/web/package.json`
  (exakt-pinna stripe)
- `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts` + `reminders/route.ts`
  (konstant-tidsjämförelse)
- `5-Kod/apps/web/app/(admin)/admin/kunder/[id]/page.tsx` (UTC-chip)
- `5-Kod/docs/ops/` (versions- och rotationsnoteringar)

**Out of scope**:
- `.github/workflows/cron-booking.yml` — plan 005 äger den.
- `prune_expired_shop_reserves` — plan 001 äger det anropet (lägg slot-holds bredvid).
- `@supabase/ssr`-uppgraderingen (TID-05) — dokumenteras bara här, uppgraderas ej
  (auth-kontraktet är fryst G02; egen plan).
- `compatibility_date`-bump (TID-10) — dokumenteras som periodisk översyn, ändras ej nu.
- Presentkort-utgång (TID-07) — inert modul; hör till betal-rails-aktiveringen, egen plan.

## Git workflow

- Direkt på `main`. En commit per delsteg. Stil: `fix(robusthet): …` / `ci: …` / `chore(db): …`.
- Pusha inte; deploy + migrationskörning är operatörens steg.

## Steps

### Step 1: Svep utgångna slot_holds i cron (samordna med plan 001)

I `app/api/cron/pending-expiry/route.ts`: lägg ett anrop till
`admin.rpc('prune_expired_slot_holds')` bredvid de befintliga sweep-anropen (samma
felhanteringsmönster; fel får inte fälla övriga svep). Inkludera antalet i loggen.

**Verify**: `grep -n "prune_expired_slot_holds" apps/web/app/api/cron/pending-expiry/route.ts` → 1 träff; `pnpm typecheck` → exit 0.

### Step 2: Retention-migration (site_revisions-cap + contact_messages)

Ny migration (filnamnskommentar rad 1). Två SECURITY DEFINER-funktioner:
- `prune_site_revisions_history()`: behåll de N (t.ex. 20) senaste `published` per
  tenant + den enda draften; radera äldre. (Immutabiliteten i 0080 gäller UPDATE, inte
  DELETE — verifiera att triggern inte blockerar DELETE; gör den det → STOP och rapportera.)
- `prune_contact_messages(p_months int default 18)`: radera/anonymisera
  `contact_messages` äldre än p_months. Anropa båda från cron-rutten i steg 1 (eller
  ett glesare schema — de behöver inte köra var 15:e min; om enkel: lägg dem i samma
  rutt bakom en dag-modulo-guard, annars notera i ops att de körs manuellt/pg_cron).

**Verify**: migrationsfilen finns, rad 1 = filnamnskommentar; `pnpm typecheck` → exit 0.

### Step 3: CI-runtime till Node 22

I `.github/workflows/ci.yml`: byt `node-version: 20` → `22` i `quality`- och
`e2e`-jobben (matcha deploy.yml). Kör inget lokalt bygge — CI validerar vid push.

**Verify**: `grep -c "node-version: 20" .github/workflows/ci.yml` → 0;
`grep -c "node-version: 22" .github/workflows/ci.yml` → ≥1. Kör lokalt `pnpm test && pnpm build`
under din lokala Node för att fånga uppenbar inkompatibilitet.

### Step 4: Pinna Stripe apiVersion + exakt version

I `apps/web/lib/stripe/client.ts`: sätt explicit `apiVersion` i `new Stripe(...)` —
använd den version SDK 22.x defaultar till (slå upp i `stripe`-paketets typer:
`Stripe.LatestApiVersion`, eller den sträng deras changelog anger för v22; sätt exakt
den, ändra inte beteendet). I `apps/web/package.json`: byt `"^22.2.0"` → exakt
`"22.2.0"` (eller den version som är installerad enligt lockfilen — pinna det som
FAKTISKT körs, inte en nyare).

**Verify**: `grep -n "apiVersion" apps/web/lib/stripe/client.ts` → 1 träff;
`grep -n '"stripe"' apps/web/package.json` → ingen caret (`^`); `pnpm test` → gröna
(webhook-testerna om de finns; annars typecheck).

### Step 5: Konstant-tidsjämförelse för CRON_SECRET

I båda cron-rutterna: byt `header === \`Bearer ${secret}\`` mot en konstant-tids-jämförelse
(t.ex. jämför via `crypto.timingSafeEqual` på Buffers av samma längd, eller en
längd-först-guard + timing-safe). Dokumentera i ops (steg 7) en rotationsrutin (byt
Worker-secret + GH-repo-secret ihop).

**Verify**: `grep -rn "timingSafeEqual\|timing" apps/web/app/api/cron/` → ≥1 träff;
`pnpm typecheck` → exit 0.

### Step 6: Fixa UTC-månadschippet

I `app/(admin)/admin/kunder/[id]/page.tsx:74`: byt
`new Date().toISOString().slice(0,7)` mot tenant-lokal månad via befintlig
`todayInTz(tz).slice(0,7)` (importera från `lib/admin/dates.ts`; tenantens tidszon
finns redan i sidans scope — verifiera, annars använd Europe/Stockholm-default som
resten av admin).

**Verify**: `grep -n "toISOString().slice(0, 7)" "apps/web/app/(admin)/admin/kunder/[id]/page.tsx"` → 0 träffar; `pnpm typecheck` → exit 0.

### Step 7: Ops-dokumentation av de frysta invarianterna

I `5-Kod/docs/ops/` (ny/utökad fil): dokumentera de kod-externa tidsinvarianterna som
INTE fixas i kod utan måste övervakas: (a) `@supabase/ssr` 0.10.3-pin + 400-dygns
cookie + refresh-token-policy i Supabase Dashboard (TID-05), (b) `compatibility_date`
periodisk bump-översyn (TID-10), (c) CRON_SECRET-rotationsrutin (steg 5), (d)
presentkort-utgång ska sättas innan betal-rails aktiveras (TID-07).

**Verify**: filen nämner "ssr", "compatibility_date", "CRON_SECRET".

### Step 8: Avlägsna hårdkodade framtidsdatum i DB-testerna (kalenderdaterad bomb)

DB-testerna matar in bokningar på absoluta framtidsdatum, men koden har vakter
(`historical_booking_insert_forbidden` i `0077:488`, `historical_booking_reschedule_forbidden`
i `0077:613`) som kastar när ett datum passerats. När väggklockan når datumet vänder
gröna tester till röda utan kodändring. Verifierade fixtur-datum: `supabase/tests/booking_foundation_0078_test.sql`
(2027-01-01), `atomic_location_admin_booking_0077_test.sql` (2027-01-04),
`rls_location_access_0076_test.sql` (2027-01-04/02-01), `double_booking_test.sql:10`
(2030-01-01), `concurrent_booking.mjs:25` (2031-01-06). Tidigast bomb: **2027-01-01**.
Byt de absoluta datumen mot relativa (`now() + interval '30 days'` el. likn.) så
testerna inte kan rötas av kalendern.

**Verify**: `grep -rn "2027-\|2030-\|2031-" supabase/tests apps/web/... ` → 0 kvar i de
listade filerna (eller bara i kommentarer); DB-testerna körs av operatören mot lokal
supabase.

### Step 9: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → allt exit 0.

## Test plan

- Om cron-rutterna har tester: verifiera att fel bearer nekas efter timing-safe-bytet.
- UTC-chippet: om sidan/hjälparen är enhetstestbar, ett fall vid månadsskifte i tidszon.
- Retention-funktionerna kan inte integrationstestas utan lokal DB — verifieras
  statiskt + operatörskörning (notera i commit: efter applicering, verifiera i SQL
  Editor att `prune_site_revisions_history()` behåller N senaste).

## Done criteria

- [ ] `prune_expired_slot_holds` anropas i cron; `grep` → 1 träff
- [ ] Retention-migration finns (site_revisions-cap + contact_messages)
- [ ] `.github/workflows/ci.yml` kör Node 22 (0 träffar på `node-version: 20`)
- [ ] Stripe har explicit `apiVersion` + exakt-pinnad version (ingen caret)
- [ ] CRON_SECRET jämförs konstant-tid
- [ ] UTC-chippet använder tenant-lokal månad
- [ ] Ops-notis över frysta invarianter finns
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `site_revisions`-immutabilitetstriggern (0080) blockerar DELETE — då kräver
  retention en annan väg; rapportera i stället för att kringgå triggern.
- CI-node-bumpen (steg 3) får `pnpm test`/`pnpm build` att faila lokalt på Node 22 —
  rapportera felet (då finns en verklig 20→22-inkompatibilitet som är egen utredning).
- Stripe `apiVersion`-strängen går inte att fastställa säkert för installerad v22 —
  rapportera; sätt inte en gissad version (fel version ändrar payloads).
- Tenantens tidszon finns inte i kundkortssidans scope (steg 6) — använd
  Europe/Stockholm-default och notera antagandet, faila inte.

## Maintenance notes

- Retention-trösklarna (N revisioner, 18 mån kontakt) är förslag — bekräfta mot en
  faktisk lagrings-/juridikpolicy när sådan finns.
- När `@supabase/ssr` någon gång uppgraderas: cookie-maxAge-beteendet kan ändras
  (TID-05) — omtesta "logga in en gång på iPad"-flödet.
- Reviewer: kontrollera att alla nya prune-anrop är best-effort (fel fäller inte
  övriga svep) och att retention-funktionerna är tenant-korrekta (raderar inte
  cross-tenant).
