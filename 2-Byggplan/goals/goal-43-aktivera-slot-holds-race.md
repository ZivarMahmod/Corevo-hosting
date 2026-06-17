# goal-43 — Aktivera slot-holds (UX-kontention + concurrency-bevis ovanpå EXCLUDE-backstoppen)

Thinking: ⚫ (applicerar migr `0014_slot_holds` mot live-DB + regenererar `packages/db/types.ts` (FRYST denna våg) + wirar in en hold-läsning i den enda live-bokningsvägen. Fel = falskt lediga/låsta tider eller regress i frisör-availability. ⚫ kräver advisor-consult på hold-läsningens form (steg 4) FÖRE live-migration + per-gång-Zivar-OK på migrationen. Rollback obligatorisk, testad på branch.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. ⚫ kräver advisor-consult på läsvägen (steg 4) innan migration körs live + per-gång-Zivar-OK på 0014.
**Beslut (kvar att bekräfta av Zivar):** apply av `0014` mot live-DB gatas på explicit Zivar-OK (hård regel: ingen migration live utan per-gång-OK). Branch-apply + rollback-test får köras utan OK.

## Mål
Aktivera den **redan byggda men dormanta** slot-hold-mekanismen (`lib/booking/holds.ts` + migr `0014_slot_holds`) och koppla in den i det publika bokningsflödet: skapa ett 5-min hold när kunden väljer en tid → `filterHeldSlots` döljer tider en ANNAN session håller på att boka → släpp holden vid bekräftelse / avbrott / utgång. Resultat: två kunder ledsagas inte mot samma tid samtidigt (mindre kontention/krockar), OCH concurrency-skyddet bevisas mekaniskt — inte bara happy-path som idag.

## ⚠️ Ärlig problemformulering (läs FÖRST — undviker falskt premiss)
**Dubbelbokning är REDAN omöjlig på DB-nivå.** `no_double_booking` (EXCLUDE, btree_gist) i `0001_core_schema.sql:164` är live, och `create_public_booking` (`0005`) låter `23P01` bubbla upp → `app/boka/actions.ts:293` mappar det till `slot_taken`. Två parallella bokningar på samma frisör/tid → **exakt EN vinner redan idag**, den andra får `slot_taken`. Det är inte en bugg som ska fixas.

Det som SAKNAS är därför INTE racet-skyddet — det är:
1. **UX-kontentionslagret (holds):** två kunder kan båda nå bekräfta-steget på samma tid och en av dem får ett tråkigt "togs precis". Ett 5-min hold döljer tiden för andra medan en kund är mitt i flödet.
2. **Concurrency-TÄCKNING i test:** e2e/enhetstest bevisar idag bara happy-path. Den hårda garantin ("exakt en vinner") är OTESTAD.

Holds = kontentionsdämpning + UX-vänlighet. EXCLUDE-constraintet = den hårda backstoppen (oförändrad). Brieferna nedan håller isär de två — annars ljuger DoD.

## Lägeskoppling
Bygger på M3 §2.2 (slot-hold + release, ersätter pending-squat-skulden). `0014` ligger READY men EJ applicerad sedan WORKFLOW-02 (FRYST types-våg). Närliggande: goal-40 (bransch-medveten booking) skärpte redan acceptansen för *resurs*-holds (bord) — denna goal aktiverar **staff-scope-holden** (frisör), grunden de bygger på.

## Kontext
- **`holds.ts` är HELT byggd + DORMANT:** `filterHeldSlots(slots, holds, reservedEnd)` (ren, klocklös, half-open overlap = exakt `computeSlots`-semantik) + `activeHolds(holds, now)` (klock-grind). Importeras av INGEN live-väg → noll beteendeförändring idag (`lib/booking/holds.ts:1-11`).
- **`0014` är HELT byggd + EJ applicerad.** Den levererar mer än tabellen: tabell `slot_holds` (tenant_id/staff_id/start_ts/end_ts/session_token/expires_at) + RLS (authenticated tenant-fence + anon read/write/delete) + **RPC:erna `place_slot_hold` / `release_slot_hold` / `prune_expired_slot_holds`** + index `slot_holds_lookup_idx (tenant_id, staff_id, expires_at)`. **RPC:erna FINNS REDAN — denna goal SKRIVER dem inte, den WIRAR in dem.**
- **`place_slot_hold` har redan ett race-skydd:** den reser `slot_taken` (`23P01`) om tiden redan är hårt-bokad, och är idempotent per `(staff, start, token)` (samma flik förnyar `expires_at` i stället för dubblett) (`0014:139-154`).
- **Enda läsvägen för availability:** `getAvailableSlots` i `app/boka/actions.ts:96` — den ENDA platsen som anropar `computeSlots`. Hold-filtreringen wiras HÄR, efter `computeSlots`, före retur.
- **Enda skrivvägen:** `createBooking` → `create_public_booking` (`actions.ts:250`). Mappar redan `23P01`/`P0001`/location-`P0002` → graceful `slot_taken`. Här släpps holden vid lyckad bokning.
- **Wizard-seam:** `BookingWizard.tsx` — step 3 = tidsval (anropar `getAvailableSlots`), step 4 = bekräfta (`createBooking`). `place_slot_hold` anropas vid val av tid (in i step 4), `release_slot_hold` vid avbrott/back/stäng. (`BookingWizard.tsx:151,212,245`.)
- **`filterHeldSlots`-kontraktet:** filtrerar holds av en ANNAN session. Kallarens `session_token` MÅSTE därför trådas klient → `getAvailableSlots` och exkluderas — annars döljer en kund sin EGEN pågående tid för sig själv och kan inte gå vidare (`holds.ts:16-26`).
- **Types FRYST denna våg:** `supabase.from('slot_holds')` / `.rpc('place_slot_hold')` felar typecheck tills `0014` är applicerad + `packages/db/types.ts` regenererad. Därav sekvensen i steg 1–4 (apply → regen → wira). Detta är samma skäl `holds.ts` byggdes som ren funktion (`0014:9-14`).

## Berörda filer
- `5-Kod/supabase/migrations/0014_slot_holds.sql` — **FINNS, applicera (ej skriva om).** Branch-apply + rollback-test; live-apply gatas på Zivar-OK.
- `5-Kod/packages/db/types.ts` — **regenerera** efter apply (annars typecheck-fel på `slot_holds`/RPC:erna).
- `5-Kod/apps/web/app/boka/actions.ts` — `getAvailableSlots`: batch-läs aktiva holds för kandidat-staff-setet → `filterHeldSlots` per frisör före retur; tråda `sessionToken`-param + exkludera egen session. Lägg `placeHold(...)` + `releaseHold(...)` wrappers (anropar RPC:erna). `createBooking`: släpp holden vid lyckad bokning (best-effort).
- `5-Kod/apps/web/components/booking/BookingWizard.tsx` — generera/bär ett `session_token` (klient, opak); anropa `placeHold` vid tidsval (step 3→4), `releaseHold` vid back/avbryt/stäng; skicka `sessionToken` in i `getAvailableSlots`.
- `5-Kod/apps/web/lib/booking/holds.ts` — wiras in (oförändrad logik; ev. liten adapter för rad→`Hold`-mappning).
- `5-Kod/apps/web/lib/booking/holds.test.ts` — utökas med concurrency- + expiry-fall (se Verifiering).
- *(grep fram exakt signatur på `get_busy_intervals`-mönstret innan du speglar hold-läsningen; matcha dess batch-form.)*

## Steg
1. **Branch-apply `0014`** (Supabase-branch, ej live). Verifiera tabell + RPC:er + index finns. Kör `get_advisors` efter apply.
2. **Regenerera `packages/db/types.ts`** mot branchen → `slot_holds` + RPC-signaturer blir typsäkra.
3. **Rollback-test på branch:** revertera `0014` (drop table + functions + index) och bevisa att app-vägen återgår till exakt dagens beteende (holds = no-op). Notera rollback-stegen ordagrant.
4. **⚫ advisor-consult FÖRE live på läsvägens form**, sen wira `getAvailableSlots`:
   - **EN batchad läsning** av aktiva holds för hela kandidat-staff-setet (spegla `get_busy_intervals`): `select ... from slot_holds where tenant_id=? and staff_id in (...) and expires_at > now()`, lutad på `slot_holds_lookup_idx`. Mappa rad→`{start,end}`, kör `activeHolds`-grinden (eller `expires_at > now()` i query) och `filterHeldSlots` per frisör EFTER `computeSlots`.
   - **Exkludera egen session:** lägg `and session_token <> :callerToken` (eller filtrera i minnet) så kunden inte döljer sin egen pågående tid.
   - **Perf = en query oavsett antal holds** (utgångna exkluderas av index/predikat; `prune_expired_slot_holds` håller tabellen liten). **Paginering är FEL verktyg här** — en missad aktiv hold = en hållen tid visad som ledig = korrekthetshål, inte bara långsamt. Aldrig N+1 (en query per frisör) — batcha.
5. **Wira wizarden:** klient-genererat opakt `session_token` (per flik, ej PII/auth); `placeHold` vid tidsval (step 3→4), `releaseHold` vid back/avbryt/stäng; tråda `sessionToken` in i `getAvailableSlots`. `place_slot_hold`s `slot_taken` (`23P01`) → graceful "togs precis", samma familj som createBooking.
6. **Släpp vid bekräftelse:** `createBooking` anropar `release_slot_hold` (best-effort) vid lyckad insert — holden ska inte ligga kvar 5 min efter att raden finns.
7. **Tester:** utöka `holds.test.ts` + e2e enligt Verifiering. Synka inga andra typer.

## Verifiering (klar när — mekaniskt 0 FAIL, ingen frisör-regression)
- [ ] `0014` applicerad på branch; rollback testad på branch (app återgår till no-op-holds). Live-apply gatad på Zivar-OK.
- [ ] `packages/db/types.ts` regenererad — `slot_holds` + RPC:erna typsäkra; tsc 0.
- [ ] **EXCLUDE-backstopp (regression — bevisar CONSTRAINTET, ej holds):** två parallella `create_public_booking` på samma frisör/tid → exakt EN `bookingId`, den andra `23P01`→`slot_taken`. Aldrig två rader. (Detta skydd är redan live — testet låser det.)
- [ ] **Hold-kontention (kärnan i holds):** session A lägger ett hold på en tid → `getAvailableSlots` som session B erbjuder INTE längre den tiden. Session A ser den fortfarande (egen-session-exkludering bevisad).
- [ ] **Expiry-sweep:** ett hold som ej bekräftats släpps efter 5 min (utgånget hold) → tiden åter bokbar för andra. Testfall för (a) utgång via `expires_at`, (b) explicit `release_slot_hold` vid avbrott.
- [ ] **Egen session göms ALDRIG för sig själv:** med `sessionToken` satt visar `getAvailableSlots` kallarens egna hållna tid (regression-skydd mot dödläge i flödet).
- [ ] **Ingen regress i single-user:** befintliga booking-e2e + `availability.test.ts` gröna; range-frisörer (noll explicit-slots) får aldrig tom availability av hold-läsningen.
- [ ] **Perf:** hold-läsningen = EN query för hela staff-setet (ej N+1, ej paginering); utgångna exkluderas av index/`expires_at`-predikat — verifierat (queryplan/loggad query-räkning).
- [ ] Gates: vitest grönt, tsc 0, lint 0, opennext build, grep-guard ren. Worker-version + rollback-id noterade.
- [ ] Compliance: holds rör ALDRIG `no_double_booking`-EXCLUDE eller `create_public_booking`-semantiken (additiv, per `0014`-headern); `payment_status` orört.

## Anti-patterns
- ALDRIG framställa "dubbelbokning möjlig idag" som en bugg — EXCLUDE-constraintet är live backstopp. Holds = UX-kontention + testtäckning, inget annat.
- ALDRIG röra `no_double_booking`, `bookings`-schemat eller `create_public_booking`-semantiken (`0014` är medvetet additiv).
- ALDRIG paginera hold-läsningen — en missad aktiv hold = falskt ledig tid (korrekthetshål). EN batchad query, index-stödd.
- ALDRIG N+1 (en hold-query per frisör) — batcha för hela kandidat-setet som `get_busy_intervals`.
- ALDRIG dölja kallarens EGEN pågående tid för hen själv — exkludera egen `session_token`.
- ALDRIG skriva om RPC:erna — de finns i `0014`; denna goal wirar in dem.
- ALDRIG applicera migrationen live utan per-gång-Zivar-OK + advisor-consult på läsvägen.
- `session_token` är opak klient-nyckel (ej PII, ej auth) — RLS gatas på aktiv tenant, ägarskap drivs av token i app-vägen (`0014:30,68-95`).

## Kopplingar
`0014_slot_holds.sql` (READY-spec + RPC:er), `lib/booking/holds.ts` (ren filtreringslogik), `app/boka/actions.ts` (`getAvailableSlots`/`createBooking` = enda läs/skriv-väg), `BookingWizard.tsx` (step 3/4 seam), `no_double_booking` (`0001:164`, live backstopp), `create_public_booking` (`0005`, låter `23P01` bubbla). goal-40 (resurs/bord-holds bygger på denna staff-hold). M3 §2.2 (ursprungsspec).

## Rollback
Revertera `0014` (drop `slot_holds` + `place_slot_hold`/`release_slot_hold`/`prune_expired_slot_holds` + index), avwira hold-läsningen i `getAvailableSlots` (holds = no-op), `git revert`, `wrangler rollback <förra-version-id>`. Inga raderingar av booking-data — holds är kortlivade och self-pruning, så en revert lämnar inget kvar att städa. App återgår till exakt dagens beteende (bevisat i steg 3).
