## Goal 02 — Databas, schema, migrations & RLS (M9 fundament)

**Spår:** Fundament · **Beror på:** G01 · **Modul:** M9 (Databas/Arkitektur)

**Mål:** Bygg det multi-tenant Postgres-schemat i Supabase med migrations, RLS-policies och seed — fundamentet hela plattformen vilar på. Inget annat spår får starta innan detta är klart.

**Kontext:** G01 klar: Next.js + Supabase-klienter + Cloudflare-konfig finns. Inga tabeller finns i Supabase ännu. Supabase-projekt antas skapat (URL + nycklar i env).

**Omfattning (bygg detta):**
- Supabase CLI-uppsättning i repo: `5-Kod/supabase/` med `config.toml` och `migrations/`.
- Migrations som skapar kärnschemat (multi-tenant):
  - `tenants` (salong/konto): id, slug, namn, custom_domain, brand (logo_url, primary_color, theme), plan, status, stripe_account_id, created_at.
  - `profiles` (kopplad till `auth.users`): id, tenant_id, role (`customer`|`staff`|`salon_admin`|`platform_admin`), namn, telefon.
  - `staff` (personal): id, tenant_id, profile_id, titel, aktiv, schema-ref.
  - `services` (tjänster): id, tenant_id, namn, beskrivning, varaktighet_min, pris, kategori, aktiv.
  - `staff_services` (vilken personal gör vilken tjänst): tenant_id, staff_id, service_id.
  - `availability` / `working_hours`: tenant_id, staff_id, veckodag, från, till.
  - `time_off` (frånvaro/undantag): tenant_id, staff_id, från_ts, till_ts, orsak.
  - `bookings`: id, tenant_id, customer_profile_id, staff_id, service_id, start_ts, end_ts, status (`pending`|`confirmed`|`cancelled`|`completed`|`no_show`), pris, notering, created_at.
  - `payments`: id, tenant_id, booking_id, stripe_payment_intent_id, belopp, valuta, status, created_at.
  - `audit_log`: id, tenant_id, actor_profile_id, action, entity, entity_id, meta jsonb, created_at.
- **RLS på samtliga tenant-tabeller**, med policies baserade på tenant-tillhörighet + roll.
- Hjälpfunktioner i SQL: `current_tenant_id()` och `current_role()` som läser från JWT/`profiles`.
- Seed-script: 1 demo-tenant, 1 salon_admin, 1 staff, 3 services, working_hours.
- TypeScript-typer genererade till `5-Kod/lib/database.types.ts`.

**Utanför scope:**
- Ingen UI.
- Ingen Stripe-integration (bara `payments`-tabell finns).
- Ingen e-post/notiser.

**Berörda områden/filer:** `5-Kod/supabase/migrations/`, `5-Kod/supabase/seed.sql`, `5-Kod/lib/database.types.ts`.

**Steg:**
1. Initiera Supabase CLI (`supabase init`), länka projekt.
2. Skriv migration `0001_core_schema.sql` (alla tabeller + index på `tenant_id`).
3. Skriv migration `0002_rls.sql`: aktivera RLS, skapa `current_tenant_id()`/`current_role()`, skriv policies per tabell (select/insert/update/delete scoped på `tenant_id`; platform_admin-bypass via egen policy).
4. Skriv `seed.sql`.
5. Kör `supabase db reset` lokalt (eller `db push` mot remote) — verifiera utan fel.
6. Generera typer: `supabase gen types typescript` → `lib/database.types.ts`.
7. Skriv ett litet RLS-testscript (SQL eller `pnpm` test) som bevisar att tenant A inte ser tenant B:s bokningar.

**Verifieras (DoD):**
- Alla migrations kör rent (`supabase db reset`).
- RLS aktiv på varje tenant-tabell (verifiera via `pg_policies`).
- RLS-test: query som tenant A returnerar 0 rader av tenant B:s data.
- `platform_admin` kan läsa tvärs tenants (egen policy).
- `lib/database.types.ts` genererad och importeras utan TS-fel.
- `pnpm build` grön.

**Tekniska noter:**
- `tenant_id` PÅ ALLA affärstabeller, `not null`, index på `(tenant_id)` och `(tenant_id, start_ts)` för bookings.
- RLS-policy-mönster: `using (tenant_id = current_tenant_id())`. Roll hämtas från `profiles` via `auth.uid()`.
- `current_tenant_id()`: läs tenant från användarens `profiles`-rad (`auth.uid()` → profile → tenant_id). Lägg som `SECURITY DEFINER` om nödvändigt.
- Service-role i server-kod kringgår RLS — använd endast för admin/webhooks, aldrig för kund-queries.
- Lägg `updated_at`-trigger på muterbara tabeller.
