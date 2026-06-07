# BRIEF-DB-021: RBAC-rättigheter — riktig behörighetsmatris (lagring + redigering + enforcement)
Thinking: ⚫ Ultrathink (auth/behörighet — kräver rollback + Zivar-OK före prod-deploy)

---
> ## ✅ KOD KLAR + VERIFIERAD — 🔒 DEPLOY GATED (väntar Zivar-OK), 2026-06-05
> - **Migration `0025_role_permissions.sql`** skriven + **applicerad på prod av Zivar via SQL** (`list_migrations` ✓). Seed = diff-0 mot gamla `ROLE_CATALOG` (5 roller × 7 områden, exakt).
> - **Bygge:** `role_permissions`-tabell + RLS (läs=authenticated, skriv=`private.is_platform_admin()`); editerbar matris (cykla full→own→view→—) + dirty save-bar; enforcement `canWrite()` på `saveBranding` (additivt-restriktiv — kan BARA snäva in, aldrig ge); `super_admin` låst på full (self-lockout-guard, hela batchen avvisas pre-write); table-less fallback till `DEFAULT_ROLE_CATALOG` (rollback-säker).
> - **Gate:** typecheck 0 / lint 0 / **vitest 237/237** grön.
> - **Oberoende adversarial review: GO** — 8 auth-invarianter håller; 2 LOW-fynd åtgärdade (avvisa okänt `role_name` + KNOWN_ROLE_NAMES-test; uppdaterad docstring).
> - **Render-verifierat live** `/roller` (läser DB nu): seedade perms visas, `super_admin`-rad ärligt låst, äkta user-counts, 0 console-fel.
> - **✅ KLAR + LIVE — Zivar bekräftade KEEP (2026-06-05).** goal-21 gick live i worker **`474e1768`** som sido-effekt av goal-22-deployen (stackade commits); Zivar valde behåll-live (han hade redan applicerat migr 0025). Diff-0 by construction (seed = gamla matrisen; bara Zivar kan redigera; `saveBranding`-gate ger salon_admin Branding='own'→canWrite=true → ingen regression). ⚠️ enforcement unit-testad, ej live-körd. Rollback vid behov: `wrangler rollback 562c09ad… --config 5-Kod/apps/web/wrangler.jsonc` (eller fb7473d0 för pre-21).
> - **Not (audit):** `role_permissions_save` loggas under aktörens `tenant_id` (audit_log.tenant_id NOT NULL); `platform@corevo.se` = `tenant_id=demo` → loggas mot demo. Framtida "system-tenant" = städning.
---

## Mål
Gör den hårdkodade behörighetsmatrisen till riktig, lagrad, redigerbar konfiguration: rättigheter sparas i DB, matrisen kan redigeras + sparas i UI, och rättigheterna **enforce:as server-side** (inte bara visas). Modellen ska uttrycka exakt: salong-ägare = avgränsad self-service (branding, öppettider, bild, produkt) utan att störa Zivar; superadmin = full access.

## Lägeskoppling
- Audit nod #7: "Behörighetsmatris HELT HÅRDKODAD. `roles` har bara name+level — inga rättighetskolumner. Read-only, ingen save, ingen action."
- Plan → GOAL-21 (största, bygger på GOAL-20:s roll-väljare).
- Zivar: "superadmin har alla möjligheter (det jag kallade nivå 3), salong-admin är nivå 2 — det handlar om hur mycket tillgång ägaren får vs jag. Kunden ska känna sig fri med sin branding utan att tvinga mig för att byta öppettider, ladda upp bild, lägga in produkt."

## Kontext (verifierade ankare)
- `roles` (`0001`:57): `{id, tenant_id (null=global), name, level(1-8), created_at}`. INGEN rättighetstabell.
- Behörighet enforce:as idag via: `private.is_platform_admin()` + `private.tenant_id()` i RLS (`0002`), `lib/auth/roles.ts` (nivå-trösklar `{2,3,6,8}`), `middleware.ts` step-4b (roll→yta-guard), `requirePortal`/`requirePlatformAdmin` i DAL.
- Matrisen är ren visning: `RolesMatrix.tsx` + `lib/platform/catalog-shared.ts:1` (`PERMISSION_AREAS` = 7 områden: Tenants, Kunder, Bokningar, Fakturering, Branding, Personal, Drift; `Perm = 'full'|'own'|'view'|'—'`) + `catalog.ts:40-81` (`ROLE_CATALOG`, 5 roller × 7 perms hårdkodat). Per-roll-användarantal ÄR äkta (räknas från `users→roles`).
- Roll-namn i bruk: `super_admin`, `salon_admin`, `staff` (+ katalog-only `Support`, `Ekonomi` utan db-roll).

## Berörda filer
- `5-Kod/supabase/migrations/00NN_role_permissions.sql` — NY. Rättighetslagring + seed av nuvarande katalog + RLS.
- `5-Kod/apps/web/lib/platform/catalog.ts` + `catalog-shared.ts` — behåll `PERMISSION_AREAS`/`Perm`-typerna; ersätt hårdkodad `ROLE_CATALOG` med DB-läsning.
- `5-Kod/apps/web/lib/platform/roles-permissions.ts` — NY. Läs/skriv-lager + enforcement-helper `can(role, area): Perm`.
- `5-Kod/apps/web/components/platform/RolesMatrix.tsx` — gör cellerna redigerbara (select/cykla `full→own→view→—`) + save-knapp → server-action.
- `5-Kod/apps/web/lib/platform/actions.ts` — ny `saveRolePermissions`-action (platform_admin-gated, loggar via `logPlatformAction`).
- `5-Kod/apps/web/lib/auth/roles.ts` — koppla enforcement att läsa rättigheterna där relevant (utан att bryta befintliga nivå-trösklar).
- Test: ny `lib/platform/roles-permissions.test.ts` (matris-invariant + enforcement) + uppdatera `lib/auth/roles.test.ts` om enforcement-vägen rörs.

## Datamodell (förslag — bekräfta i implementering)
```sql
-- 00NN_role_permissions.sql
create table if not exists public.role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role_name   text not null,                 -- 'super_admin' | 'salon_admin' | 'staff' | 'support' | 'ekonomi'
  area        text not null,                 -- matchar PERMISSION_AREAS
  perm        text not null check (perm in ('full','own','view','none')),
  updated_at  timestamptz not null default now(),
  unique (role_name, area)
);
-- Seed: exakt nuvarande ROLE_CATALOG (super_admin=full×7, salon_admin=[none,own,own,view,own,own,none], staff=[none,view,own,none,none,none,none], support=[view,view,view,none,none,none,view], ekonomi=[view,none,none,full,none,none,none]).
alter table public.role_permissions enable row level security;
-- Läsning: alla inloggade får läsa matrisen (read-only insyn). Skrivning: bara platform_admin.
create policy role_permissions_read on public.role_permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_write_admin on public.role_permissions for all
  using (private.is_platform_admin()) with check (private.is_platform_admin());
```
- `'—'` i UI = `'none'` i DB (undvik specialtecken i check-constraint).
- Rättigheterna är **globala per roll-namn** (inte per tenant) i v1 — speglar nuvarande katalog. Per-tenant-override = framtida, INTE här.

## Steg
1. `ls migrations/` → nästa lediga nummer. Skriv migrationen (tabell + seed av exakt nuvarande katalog + RLS). Idempotent. Regenerera `packages/db/types.ts`.
2. `roles-permissions.ts`: `getRolePermissions()` (läser tabellen → samma form som gamla `ROLE_CATALOG`), `saveRolePermissions(changes)` (platform_admin), `can(roleName, area)` enforcement-helper.
3. `catalog.ts`/`RolesMatrix.tsx`: byt hårdkodad katalog mot `getRolePermissions()`. Gör cellerna redigerbara (klick cyklar `full→own→view→none` ELLER en liten select) + dirty-state + "Spara"-knapp → `saveRolePermissions` → toast + refresh.
4. **Enforcement (kärnan — får inte vara kosmetik):** välj minst EN riktig server-yta där en rättighet faktiskt avgör utfall (t.ex. en salon_admin-action mot ett område hen har `none`/`view` på nekas server-side via `can(...)` i DAL/action). Bevisa att matrisen STYR, inte bara visar. Bryt INTE befintliga `requirePlatformAdmin`/middleware-guards — lägg rättighets-checken additivt.
5. Tester: matris-invariant (seed = gammal katalog), `can()`-enforcement (roll utan rätt nekas), adversariell roll-check (ingen bypass front→back).
6. typecheck + lint + vitest gröna.

## Verifiering
- [ ] Migration applicerad, `role_permissions` seedat IDENTISKT med gamla `ROLE_CATALOG` (diff: 0). Idempotent.
- [ ] Matris visar samma värden som förr (ingen synlig regression) men läser nu DB.
- [ ] Redigera en cell + Spara → `role_permissions`-rad uppdaterad i DB + `audit_log`-rad (via logPlatformAction).
- [ ] **Enforcement bevisad:** en roll utan rätt på ett område nekas server-side (inte bara dold knapp). Test + manuellt.
- [ ] Frontend-ändring kan ALDRIG ge rättighet utan DB-backning (adversariell: manipulera klient → server nekar).
- [ ] Befintlig rollmatris-guard intakt: super_admin/salon_admin/staff yt-routing oförändrad (kör `e2e/backoffice-routing` om möjligt).
- [ ] POS `corevo.se`+`admin.corevo.se` → 200.
- [ ] ⚫ **Zivar-OK före prod-deploy** (auth-känsligt).

## Anti-patterns
- Enforce ALDRIG rättigheter bara i frontend — DB/server-action är sanningen.
- Bryt INTE `private.is_platform_admin()`/`requirePlatformAdmin`/middleware-guarden — rättighetschecken är ADDITIV ovanpå.
- Seeda matrisen EXAKT som nuvarande katalog (annars tyst behörighetsändring = farligt).
- Inför INTE per-tenant-override i v1 (scope-kryp). Global per roll-namn.
- `super_admin` = `full` på allt får ALDRIG kunna nedgraderas till lockout av Zivar själv (skydda super_admin-raden mot att sätta sig själv `none` på Drift/Tenants — annars utelåsning).

## Kopplingar
- Bygger på GOAL-20 (roll-väljare väljer dessa roller).
- Relaterad parkerad: salong self-service-ytor (branding/öppettider/bild/produkt) — rättigheterna här definierar dem; faktiska salong-UI:t kan vara egen goal.

## Rollback
- Kod: `git revert` + redeploy (faller tillbaka på… nej — om katalogen tagits bort ur koden måste revert återställa den; säkrast: behåll en kod-fallback `DEFAULT_ROLE_CATALOG` så appen funkar även om tabellen droppas).
- DB: `drop table if exists public.role_permissions cascade;` → appen faller tillbaka på `DEFAULT_ROLE_CATALOG` (bygg in den fallbacken = obligatorisk för rollback-säkerhet).
