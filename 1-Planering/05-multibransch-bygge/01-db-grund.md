# 01 — DB-grund (verticals · modules · tenant_modules · templates · content_slots)

> Spår 1 av multi-bransch-bygget. Ingång/kontrakt: `00-plan-index.md`. Konfliktbeslut: `06-syntes-beslut.md`. Innehålls-/asset-kontrakt: `03-innehall-asset.md`.
> **Status: KOD SKRIVEN (migration-SQL), EJ KÖRD mot prod, EJ deployad.** Verifierad mekaniskt mot riktig Postgres (PGlite/WASM): apply + idempotens + state-guard + rollback = **0 FAIL**.

Detta spår bygger de RIKTIGA tabellerna bakom motorn (06-syntes konflikt 1: jsonb-genväg ÖVERKÖRD). Håller de delade kontrakten i `00-plan-index.md` ordagrant.

---

## 1. Filer (var de ligger)
Alla i repo:ts migrationsmapp `5-Kod/supabase/migrations/` (numrerad konvention `00NN_*.sql`, fortsätter efter `0025`):

| Fil | Innehåll |
|---|---|
| `0026_multibranch_core.sql` | DDL: `media_assets` (minimal kanonisk stub), `verticals`, `modules`, `templates`, `template_slots`, `content_slots`, `tenant_modules`, `tenants.vertical_id`-kolumn + FK, updated_at-triggers, **state-övergångsvakt** (off→draft = bara super-admin) |
| `0027_multibranch_rls.sql` | RLS + policies för alla nya tabeller + grants |
| `0028_multibranch_seed_backfill.sql` | Seed (frisör-vertical, booking+media_library-moduler, salvia-template) + backfill (befintliga tenants → `vertical_id='frisör'` + `booking:live`) |
| `0029_users_tenant_nullable.sql` | **VALBAR/separat** — lättar `users.tenant_id` NOT NULL-skulden (kör bara vid behov av plattforms-operatör utan tenant) |
| `0026_0029_multibranch_rollback.sql` | Rollback (destruktiv, BARA för SAFE branch — ALDRIG prod) |

---

## 2. Tabeller (delade kontrakt, ordagrant 00/03)

- **`verticals`** (katalog, plattform-ägd) — `key text pk`, `name`, `default_modules jsonb` (preset-states, t.ex. `{booking:live,loyalty:draft,shop:off}`), `default_template text`, `terminology jsonb` (`{staff:Stylist,service:Klippning}`), `rules jsonb`.
- **`modules`** (katalog) — `key text pk`, `name`, `owns_tables jsonb`, `variant_schema jsonb`, `default_config jsonb`, **`default_section_position text`** (06-syntes konflikt 3).
- **`tenant_modules`** (tenant-scopad) — `id`, `tenant_id fk→tenants`, `module_key fk→modules`, `state text check in (off,draft,live,paused) default 'off'`, `config jsonb default '{}'`, `activated_at`, `updated_at`, `created_at`, **`unique(tenant_id,module_key)`**. Bär livscykel + variant + pris-hook.
- **`templates`** (katalog, tenant läser status='active') — `key text pk`, `name`, `tags jsonb` (`{bransch,typ,stil,licens,scope}`), `tokens jsonb` (`{color,font,layout}`), `sections jsonb[]`, `status text check in (draft,active,archived)`. Minimal nu; berikas av spår 02.
- **`template_slots`** (mall-nivå, super-admin write/tenant read) — slot-DEKLARATION per mall (03 §1.2, ordagrant).
- **`content_slots`** (tenant-scopad) — slot-VÄRDE per `(tenant,template,slot)`, diskriminerad union `{asset|text|module}`, `unique(tenant_id,template_key,slot_key)` (03 §1.3, ordagrant). `asset_id → media_assets(id)`.
- **`tenants.vertical_id`** — nullable `text` FK → `verticals(key)` `on delete set null`. Mjuk default, mutabel.
- **`media_assets`** (se §6 — kontrakt-not) — skapas minimal kanonisk här (`if not exists`) så `content_slots.asset_id` resolvar.

---

## 3. RLS (vem ser/skriver vad)

Mönster taget ordagrant ur `0002_rls.sql`/`0023`. Helpers `private.tenant_id()` + `private.is_platform_admin()` (definierade i 0002, search_path-härdade i 0004) återanvänds — **inga nya helpers**. `service_role` (super-admin backend / Edge) bypassar RLS inherent i Postgres → ingen policy behövs för den.

| Tabell | Läsning | Skrivning |
|---|---|---|
| `verticals`, `modules` | alla (`anon`+`authenticated`) | **super-admin** (`is_platform_admin()`) |
| `templates` | alla, men icke-admin ser **bara `status='active'`** | super-admin |
| `template_slots` | alla (tenant/anon read) | super-admin |
| `tenant_modules` | tenant-scopad: `tenant_id = private.tenant_id() OR is_platform_admin()` | samma (+ state-vakt, §4) |
| `content_slots` | tenant-scopad + `anon` public-read (storefront) | tenant-scopad / super-admin |
| `media_assets` | tenant-scopad + `anon` public-read (storefront-bilder) | tenant-scopad / super-admin |

`anon` public-read på `content_slots`/`media_assets` speglar 0004-mönstret: RLS är defense-in-depth, app-lagret (`lib/tenant-data.ts`) filtrerar `tenant_id` för publika queries.

---

## 4. State-maskin + vem får göra övergångar

`tenant_modules.state`: **`off → draft → live → paused`** (och tillbaka mellan draft/live/paused).

- **`off → draft` (modul-AKTIVERING) = BARA super-admin.** (`00-plan-index` LÅST: "Bara Zivar gör off→draft.") Görs HÅRT i DB av triggern `tenant_modules_state_guard` (0026 §9): en INSERT med `state<>'off'` eller UPDATE `off→annat` kräver ett av:
  - `private.is_platform_admin()` (platform_admin-claim i JWT), **eller**
  - `service_role` (backend/Edge med service-key), **eller**
  - direkt DB-kontext utan PostgREST-request (`request.jwt.claims` saknas) = migration/seed/cron/psql (redan privilegierat → seed-migrationen får sätta `booking:live`).
  En vanlig tenant-admin går alltid via PostgREST med JWT som bär `tenant_id` men inte `platform_admin` → **blockeras** (errcode 42501). `activated_at` stämplas vid första aktiveringen.
- **`draft ↔ live ↔ paused`** = tenant-admin tillåts (styrs av `tenant_modules`-RLS, ingen extra vakt). Drift mellan publicerings-states är en tenant-operation; det är bara *aktiveringen* off→draft som är super-admin-spärrad.

> Verifierat: tenant-admin blockeras, platform_admin släpps igenom (PGlite-körning, PASS 3).

---

## 5. Migrationslista + körordning

```
0026_multibranch_core.sql            # tabeller, kolumn, FK, triggers, state-vakt
0027_multibranch_rls.sql             # RLS + policies + grants   (kräver 0026)
0028_multibranch_seed_backfill.sql   # seed + backfill           (kräver 0026+0027)
0029_users_tenant_nullable.sql       # VALBAR — kör separat vid behov
```
Rollback (SAFE branch only): `0026_0029_multibranch_rollback.sql`.

Allt **idempotent** (`if not exists`, `add column if not exists`, `drop policy if exists`→`create`, `on conflict do nothing/update`, FK + guard bakom `pg_constraint`-koll). Säkert att köra om. Build-once-never-delete: 0026–0028 droppar inget.

---

## 6. Kontrakt-noter / öppna punkter

1. **`media_assets` fanns INTE i migrationshistoriken.** `03-innehall-asset.md` antar den ("bygger PÅ befintliga media_assets", referens till DB-schema §2 som aldrig migrerades). `content_slots.asset_id` måste peka någonstans → 0026 skapar en **minimal kanonisk `media_assets`** (`if not exists`, dokumenterade kolumner + additiva `width/height/content_hash/source/library_item_id`). Om spår 03/04 senare äger den blir vår `create` en no-op och kolumnerna additiva. **Rollback droppar den** — kommentera ut den raden om den hunnit få delad data. (Flaggat — ingen riktig krock, men en delad-ägandeskaps-fråga.)
2. **`auth.tenant_id()` vs `private.tenant_id()`:** `01-DB-schema.md` skissar `auth.tenant_id()`, men live-koden + HANDOFF/CLAUDE använder `private.tenant_id()` (06-syntes konflikt 2 LÅST). Vi använder **`private.tenant_id()`**. (Notering till spår 1 i 03 §7 är härmed avbockad.)
3. **`corevo-system`-anchor finns inte** i nuvarande seed (enda tenant = demo→FreshCut, `11111111-…`). Vi skapar **ingen** ny anchor (utanför detta spårs scope). Backfillen scopar generiskt till ALLA befintliga tenants (frisör-default) → inkluderar FreshCut. Inför en anchor senare väljer den sin egen vertical då.
4. **`users.tenant_id` NOT NULL-skulden** lättas i `0029` (separat, valbar) — krävs först när en plattforms-operatör utan tenant behövs. RLS bygger på JWT-claimen, inte kolumnen, så NOT NULL-lättningen bryter ingen isolering.
5. **Launch-branscher** (06-syntes): frisör/barbershop/nagelstudio/restaurang + generell. Seed nu = **bara frisör** (per uppgift) + **booking**-modulen; övriga branscher/moduler utökas lätt med fler `verticals`/`modules`-rader.

---

## 7. Hur jag applicerar på en Supabase-branch

> ALLT på en **SAFE Supabase-branch** (ej prod `clylvowtowbtotrahuad`) tills Zivar säger deploy (06-syntes). Prod = framåt-only, ALDRIG rollback-filen.

**Alt A — Supabase MCP (web/remote, denna miljö):**
1. Skapa branch: `create_branch` (confirm cost först om begärt).
2. Applicera i ordning mot branchen: `apply_migration` med namn `0026_multibranch_core` … `0028_multibranch_seed_backfill` (och `0029` vid behov), eller `execute_sql` med filinnehållet.
3. Kontroll: `list_tables` (se de 7 tabellerna), `get_advisors(type:security)` (RLS-täckning), en `execute_sql`-spotcheck (`select vertical_id, … from tenants where id='11111111-…'`).
4. Funkar det → `merge_branch` när Zivar godkänt. Annars `delete_branch`.

**Alt B — Supabase CLI (lokal stack):**
```
supabase db start
supabase migration up            # kör 0026→0029 i ordning mot lokala stacken
# eller mot en remote branch-länkad db:
supabase db push --db-url "<branch-connection-string>"
```
Filerna ligger redan i `supabase/migrations/` → CLI plockar dem i nummerordning automatiskt. `0029` är medvetet en egen migration; vill du hoppa den, flytta den temporärt ur mappen (den blockerar inte 0026–0028).

**Verifierad lokalt utan branch:** kördes mot PGlite (WASM-Postgres) med en minimal prereq-harness (helpers + `tenants`/`users`/`auth.users` + demo-tenant). Resultat: apply 0026→0029 OK, re-apply 0026–0028 utan dubbletter, state-guard blockerar tenant-admin / släpper super-admin, rollback rensar allt = **0 FAIL**.
