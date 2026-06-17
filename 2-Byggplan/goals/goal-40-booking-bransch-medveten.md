# goal-40 — Booking bransch-medveten + restaurang-kapacitet (object:table)
Thinking: ⚫ (schema-migration på `bookings` + ändrar `no_double_booking`-constraintens scope för kapacitet — fel = dubbelbokning ELLER bruten frisör-booking. Rollback obligatorisk. Zivar-OK på schema GIVET: "full" 2026-06-17.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. ⚫ kräver advisor-consult på constraint-designen (steg 2) innan migration körs live.
**Beslut (Zivar 2026-06-17):** "Ja — full" → bygg `object:table`-kapacitet + `party_size` + `address`. (booking.md §8.2 + §8.4.)

## Mål
Gör booking-motorn **bransch-medveten** via `verticals.rules.booking` (`object`: slot/table/dropoff/syntest + `staff_pick` + `slot_source` + `capture[]`) + `terminology` — EN motor, ingen fork, config-driven. Lägg `party_size` + `address` på `bookings`. Bygg en kapacitetsmodell för `object:table` så `no_double_booking` håller **utan `staff_id`** (restaurang). Resultat: en riktig restaurang tar bordsbokningar live = **Fas B-beviset** (Corevo är inte bara frisör).

## Lägeskoppling
Fas B i `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md`. **Enda riktiga nybygget i modul-lagret** (RITNING §2). Bygger på `1-Planering/05-multibransch-bygge/moduler/booking.md` + `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.1/§4/§7.2.

## Kontext
- `booking` är LIVE men **ej bransch-medveten i kod** (bara `wizard`/`compact`-läge). 12 branscher delar motorn.
- Varianten bor i **`verticals.rules.booking`** (lager 2) + `terminology` (lager 3) + `tenant_modules.config` (lager 4) — INTE ett modul-enum (booking.md §8.1; `variant_schema:{}` i DB-sanning). Allt = data, ingen fork (princip 10).
- **Den hårda biten (⚫):** `no_double_booking` (EXCLUDE, btree_gist) är byggd kring `staff_id`/`barber_id`. `object:table` (restaurang) har inget `staff_id` → antagandet bryts → kräver kapacitets-scoped constraint. Frisörens staff-baserade skydd får ALDRIG regressa.
- Betal-rails pausade (beslut 14.2) → `payment_status = unpaid`/`pay_on_site`, ingen moms/kvitto i scope. Deposit-grind = separat modul (`deposit.md`), rör ej.

## Berörda filer
- `5-Kod/supabase/migrations/00XX_booking_bransch.sql` — **NY.** `bookings.party_size` (int null) + `bookings.address` (text null) + kapacitetsmodell + constraint-utvidgning. Idempotent, numrerad, `SET search_path=public`, rollback.
- `5-Kod/apps/web/components/booking/BookingWizard.tsx` + `BookingMount` — bransch-medveten rendering enligt `rules.booking.object`.
- RPC `create_public_booking(...)` + `get_busy_intervals(...)` (i migrations/SQL) — hantera table/kapacitet + spara `party_size`.
- `verticals.rules.booking` + `verticals.terminology` — config per bransch (data, en rad/bransch; börja med restaurang).
- `@corevo/db` typer — synka mot migrationen.
- *(grep fram exakta sökvägar för RPC-definitionerna + BookingWizard innan ändring.)*

## Steg
1. **Migration — kolumner:** lägg `party_size INT NULL` + `address TEXT NULL` på `bookings` (`IF NOT EXISTS`). Rollback: `DROP COLUMN`.
2. **Kapacitetsmodell — ⚫ advisor-consult FÖRE migration.** Mål: hindra två bokningar på samma bord/tid utan `staff_id`, utan att röra frisörens staff-constraint.
   - **REKO:** generalisera till en bokningsbar **resurs** — modellera bord som resurs-rader och scope:a `no_double_booking` på `(resurs, tidsspann)` (samma EXCLUDE-mönster som staff). v1: introducera `bookings.resource_id` (NULL för rena staff-bokningar) ELLER bord-som-resurs-rader (booking.md §8.2-alternativen).
   - Kör designen genom Supabase-advisor + bekräfta med Zivar **innan** live-migration. Behåll den befintliga staff-EXCLUDE oförändrad för `object:slot`.
3. **`verticals.rules.booking` + `terminology`:** fyll **restaurang** först: `object:table` · `staff_pick:false` · `slot_source:fixed` (90–120 min) · `capture:[party_size]` · terms `service→Bord`. (Övriga branscher = senare rader, billigt.)
4. **BookingWizard bransch-medveten:** rendera per `rules.booking.object`:
   - `slot` (dagens flöde, oförändrat) · `table` (party_size-väljare → datum/tid → kontakt, **ingen tjänst/personal**) · `dropoff` (servicetyp → fönster) · `syntest` (fast).
   - `staff_pick:false` får ALDRIG tvinga fram ett tomt personal-steg. `terminology` styr alla ord (ingen hårdkodad "Frisör").
5. **RPC:** `create_public_booking` sparar `party_size`/`address`, scope:ar constraint på kapacitet för table; `get_busy_intervals` + `slot_holds` funkar för bord.
6. **Onboarda 1 riktig restaurang:** `verticals`-rad + tenant → storefront bordsbokning + admin-kalender live.
7. Synka `@corevo/db`-typer; skriv tester.

## Verifiering (klar när — bevisat live, ingen frisör-regression)
- [ ] Migration applicerad (`party_size`/`address` finns); rollback testad på branch.
- [ ] **Dubbelbokning:** två bord-bokningar samma bord/tid → AVVISAS. Frisör-staff-bokning fortfarande skyddad (ingen regression — testa båda).
- [ ] Restaurang-storefront: `party_size` → datum/tid → bekräfta, UTAN tjänst/personal-steg. Frisör-storefront oförändrad (`slot`).
- [ ] `terminology`: "Frisör"/"Behandling" läcker INTE in på restaurang.
- [ ] En riktig restaurang-tenant tar en **live** bordsbokning end-to-end; admin ser den i kalendern.
- [ ] Gates: vitest grönt, tsc 0, lint 0, opennext build, grep-guard ren. Worker-version + rollback-id noterade.
- [ ] Compliance: `payment_status` = `unpaid`/`pay_on_site`, inga betal-rails/moms aktiverade.

## Anti-patterns
- ALDRIG fork per bransch (princip 10) — allt via `verticals`/config.
- ALDRIG nya tabeller för slot/table-*beteende* (config-driven). Enda schema-ytan: `party_size`/`address` + kapacitetsmodellen.
- ALDRIG bryta den staff-baserade `no_double_booking` (frisör får aldrig regressa).
- Rör INTE betal-rails (pausade) eller deposit-modulen.
- Schema bara på go (givet) + advisor-consult på constraint (steg 2) före live.
- `staff_pick:false` → inget tomt personal-steg; ingen hårdkodad terminologi.

## Kopplingar
`moduler/booking.md` (spec), `02-Arkitektur-sanning.md` §1.1/§4/§7.2, RITNING §2 (booking = enda nybygget), `deposit.md` (separat), roadmap Fas B. Branscher som väntar på `fordon`/`pets`/`intag` = senare moduler (Fas D).

## Rollback
Revert migration (`DROP COLUMN party_size, address`; återställ `no_double_booking` till staff-only; ta bort resurs-modell), `git revert`, `wrangler rollback <förra-version-id>`. Inga raderingar av befintlig boknings-data.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper DoD på de tre ställen där "klart" idag kan ljuga: constraint-scopet, kapacitets-aritmetiken och hold-racet för resurs-bokningar. **Skärper bara acceptans — ändrar INTE scopet:** fortfarande EN config-driven bransch-medveten motor (universal motor + variant via `verticals`), aldrig en fork per bransch (princip 10). ⚫-disciplinen står kvar: advisor-consult på constraint-designen FÖRE live-migration, rollback testad på branch, ingen "Frisör"/"Behandling"-terminologi som läcker in, `payment_status` = `unpaid`/`pay_on_site`, gröna gates + noterad worker-version/rollback-id.

### 1. Migrations-test-matris — constraint-scope får ALDRIG överlappa staff-constraint
Den nya EXCLUDE-constraintens scope (resurs/bord/kapacitet) får inte glida in över staff-constraintens domän — **constraint-överlapp = tyst dubbelboknings-hål** (två constraints som var för sig "tror" att de äger raden men ingen avvisar). Bevisa scope-separationen mekaniskt med en test-matris i migrationen/testerna:
- [ ] **Staff-only** (`staff_id` satt, `resource_id` NULL): två överlappande bokningar samma `staff_id`/tid → AVVISAS av staff-EXCLUDE. Resurs-EXCLUDE ska INTE träffa (rätt rad äger raden).
- [ ] **Table-only** (`resource_id` satt, `staff_id` NULL): två överlappande bokningar samma `resource_id`/tid → AVVISAS av resurs-EXCLUDE. Staff-EXCLUDE ska INTE träffa.
- [ ] **Hybrid** (en bokning med BÅDE `staff_id` + `resource_id`, t.ex. en behandling som binder både personal OCH ett rum/utrustning): bevisa att BÅDA constraints utvärderas och att en kollision på ANTINGEN axeln (samma staff ELLER samma resurs) avvisas — och att en bokning som krockar på ingen axel släpps igenom.
- [ ] **Anti-överlapp-bevis:** verifiera explicit att ingen rad kan dubbelbokas utan att MINST en constraint avvisar, OCH att de två constraint-predikaten inte överlappar så att en giltig bokning felaktigt nekas (ingen falsk kollision mellan staff-only och table-only på olika axlar). Dokumentera predikat-villkoren (`WHERE`/partial-index-scope) som gör scopen disjunkta.
- [ ] Advisor-consult ⚫ på just scope-separationen (predikaten) FÖRE live-migration; rollback för matrisen testad på branch.

### 2. Kapacitets-aritmetik — definiera v1 explicit (1-bord-1-bokning vs riktig kapacitet)
DoD testar idag bara "samma bord/tid avvisas" men **inte att kapacitet RÄKNAS** mot bordsstorlek/antal. Lås v1-modellen i klartext innan migration:
- [ ] **v1-beslut dokumenterat:** är `object:table` v1 = **1-bord-1-bokning** (ett bord = en exklusiv resurs per tidsspann, party_size lagras men begränsar inte) ELLER **riktig kapacitet** (bord för 4 vs sällskap 6 → avvisas/kräver flera bord; flera bord samma tid summeras mot kapacitet)? Skriv ut valet — ingen tyst tolkning i koden.
- [ ] Om v1 = 1-bord-1-bokning: bevisa att `party_size` är **rådata utan tysta kapacitets-antaganden** (sparas, visas, men EXCLUDE scope:ar på `resource_id`/tid — inte på en låtsad summa). Lägg en explicit `## Kvar`-rad: riktig kapacitets-aritmetik = senare iteration.
- [ ] Om v1 = riktig kapacitet: DoD-test som RÄKNAR — (a) sällskap 6 mot bord för 4 → avvisas eller kräver fler bord; (b) flera bokningar samma tid summeras mot total kapacitet och avvisas vid överskott; (c) party_size 0/NULL/negativt hanteras deterministiskt.
- [ ] Oavsett val: aritmetiken får ALDRIG röra staff-`slot`-flödet (frisör har ingen `party_size`) och får inte tvinga fram fork — kapacitetsregeln bor i `verticals.rules.booking` / RPC-logik, inte i en bransch-grenad kodväg.

### 3. Hold-race-test för bord-resurs — `slot_holds`/`get_busy_intervals` byggdes för staff-slots
`slot_holds` + `get_busy_intervals` byggdes för **staff-slots**; antagandet "en pågående hold blockerar en parallell bokning" kan brista när scopet är en resurs (bord) i stället för `staff_id`. Bevisa att hold-mekanismen faktiskt täcker resurs-scope:
- [ ] **Hold-race-test (bord):** lägg en pågående hold på ett BORD/tidsspann → en parallell bokning på samma bord/tid ska BLOCKERAS (av holden, innan den blir en rad), inte slinka förbi för att holden bara nyckar på `staff_id`.
- [ ] **`get_busy_intervals` resurs-medveten:** bevisa att den returnerar upptagna intervall även för bokningar UTAN `staff_id` (rena `resource_id`-rader) — annars visar storefront falskt lediga tider för restaurang.
- [ ] **Utgången hold frigör bordet:** efter att en hold löpt ut/släppts ska bordet bli bokningsbart igen (ingen läckt resurs-lås).
- [ ] **Ingen staff-regression:** samma testkörning bevisar att staff-slot-holds (frisör) fortfarande beter sig oförändrat — hold-utvidgningen till resurs får inte regressa det staff-baserade flödet.
