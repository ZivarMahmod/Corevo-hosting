# BRIEF-DB-020: Tenant-data & onboarding-komplettering (namn, stad, roll-väljare)
Thinking: 🔴 Think hard (schema, men additivt)

> ## ✅ KLAR (2026-06-05) — migration 0024, render-verifierad, oberoende granskad
> **Schema (additivt):** `0024_tenant_city_and_owner_name` applicerad — `tenants.city` + `users.full_name` (text, nullable), idempotent (2× rent), `packages/db/types.ts` regenererad. **#14 Stad:** input i onboarding steg 1 + `listTenants.city` + översikt Stad-kolumn `t.city ?? '—'` (render-verifierad: kolumn finns, ärlig "—" på 7 tenants, datadriven — ej hårdkodad). **#10 Ägar-namn:** `createTenant` skriver `users.full_name=ownerName` (+ behåller auth-metadata) och läses i tenant-detalj Ägare-kort + salonger-kortgrid (RLS `users_rls` platform-admin cross-tenant, EN batchad läsning, ingen N+1). **#11 Roll:** seam `resolveOwnerRole` (default salon_admin, byte-identiskt; `Object.hasOwn` ej `in` → prototyp-nycklar säkra) i egen pure-modul `lib/platform/owner-role.ts` (INTE i 'use server'-filen) + ärligt roll-FAKTUM i steg 5 (Badge+text, INGEN fejk/disabled väljare) + hidden `owner_role`. **Riktig multi-roll-väljare = goal-21** (RBAC-taxonomi, gatad — bygger inte den här ovanpå ett gissat schema). **Determinism:** ägar-läsningarna ordnar `created_at` (FreshCut har 2 salon_admins → äldsta vinner stabilt). **Gate:** typecheck 0 · lint 0 · **vitest 215** (+9 goal-20: payload-assertions city/full_name/role_id + prototyp-nyckel + listTenants city/ownerName). Oberoende adversariell granskning: 1 HIGH (`in`→prototyp-hål, fail-closed men foot-gun inför goal-21) → FIXAD + tester pinnar kontraktet. **Render-verifierad** inloggad super_admin (0 console-fel): onboarding steg 1 Stad-fält, steg 5 ärligt roll-faktum, översikt Stad-kolumn, tenant-detalj Ägare-kort (ärlig fallback "Salongsägare" tills namn seedat). **Build-fel fångat av render** (Server Action sync-export) som typecheck/lint/vitest INTE fångade. **DEPLOYAD LIVE** worker `5522bc78-c99a-40e5-8ae9-ac71edda9ba0` (rollback `562c09ad-87f3-4896-9944-98e1c1b29a81`); middleware.js grep-guard 0. **Prod-smoke = no-regression** (corevo.se 200 · admin 200 · booking 307→login · freshcut 200 + tenant-kind=tenant) — täcker INTE goal-20-ytorna (auth:ade plattform-sidor bakom login); **goal-20-ytorna är render-verifierade på lokal harness**, prod-smoken bevisar bara att POS/storefront/plattform-boot är orörda. Pushad.
> **⚠️ Populerad läsväg (riktig stad/namn synlig live) EJ render-bevisad** — prod-data-seed nekades av auto-läget (fabricerad data i delade tenant-rader ligger utanför build/deploy-auktoriseringen; live-harness kör mot moln-DB). Bevisad mekaniskt: unit-tester på SELECT-kolumn + insert-payload + granskning av läsvägen. Zivar kan seeda/auktorisera för live-screenshot vid behov.

## Mål
Ge de fält som onboarding-/översikts-UI lovar en riktig DB-koppling hela vägen: ägarens namn ska sparas OCH läsas, salongens stad ska kunna fyllas i och visas, och ägarens roll ska vara ett riktigt val (inte hårdkodat). Allt enligt regeln "syns i UI → finns i DB med skriv- och läsväg".

## Lägeskoppling
- Audit noder #10 (ägar-namn = död skrivning), #11 (roll-väljare saknas, "& roll" kosmetiskt), #14 (Stad hårdkodat "—").
- Plan `2-Byggplan/AUDIT-FIX-PLAN-superadmin-2026-06-04.md` → GOAL-20.
- Zivar-regel: "om jag byter salongnamn ska jag se det i databasen direkt" — UI måste ha direkt tråd till backend.

## Kontext (verifierade ankare)
- `createTenant` — `lib/platform/actions.ts:42-208`. Skapar `roles {tenant_id, name:'salon_admin', level:6}` (~142), inserter `users {id, tenant_id, email, role_id, status}` (~177), skickar `user_metadata.full_name = ownerName` till `inviteUserByEmail` (~163). **`public.users` har ingen namn-kolumn** → namnet hamnar bara i auth-metadata som ingen vy läser = död skrivning.
- `CreateTenantForm.tsx` — steg-label `['Namn & subdomän','Temamall','Bokningsvariant','Token-branding','Ägare & roll']` (~79). "Ägarens namn" via hidden input (~136). **Ingen roll-väljare finns** — roll hårdkodas salon_admin/level 6 i createTenant.
- `tenants`-tabell (`0001_core_schema.sql`) — ingen `city`-kolumn. `roles` (`0001`:57) — `{id, tenant_id, name, level(1-8), created_at}`.
- `listTenants` (`tenants.ts:29`) returnerar `TenantListItem {id,slug,name,status,plan,billingModel,createdAt}` — utöka med `city` (+ `ownerName` om vyn ska visa ägare).
- Översikt: `app/(platform)/platform/page.tsx:251` Stad-kolumn ("—").
- Nästa migrationsnummer: **0023** (men 0023 kan vara taget av GOAL-18 om den körs först → använd nästa lediga; kör `ls migrations/` först).

## Berörda filer
- `5-Kod/supabase/migrations/00NN_tenant_city_and_owner_name.sql` — NY. `alter table public.tenants add column if not exists city text;` + (val A) `alter table public.users add column if not exists full_name text;`. Idempotent.
- `5-Kod/apps/web/lib/platform/actions.ts` — `createTenant`: skriv `tenants.city` från formuläret; skriv ägarnamn till vald lagringsplats (val A: `users.full_name`); använd vald `role_id` (steg 5) istället för hårdkodad salon_admin.
- `5-Kod/apps/web/components/platform/CreateTenantForm.tsx` — lägg stad-fält (steg 1 eller 5) + riktig roll-väljare i steg 5.
- `5-Kod/apps/web/lib/platform/tenants.ts` — `listTenants` returnerar `city` (+ `ownerName` om visad).
- `5-Kod/app/(platform)/platform/page.tsx` — Stad-kolumn (~251) renderar `t.city ?? '—'` (ärlig tom tills ifyllt).
- Ev. en redigera-tenant-vy (om sådan finns för att ändra stad i efterhand) — sök `updateTenant` i actions.ts och trådа `city` dit.
- Test: utöka/lägg test för createTenant-skrivning + listTenants city.

## Beslut att fatta i implementeringen (välj A, dokumentera)
- **Ägar-namn lagring:** **Val A (rekommenderas)** = `users.full_name`-kolumn (läsbar i plattform/salong-vy, RLS täcker redan `users`). Val B = läs `auth.user_metadata.full_name` i vyn (ingen kolumn, men kräver admin-klient för att läsa auth-metadata cross-tenant → tyngre). **Default: A.**

## Steg
1. `ls 5-Kod/supabase/migrations/` → fastställ nästa lediga nummer. Skriv migrationen: `tenants.city` (text, nullable) + `users.full_name` (text, nullable). Idempotent (`add column if not exists`). Regenerera `packages/db/types.ts`.
2. **Roll-väljare (steg 5):** lägg en `<select name="owner_role">` i `CreateTenantForm.tsx` med de globala/relevanta rollerna (minst `salon_admin`; ev. fler ur `roles` där `tenant_id is null`). I `createTenant`: slå upp/skapa rätt `roles`-rad för valet och sätt `users.role_id` därifrån — ta bort den hårdkodade salon_admin-vägen MEN behåll salon_admin som default om inget valts (byte-identiskt beteende vid tomt val).
3. **Stad-fält:** lägg `<input name="city">` i formuläret. I `createTenant`: `update/insert tenants.city`. (Stad är inte hemlig → ingen RLS-special.)
4. **Ägar-namn:** i `createTenant` skriv `users.full_name = ownerName` (val A) PARALLELLT med befintlig `user_metadata`-skrivning (behåll den, den skadar inte). Nu finns en läsbar källa.
5. **Läsväg:** `listTenants` returnerar `city` (+ `ownerName` från `users.full_name` om översikten ska visa ägare). `page.tsx` Stad-kolumn renderar `t.city ?? '—'`.
6. Tester + typecheck + lint gröna.

## Verifiering
- [ ] Migration applicerad: `tenants.city` + `users.full_name` finns (`\d tenants`, `\d users`). Idempotent (kör 2× → ingen error).
- [ ] Skapa salong i onboarding med stad + namn + rollval → **direkt synligt i DB**: `select city from tenants where slug=...` = ifyllt; `select full_name, role_id from users where ...` = ifyllt + rätt roll. (Zivars "se det i databasen direkt"-test.)
- [ ] Översikt visar riktig stad för den nya salongen; tom stad = "—" (ärlig), inte hårdkodat.
- [ ] Roll-väljare: välj en annan roll → `users.role_id` pekar på den; inget val → salon_admin default (oförändrat).
- [ ] Ägarnamn läses i vyn (om visad) ur `users.full_name`, inte död metadata.
- [ ] vitest + typecheck + lint gröna. POS `corevo.se`+`admin.corevo.se` → 200.

## Anti-patterns
- Lägg INTE namn enbart i `user_metadata` igen (det var den döda skrivningen) — `users.full_name` är läskällan.
- Hårdkoda INTE roll längre — men behåll salon_admin som säkert default vid tomt val (ingen regression).
- Migration MÅSTE vara `if not exists`-idempotent + rollback. Inget destruktivt.
- Visa INTE stad som "—" hårdkodat — rendera den riktiga kolumnen (tom = ärlig tom).

## Kopplingar
- Roll-väljaren matar GOAL-21 (RBAC) — rollerna som väljs ska vara de RBAC definierar.
- #14 Stad var "lämnad" i GOAL-19 → färdig här.

## Rollback
- Kod: `git revert` + redeploy.
- DB: `alter table public.tenants drop column if exists city;` + `alter table public.users drop column if exists full_name;` (additiva kolumner → drop är rent; gör bara om inga andra goals hunnit förlita sig på dem).
