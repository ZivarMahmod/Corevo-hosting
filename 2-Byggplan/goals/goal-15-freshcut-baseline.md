# BRIEF-DB-015: FreshCut demo-baseline (ren slate + 1 tenant + 4 roller)
Thinking: 🔴 Think hard

## Mål
Nollställ databasen till en ren demo: radera ALLA befintliga tenants, seeda EN komplett FreshCut-salong på `freshcut.corevo.se`, med 4 inloggningar (alla lösen `Corevo2026!`) och **ingen bokningsdata**. Så Zivar kan visa en skarp, ren salong för en prospekt — och själv skapa bokningar live under demon.

## Lägeskoppling
- Demo inför kundpitch (FreshCut). **Körs FÖRE goal-16** (custom-domän-uppslag).
- `freshcut.corevo.se` redan kopplad som Worker custom domain ✅.

## Kontext
- Nuvarande tenant: slug `kvikta` (tidigare `demo` / `frisor1`). Ev. `frisor3` kvar.
- ⚠️ `audit_log` är **append-only** (migration 0002, triggers `trg_audit_no_delete` + `trg_audit_no_update`). En rak `delete from tenants` cascade:ar till `audit_log` och **studsar** på guarden. MÅSTE hanteras.
- Auth-users hand-seedas enligt `seed.sql`-mönstret: `raw_app_meta_data` bär `tenant_id` + `role`; **token-kolumner får INTE vara NULL** (→ GoTrue 500 — känd fix, sätt tomma strängar).
- 5 temalayouter finns (`settings.theme`: Salvia/Leander/Zigge/Linnea/Edit) — FreshCut väljer en.
- En primär `location` per tenant (multi-store ej byggt — FreshCut = ett ställe).

## Beroende (Nörden, INNAN Code kör)
Innehållet till FreshCut (tjänster, priser, team, om-text, bilder) tas fram av Nörden från **freshcut.se** (JS-renderad → via webbläsare) och bifogas goalen som seed-data. Saknad bild → temats default tills Zivar laddar upp egen.

## Berörda filer / yta
- `supabase/seed.sql` — ersätt demo/kvikta-seed med FreshCut-seed (så lokal + moln-seed = FreshCut).
- Radering + seed körs mot **molnprojektet** (clylvowtowbtotrahuad).
- Auth-users via SQL (`auth.users` + `auth.identities`) enligt seed.sql-mönstret.

## Steg
1. **Backup först:** notera Supabase PITR-tidpunkt (steg 2 är destruktivt).
2. **Radera rent — hantera audit-guarden** (i en transaktion):
   ```sql
   begin;
   alter table public.audit_log disable trigger trg_audit_no_delete;
   alter table public.audit_log disable trigger trg_audit_no_update;
   delete from public.tenants;   -- cascade: bookings/payments/staff/services/locations/audit_log/tenant_*
   alter table public.audit_log enable trigger trg_audit_no_delete;
   alter table public.audit_log enable trigger trg_audit_no_update;
   commit;
   ```
3. **Rensa gamla auth-users** (kvikta/demo/frisor3-logins som inte ska vara kvar) så inga föräldralösa konton ligger kvar.
4. **Seeda FreshCut-tenant:** `tenants` (slug `freshcut`, name `FreshCut`, status `active`) + `tenant_settings` (valt tema, accentfärg, logga/monogram-fallback) + en primär `locations`-rad (timezone `Europe/Stockholm`).
5. **Tjänster + team + priser** (från freshcut.se-underlaget): `services` (namn, pris i öre, duration), `staff` (riktiga namn ELLER "Anställd 1"), `staff_services`, `working_hours`.
6. **Bilder:** storefront-media till R2 (hero/about/team). Default-tema-bild där någon saknas.
7. **Fyra auth-users — lösen `Corevo2026!`, `email_confirmed`:**
   - **Du / platform** — super_admin, full access (befintlig konto → sätt lösen `Corevo2026!`, eller seeda nytt).
   - `freshcut@corevo.se` — role `salon_admin`, `app_metadata.tenant_id` = FreshCut.
   - `anstalld@corevo.se` — role `staff`, kopplad till en `staff`-rad i FreshCut (OBS ascii, inte "ä").
   - `kund@corevo.se` — kundkonto kopplat till FreshCut.
   - Alla: `app_metadata` (role + tenant_id), `raw_app_meta_data` satt, token-kolumner = `''` (ej NULL).
8. **INGEN bokningsdata** — skapa inga `bookings`/`payments`.

## Verifiering
- [ ] `select count(*) from public.tenants` = **1** (freshcut). Inga kvikta/demo/frisor3.
- [ ] `freshcut.corevo.se` visar FreshCut-storefront (tema, tjänster, team, bilder) — inga tomma sektioner.
- [ ] `select count(*) from public.bookings` = **0**.
- [ ] Login OK för alla 4 med `Corevo2026!`: platform→`/`, `freshcut@`→`/admin`, `anstalld@`→`/personal`, `kund@`→`/konto`.
- [ ] Inga föräldralösa `auth.users`. Audit-guards **återaktiverade** (insert funkar, delete/update blockeras 6/6).
- [ ] `booking.corevo.se` (backoffice) + POS (`corevo.se`) opåverkade (200).

## Anti-patterns
- Radera ALDRIG utan noterad PITR-punkt.
- Lämna ALDRIG audit-triggrarna avstängda (återaktivera i samma transaktion).
- Skapa INGEN bokningsdata.
- Hand-seeda INTE auth.users med NULL token-kolumner (→ GoTrue 500).
- Rör INTE booking.corevo.se-flödet eller POS-zonen.

## Kopplingar
- **Föregår goal-16** (custom-domän-uppslag).
- Bygger på G08 (tenant-skapande), `seed.sql`-mönstret, G12 host-routing.

## Rollback
- Supabase **PITR** till tidpunkten före steg 2. (Destruktivt → PITR är skyddet.) Alternativt re-seed föregående demo.
