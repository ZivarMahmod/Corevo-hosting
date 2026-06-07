# BRIEF-SC-018: RLS på `private.rate_limit_hits` (stäng kritiskt advisor-hål)
Thinking: 🔴 Think hard

> ## ✅ KLAR (2026-06-05) — migration `0023_rls_rate_limit_hits.sql`
> Skrivar-förstudie: `public.check_rate_limit` = SECURITY DEFINER (owner postgres) → bypassar RLS → **ingen utelåsning**. Kolumner live: bucket/window_start/hits. Migration 0023 applicerad: `enable rls` + `rate_limit_hits_platform_read`-policy (`for select using private.is_platform_admin()`). **Verifierat:** `relrowsecurity=t`, policy_count=1, **writer-test skrev rad trots RLS** (6→7, definer bypassar), idempotent (kört 2×, rent), **advisor 0 ERROR** (rate_limit_hits-flaggan borta; baslinje 15 WARN oförändrad — alla by-design anon-RPC + btree_gist + leaked-password). **Adversariellt:** `set role authenticated` → `42501 permission denied` (ingen grant + RLS = dubbel-låst, noll läck). POS corevo.se+admin 200. DB-only, ingen worker-deploy.

## Mål
Slå på Row Level Security på tabellen `private.rate_limit_hits` + lägg en korrekt policy, så Supabase-advisorns **kritiska** RLS-flagga försvinner — UTAN att låsa ute den legitima skrivaren (rate-limit-vägen som idag har 6 rader live).

## Lägeskoppling
- Audit `4-Dokument-Underlag/superadmin-db-audit-2026-06-04.md`, ARKITEKTUR-NOTER: "RLS-varning (orelaterad): `private.rate_limit_hits` har RLS AV (6 rader). Supabase-advisor flaggar kritiskt."
- Plan `2-Byggplan/AUDIT-FIX-PLAN-superadmin-2026-06-04.md` → GOAL-18 (säkerhet, först).
- Zivar-beslut 2026-06-04: "RLS är viktigt, fixa nu — så länge det inte skapar för mycket utelåsningar."

## Kontext
- ⚠️ **Tabellen finns i live-DB men INTE i migrationshistoriken** (`5-Kod/supabase/migrations/` 0001–0022 innehåller ingen `rate_limit_hits`). Den skapades utanför migrationsflödet (eller av en funktion). Detta MÅSTE hanteras: migrationen ska vara idempotent och får inte anta en exakt kolumnuppsättning den inte verifierat.
- **RLS-modell i projektet:** `private.is_platform_admin()` (JWT `app_metadata.platform_admin`) + `private.tenant_id()` (JWT `app_metadata.tenant_id`). Se `0002_rls.sql`.
- **Viktig RLS-sanning:** `service_role` och tabellägaren (postgres) **bypassar RLS helt**. Om skrivaren av `rate_limit_hits` är service_role / en `SECURITY DEFINER`-funktion / postgres → en påslagen RLS med restriktiv policy låser INTE ute den. Risken för utelåsning gäller bara om en `anon`/`authenticated`-klient skriver direkt. Därför: **inspektera skrivaren FÖRST**, slå på sen.
- Tabellen ligger i `private`-schemat → exponeras sannolikt inte via PostgREST/anon ändå, men advisorn vill ha RLS på + policy oavsett.

## Berörda filer
- `5-Kod/supabase/migrations/0023_rls_rate_limit_hits.sql` — NY. Idempotent: slå på RLS + lägg policy. Rollback-block i kommentar.
- (Ingen app-kod ändras — detta är rent DB.)

## Steg
1. **Inspektera live FÖRST** (kör read-only mot molnet, dokumentera resultatet i goal-loggen):
   - Kolumner + ägare: `select column_name, data_type from information_schema.columns where table_schema='private' and table_name='rate_limit_hits';` och `select tableowner from pg_tables where schemaname='private' and tablename='rate_limit_hits';`
   - Vem skriver? Sök i repo efter skrivaren: `rate_limit`, `rate-limit`, `rateLimit` i `5-Kod/apps/web/` och i migrations (funktioner). Om ingen app-väg hittas → skrivaren är en DB-funktion/edge/extern → service_role-klassad → RLS-säkert.
2. **Skriv migration 0023** — idempotent:
   ```sql
   -- 0023_rls_rate_limit_hits.sql
   alter table private.rate_limit_hits enable row level security;
   -- Inga anon/authenticated-policys = ingen direkt klientåtkomst (private-schema, service_role bypassar ändå).
   -- Tillåt bara platform_admin att läsa (för ev. framtida drift-UI), ingen annan får något.
   drop policy if exists rate_limit_hits_platform_read on private.rate_limit_hits;
   create policy rate_limit_hits_platform_read
     on private.rate_limit_hits
     for select
     using (private.is_platform_admin());
   ```
   - OM inspektionen i steg 1 visar att en `authenticated`-klient faktiskt skriver direkt (osannolikt) → lägg en matchande `for insert with check (...)`-policy så skrivaren inte bryts. Annars INTE.
3. Applicera 0023 på molnet.
4. Kör Supabase-advisor igen → bekräfta att `rate_limit_hits`-flaggan gått från ERROR/kritisk till löst.

## Verifiering
- [ ] `select relrowsecurity from pg_class where oid = 'private.rate_limit_hits'::regclass;` → `t`.
- [ ] Supabase-advisor: 0 ERROR för `rate_limit_hits` (baslinjen var 15 WARN/0 ERROR enligt HANDOFF — den ska inte öka).
- [ ] **Skrivaren fungerar fortfarande:** efter påslag, verifiera att nya rader fortsatt kan skrivas av den legitima vägen (trigga rate-limit-vägen ELLER bekräfta att skrivaren är service_role/definer som bypassar RLS). Radantalet ska kunna växa, inte frysa.
- [ ] Ingen `anon`/`authenticated`-klient kan läsa tabellen (private-schema + ingen sådan policy).
- [ ] POS orörd: `corevo.se` + `admin.corevo.se` → 200.

## Anti-patterns
- Slå INTE på RLS utan att först ha klargjort vem skrivaren är (utelåsningsrisk = Zivars enda oro).
- Anta INTE kolumnnamn du inte verifierat (tabellen är inte i migrationshistoriken).
- Lägg INTE en `anon`-läspolicy — det vore att öppna, inte stänga.
- Gör INTE detta destruktivt — bara `enable rls` + `create policy` (ingen data rörs).

## Kopplingar
- Fristående säkerhetsfix. Blockerar inget men ska köras FÖRST (minst risk, kritisk advisor).
- Samma RLS-mönster som `0002_rls.sql` / `0010_role_aware_booking_rls.sql`.

## Rollback
- `alter table private.rate_limit_hits disable row level security;`
- `drop policy if exists rate_limit_hits_platform_read on private.rate_limit_hits;`
- Icke-destruktivt — bara RLS-flagga + policy, ingen data.
