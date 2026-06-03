## Goal 02 — Databas, schema, migrations & RLS (M9 fundament)

**Spår:** Fundament · **Beror på:** G01 · **Modul:** M9 (Databas/Arkitektur)

> **Synkad mot ADR 01 (tenant/tema), 01-DB-schema.md, pengaflöde.** Auth = Supabase Auth + egna tabeller (`users.id = auth.users.id`). `tenant_id` bärs som JWT-claim i `app_metadata` (server-satt). RLS läser claimen via `auth.tenant_id()`. Theming- + avgiftsfält ingår i migrationen. Dubbelbokningsskydd = EXCLUDE-constraint.

**Mål:** Bygg det multi-tenant Postgres-schemat i Supabase med migrations, RLS-policies och seed — fundamentet hela plattformen vilar på. Inget annat spår får starta innan detta är klart.

**Kontext:** G01 klar: Next.js + Supabase-klienter + Cloudflare-konfig finns. Inga tabeller finns i Supabase ännu. Supabase-projekt antas skapat (URL + nycklar i env).

**Auth-modell (ADR 01 §4, hård regel):**
- Supabase Auth håller identitet/lösenord. Egna tabeller länkas: `users.id = auth.users.id` (samma uuid, ingen egen auth).
- `tenant_id` sätts i `app_metadata` via **Custom Access Token Hook** (server-satt, kan EJ manipuleras av klient — aldrig `user_metadata`).
- RLS-policy läser claimen via helper `auth.tenant_id()` som läser `app_metadata.tenant_id` ur JWT. Inga rå joins i policyn.

**Omfattning (bygg detta):**
- Supabase CLI-uppsättning i repo: `5-Kod/supabase/` med `config.toml` och `migrations/`.
- Migrations som skapar kärnschemat (multi-tenant):
  - `tenants` (salong/konto): id, slug, namn, plan, status, stripe_account_id, created_at. (Domäner i egen tabell, se nedan.)
  - `tenant_domains`: id, tenant_id, domain (unik), is_primary, verified. (Domän-lookup i middleware mot denna.)
  - `tenant_settings`: id, tenant_id (unik), payment_mode, **branding jsonb** (tema nivå 1: logo_url, color_primary, font_body), **settings jsonb** (nivå 2: `settings.layout.{nav_variant,hero_variant}`; nivå 3: `settings.custom_override` flagga+ref), **service_fee_type** text check (`'fixed'`|`'percent'`), **service_fee_value** int default 500 (öre vid fixed = 5 kr, annars procent-tal). Se ADR 01 §5 + §7.
  - `users` (kopplad till `auth.users`, `users.id = auth.users.id`): id, tenant_id, email, phone, role_id, status. Roll via `roles`-tabell (8 nivåer), INTE en text-kolumn.
  - `roles`: id, tenant_id (null = global), name, level (int 1-8). `platform_admin`/`super_admin` (nivå 7-8) som globala/null-tenant-roller.
  - `staff` (personal): id, tenant_id, profile_id, titel, aktiv, schema-ref.
  - `services` (tjänster): id, tenant_id, namn, beskrivning, varaktighet_min, pris, kategori, aktiv.
  - `staff_services` (vilken personal gör vilken tjänst): tenant_id, staff_id, service_id.
  - `availability` / `working_hours`: tenant_id, staff_id, veckodag, från, till.
  - `time_off` (frånvaro/undantag): tenant_id, staff_id, från_ts, till_ts, orsak.
  - `bookings`: id, tenant_id, customer_profile_id, staff_id, service_id, start_ts, end_ts, status (`pending`|`confirmed`|`cancelled`|`completed`|`no_show`), pris, notering, created_at.
  - `payments`: id, tenant_id, booking_id, stripe_payment_intent_id, belopp, valuta, status, created_at.
  - `audit_log`: id, tenant_id, actor_profile_id, action, entity, entity_id, meta jsonb, created_at.
- **RLS på samtliga tenant-tabeller**, policy-mönster: `using ( tenant_id = (select auth.tenant_id()) )` (subquery-wrap → planner-cache).
- Hjälpfunktion i SQL: `auth.tenant_id()` (STABLE) som läser `app_metadata.tenant_id` ur `request.jwt.claims`. Ej rå join i policy. Ligger i ej-exponerat schema (`auth`/`private`).
- **Dubbelbokningsskydd (hård DB-garanti):** `create extension btree_gist;` + EXCLUDE-constraint på `bookings`: `exclude using gist (barber_id with =, tstzrange(starts_at,ends_at) with &&) where (status in ('booked','completed'))`. Ej bara app-logik.
- Seed-script: 1 demo-tenant, 1 tenant_settings-rad (branding + service_fee default fixed/500), 1 salon_admin, 1 staff, 3 services, working_hours.
- TypeScript-typer genererade till `5-Kod/lib/database.types.ts`.

**Utanför scope:**
- Ingen UI.
- Ingen Stripe-integration (bara `payments`-tabell finns).
- Ingen e-post/notiser.

**Berörda områden/filer:** `5-Kod/supabase/migrations/`, `5-Kod/supabase/seed.sql`, `5-Kod/lib/database.types.ts`.

**Steg:**
1. Initiera Supabase CLI (`supabase init`), länka projekt.
2. Skriv migration `0001_core_schema.sql` (alla tabeller + index på `tenant_id`).
3. Skriv migration `0002_rls.sql`: aktivera RLS, skapa `auth.tenant_id()`-helper (läser `app_metadata.tenant_id`), skriv policies per tabell (select/all scoped på `tenant_id = (select auth.tenant_id())`; platform_admin/super_admin via global roll/service-role, ej tenant-scopad). Audit append-only (insert+select, ingen update/delete).
4. Skriv `seed.sql`.
5. Kör `supabase db reset` lokalt (eller `db push` mot remote) — verifiera utan fel.
6. Generera typer: `supabase gen types typescript` → `lib/database.types.ts`.
7. Skriv ett litet RLS-testscript (SQL eller `pnpm` test) som bevisar att tenant A inte ser tenant B:s bokningar.

**Verifieras (DoD):**
- Alla migrations kör rent (`supabase db reset`).
- RLS aktiv på varje tenant-tabell (verifiera via `pg_policies`).
- RLS-test: query som tenant A returnerar 0 rader av tenant B:s data.
- `auth.tenant_id()` läser `app_metadata.tenant_id` ur JWT; policy använder `(select auth.tenant_id())`.
- `users.id = auth.users.id` (FK/koppling verifierad mot Supabase Auth, ingen egen auth-tabell).
- `tenant_settings` har **branding + settings jsonb** OCH **service_fee_type + service_fee_value** (default `fixed`/`500`), med RLS.
- **Dubbelbokningsskydd:** EXCLUDE-constraint avvisar två överlappande bokningar på samma `barber_id` (testa: insert som krockar → fel).
- `platform_admin`/`super_admin` (global roll) kan läsa tvärs tenants.
- `lib/database.types.ts` genererad och importeras utan TS-fel.
- `pnpm build` grön.

**Tekniska noter:**
- `tenant_id` PÅ ALLA affärstabeller, `not null`, index på `(tenant_id)` och `(tenant_id, starts_at)` för bookings.
- RLS-policy-mönster: `using ( tenant_id = (select auth.tenant_id()) )`. Subquery-wrap obligatorisk (planner-cache, Supabase best practice).
- `auth.tenant_id()`: STABLE, läser `current_setting('request.jwt.claims')::jsonb -> 'app_metadata' ->> 'tenant_id'`. INTE join mot `users`-tabell (1 user = 1 tenant). Ligger i ej-API-exponerat schema (`auth`/`private`).
- `tenant_id` i token sätts via **Custom Access Token Hook** (öppen fråga 1 i schemat — bekräfta hook vid bygge). Klient kan ej röra `app_metadata`.
- Service-role i server-kod kringgår RLS — använd endast för admin/webhooks/platform_admin, aldrig för kund-queries.
- Lägg `updated_at`-trigger på muterbara tabeller.
- Avgiftsfälten (`service_fee_type/value`) ärver `tenant_settings` RLS — läses av G09 (Stripe `application_fee`) och G08 (Corevo-avgift).
