# VAG0 — Kund-identitet + dependent-moduler (DRAFT migration 0011)

**Status:** DESIGN / review-läge. SQL ligger i `2-Byggplan/VAG0-migration-draft.sql`.
**EJ APPLICERAD.** Inget rört i `5-Kod/packages/db` eller `5-Kod/supabase/migrations`.
Reconcilering av keystone + M4 + M5 + M6 till **EN** additiv migration (0011).

> Migrationsnummer: 0001–0010 finns och är applicerade på `clylvowtowbtotrahuad`.
> Indata-pieces angav motstridiga nummer (keystone "0011", M4/M5 "0012", M6 "0011").
> Uppdraget = EN migration → allt foldat till **0011**. Faktisk mapp =
> `5-Kod/supabase/migrations/` (INTE `packages/db` — den har bara types.ts/index.ts).

---

## (a) Vad som skapas + varför

**5 nya tabeller, 5 nya kolumner, 5 funktioner, 6 triggers, 6 RLS-policies.**

| Objekt | Vad | Varför |
|---|---|---|
| `public.customers` | Stabil per-tenant kund-identitet. `id` = eget surrogat-uuid (INTE auth.uid()), nullable `auth_user_id` → users.id, `contact_hash` för gäst-dedup, kontakt-PII (full_name/email/phone), `status` (active/anonymized). | Det stabila identitets-bandet M4/M5/M6 hänger på. Surrogat (ej auth.uid()) → gästrad utan auth-user + gäst→registrerad merge. |
| `bookings.customer_id` | NY nullable uuid-kolumn, FK → customers(id) `on delete set null`. | Stabilt band framåt. `customer_profile_id` lämnas ORÖRD (live RLS/app/GDPR-kontrakt). |
| `public.customer_favorites` | Kund favoritmarkerar staff ELLER service (kind-diskriminator + CHECK). | M4 §2.3. |
| `public.loyalty_ledger` | Append-only, signerade `points_delta` (earn/redeem/adjustment). Saldo + tier HÄRLEDS (inga lagrade kolumner). | M4 §2.2 — det durabla som rättfärdigar tabellen (inlösen, justeringar, GDPR-persistens). Härledbart (completed-count) kräver ingen tabell. |
| `public.customer_notes` | ETT internt klientkort per (tenant, kund). Strukturerade text[]/enum-prefs + vaktad fritext. | M5 §2.3 — "följer med till nästa besök", strikt internt. |
| `public.working_hour_slots` | Explicita bokbara starttider per (staff, weekday). Samexisterar med `working_hours` (envelopen). | M6 §5 — ojämna starttider (12:30, 13:05). Tom lista → motorn faller tillbaka på range-rastret (noll regression). |
| `staff`/`services`.`slot_step_min`,`buffer_min` | Nullable steg/buffert-overrides. | M6 — per-frisör krav, per-tjänst "ev.". Null = hårdkodad default (15/0) → noll backfill. |

**Funktioner:** `customer_contact_hash` (gäst-dedup), `private.current_customer_id()` (tenant-scopad RLS-helper — definieras ÉN gång, M4 äger den), `get_customer_contact` (tidsbunden PII-exponering), `scrub_customer_notes_on_anonymize` (GDPR), `seed_explicit_slots_from_hours` (opt-in boot-import).

---

## (b) Moduler som låses upp

- **M4 kundportal** — favoriter + lojalitet (poäng/tier/inlösen).
- **M5 personalportal** — klientkort/kundnoteringar som följer kunden.
- **M6 salong-admin** — kunddatabas, explicita bokbara slots, per-frisör steg/buffert.
- **M3 bokningsmotor** — explicit-slot-läge via `working_hour_slots` (anon-läsbar).
- Keystone `customers` är förutsättningen för ALLA tre dependents (FK-mål).

---

## (c) Backfill-risker + idempotens

Backfill **körs i migrationen** (FAS 7), gatas helt på `customer_id is null` + `ON CONFLICT` på partiella unika index → **fullt återkörbart**.

- **Ordning load-bearing:** A (inloggade, via `customer_profile_id`) FÖRE B (gäster, via note-söm). En rebookad inloggad bokning bär BÅDE `customer_profile_id` OCH gäst-note (actions.ts:228); prioritet förhindrar gäst-dubblett.
- **Note bevaras** — tas bort först i senare fas när app-vägen läser från customers istället för note-sömmen.
- **Gäst-parsning speglar produktionsregexarna exakt** (parse.ts:8/14, sms.ts:68). Gäster UTAN e-post/telefon hoppas över (ingen stabil dedup-nyckel) — note orörd, länkas manuellt sen.
- **`customers.full_name` för inloggade = null** i backfill (user_metadata nås ej i SQL); UI fyller via auth-profilen.

**Rader-påverkade (formel — exakt antal kräver en pre-apply `SELECT count(*)` som Zivar kör mot live):**
- `customers`: 1 rad per distinkt `(tenant, auth_user_id)` + 1 per distinkt `(tenant, gäst-contact-hash)`.
- `bookings.customer_id`: sätts på VARJE befintlig bokning som har `customer_profile_id` ELLER en hash-bar gäst-note; gäster utan kontakt förblir null.

**Risk:** P1 nedan (pgcrypto-schema) — om fel faller hela migrationen vid CREATE FUNCTION, före backfill.

---

## (d) types.ts-regen-plan (EN regen EFTER apply)

`5-Kod/packages/db/types.ts` är genererad. **En enda regen körs EFTER att 0011 applicerats** (inte under review):
1. Apply 0011 mot `clylvowtowbtotrahuad`.
2. Regenerera types (Supabase typegen) → committa uppdaterad `types.ts`.
3. Verifiera att nya tabeller/kolumner + RPC-signaturer (`get_customer_contact`, `seed_explicit_slots_from_hours`) finns i typerna.
Ingen typgen sker i review-läget — `packages/db` är frusen tills Zivar godkänt.

---

## (e) Öppna beslut för Zivar

**🔴 BLOCKERANDE pre-apply (måste avgöras INNAN apply):**

- **P1 — pgcrypto-schema (hård gate):** `customer_contact_hash` anropar `extensions.digest()`. Är pgcrypto i `public` (inte `extensions`) faller migrationen vid CREATE FUNCTION (language sql validerar bodyn direkt). **Verifiera mot live:** `select extnamespace::regnamespace from pg_extension where extname='pgcrypto';` → byt till `public.digest(...)` om den ligger i public. (Kunde inte verifieras här — DB-query är text-only-spärrad, korrekt.)
- **P2 — GDPR-räckvidd (app-kod, blockerande för PII-laglighet):** 0011 inför NY PII i `customers` (full_name/email/phone/contact_hash) + `customer_notes` som `lib/gdpr/erase.ts` INTE når (den keyar på `customer_profile_id`, rör bara bookings, sätter aldrig `customers.status='anonymized'` → M5-scrub-triggern fyrar heller aldrig). **Att applicera 0011 utan att utöka erase.ts = GDPR-regression införd av denna migration.** erase.ts måste i samma release: nolla customers-PII + sätta `status='anonymized'` (triggar note-scrub) + DELETE:a `customer_favorites` (preferensdata, ingen retention). `loyalty_ledger` BEHÅLLS (ingen direkt PII, lojalitetshistorik).

**🟡 Designbeslut (icke-blockerande, men påverkar UX/juridik):**

1. **PII-maskningsmodell / drift-fönster:** `get_customer_contact` defaultar 720h före / 24h efter. Hur länge ska frisör/admin se telefon/mejl runt en bokning? Per-tenant config (tenant_settings) eller global default?
2. **contact_hash som identitetsnyckel:** sha256(tenant|e-post|telefon) är pseudonymiserad PII (ej anonym). OK som gäst-korrelationsnyckel, eller svagare/ingen gäst-igenkänning? (Nollas vid erase.)
3. **Visningsnamn-default** när `name_hidden=true` + inget `display_name`: designen visar första initialen. Bekräfta (alt: "Kund" / helt dold).
4. **Identitetsmodell — dubbla band:** bookings får nu BÅDE `customer_profile_id` (oförändrad, RLS/GDPR) OCH `customer_id` (stabil). Bekräfta parallellt under övergångsfas (deprecate customer_profile_id = SENARE icke-destruktiv fas, aldrig DROP).
5. **Lojalitet — ledger ja/nej-nu:** bygga `loyalty_ledger` nu, eller skjuta upp (härledd completed-count räcker för naiv MVP; ledgern krävs först för inlösen/justeringar/GDPR-persistens). Lätt att utelämna tabellen om M4-lojalitet inte är på väg in denna våg.
6. **erase + bookings.customer_id:** vid anonymisering — nolla `bookings.customer_id` (full bortkoppling) eller låt peka på skrubbad stub (behåller "återkommande"-räkning utan PII)? Designen lutar mot att BEHÅLLA mot stubben.
7. **M6 per-service step/buffert-kolumner:** ta med nu (gjort) eller spara? Lätt att utelämna de två services-kolumnerna om "ev." inte önskas.
8. **seed-default-steg 15** ok som boot-import-standard?

---

## (f) Design-token-baseline (M2 §2.4) — INTE en del av denna migration

Detta är **app-kod, ingen SQL** — byggs i token-baseline-steget, inte i 0011. Noteras här så det inte tappas:

- M2 §2.4 kräver att färg/font/logo/bilder/copy/tema läses som **runtime `tenant_settings`** (befintlig kolumn, 0001:47 settings JSON), **INTE build-inlinat** via `NEXT_PUBLIC_*` — annars funkar inte M6:s varumärke-live-preview (M6 §3.6).
- Behöver göras (i token-baseline-steget): läs `tenant_settings.settings` (`colors_and_type.css`-motsvarande) vid request-tid i M2-storefront och injicera som CSS-variabler; verifiera att en M6-ändring (färg/font/copy/bild) syns live på M2 **utan deploy**.
- **Ingen migration behövs** — `tenant_settings.settings` JSON rymmer redan tema-data; detta är en läs-/render-path, inte ett schema-tillägg.

---

## RLS-täckning (uppdragets checklista — varje ny tabell: RLS PÅ + ≥1 policy)

| Tabell | RLS PÅ | Policy/policies | Tenant-fence via |
|---|---|---|---|
| `customers` | ✅ FAS 5 | `customers_rls` (authenticated) | `private.tenant_id()` + role_level/auth.uid() |
| `customer_favorites` | ✅ FAS 5 | `customer_favorites_rls` (authenticated) | `private.tenant_id()` + current_customer_id() |
| `loyalty_ledger` | ✅ FAS 5 | `loyalty_ledger_select` (authenticated, SELECT-only; writes = service-role) | `private.tenant_id()` + current_customer_id() |
| `customer_notes` | ✅ FAS 5 | `customer_notes_rls` (authenticated, staff/admin only — INGEN kund-gren) | `private.tenant_id()` + role_level()>=3 |
| `working_hour_slots` | ✅ FAS 5 | `working_hour_slots_rls` (authenticated) + `working_hour_slots_public_read` (anon, aktiv tenant) | `private.tenant_id()` / tenants.status='active' |

Alla 5 tabeller: RLS PÅ + ≥1 policy, alla tenant-isolerade via `private.tenant_id()`. Inga DROP/destruktiva ALTER. Inga namnkrockar mot 0001–0010 (verifierat: customers/customer_favorites/loyalty_ledger/customer_notes/working_hour_slots samt staff/services step/buffert finns ej tidigare). Namnregler följda (staff/staff_id, start_ts/end_ts, weekday, private.tenant_id()).
