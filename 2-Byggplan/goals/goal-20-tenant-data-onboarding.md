# BRIEF-DB-020: Tenant-data & onboarding-komplettering (namn, stad, roll-väljare)
Thinking: 🔴 Think hard (schema, men additivt)

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
