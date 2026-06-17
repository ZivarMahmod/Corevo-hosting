# goal-41 — Kund-dedup / en identitet (gäst + manuell + bokning → EN rad)
Thinking: ⚫ (skriver `contact_hash`-backfill på ALLA historiska `customers`-rader + mergar dubblettrader som bär bokningshistorik + lojalitetspoäng = pengar/PII. Naiv "UPDATE customer_id + DELETE loser" KRASCHAR mot append-only-vakten på `loyalty_ledger` — fel merge tappar poäng tyst eller kraschar transaktionen. advisor-consult OBLIGATORISK på merge-mekaniken + backfill-pathen FÖRE live-migration. Rollback testad på branch.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. ⚫ kräver advisor-consult på (1) merge-mekaniken och (2) `contact_hash`-backfill-pathen innan migration körs live.

## Mål
Säker kund-**dedup** så samma fysiska person blir **EN identitet** oavsett väg in: gäst-bokning (goal-04 / `resolve_customer_id`), manuellt tillagd kund (goal-22 / `createPlatformCustomer`), och en senare bokning. Allt via DELAD normalisering (`public.customer_contact_hash` — telefon/e-post → `contact_hash`), aldrig en omimplementerad hash i TS. Får ALDRIG bryta RLS / cross-tenant-isoleringen.

## Lägeskoppling
FINSLIP — den bekräftade gränsen i goal-22 (`2-Byggplan/klart/02-ytor/salong-admin/goal-22-lagg-till-kund-drawer.md:12`). Bygger på kund-identitetslagret i `0011_customers_identity_and_schedule.sql` + resolvern i `0015_booking_customer_id_resolve.sql`. Roadmap-fas: `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md` (data-integritet före betal-rails aktiveras — en kund med splittrad historik = fel lojalitet/fel klientkort när pengar slås på).

## Problem (bekräftat i kod — inte antaganden)
1. **Gäst-bokning** mintar/återanvänder en `customers`-rad via `private.resolve_customer_id` (`0015:43-55`): nyckel = `(tenant_id, contact_hash)` via `public.customer_contact_hash(p_tenant, p_email, p_phone)`; ingen hashbar kontakt → `contact_hash` NULL → ingen rad-länk.
2. **Manuell kund** via `createPlatformCustomer` (`5-Kod/apps/web/lib/platform/actions.ts:631-642`) insertar `{tenant_id, full_name, display_name, email, phone, status}` UTAN `contact_hash` och UTAN `auth_user_id`. NULL `contact_hash` krockar ALDRIG på partial-unique-indexet `customers_tenant_contact_uniq` (`0011:205-206`, `where (contact_hash is not null)`).
3. **Följd:** samma person som först läggs in manuellt och sen bokar som gäst (eller tvärtom) → TVÅ separata rader. Ingen dedup. Dokumenterad gräns (goal-22:12), aldrig byggd — goal-22:s anti-pattern FÖRBJÖD `contact_hash` på manuell rad ("rätt hash kräver exakt samma normalisering som `resolve_customer_id` → risk > nytta"). **goal-41 reverserar det medvetet** nu när vi återanvänder den delade normaliseraren (`customer_contact_hash`) i stället för att skriva en ny — drift-risken som goal-22 vägde är borta. (Skriv detta i merge-PR:n så briefen inte läser som en motsägelse mot klart-doc.)

## Kontext (verifierade ankare)
- **Delad normalisering = ENDA sanningen:** `public.customer_contact_hash(p_tenant, p_email, p_phone)` (`0011:249-267`, `language sql immutable`): `lower(btrim(email))` ELLER (om e-post saknas) `regexp_replace(phone,'\D','','g')` (siffror-only — INTE äkta E.164, men deterministisk), tenant-saltad SHA256 via `extensions.digest`. Ingen hashbar kontakt → returnerar NULL. **Återanvänd denna fn — implementera ALDRIG om lower/trim/`\D`-strip/tenant-salt i TS** (det är precis driften goal-22 fruktade).
- **Partial-unique-index:** `customers_tenant_auth_uniq` `(tenant_id, auth_user_id) where (auth_user_id is not null)` + `customers_tenant_contact_uniq` `(tenant_id, contact_hash) where (contact_hash is not null)` (`0011:203-206`).
- **RLS-fence:** `customers_rls` (`0011:502-518`) = `is_platform_admin() OR (tenant_id = private.tenant_id() AND (role_level()>=3 OR auth_user_id=auth.uid()))`. Cross-tenant-merge är strukturellt omöjlig: hashen är tenant-saltad + indexet är per-`tenant_id`.
- **⚫ Merge-mekanik-spärr (load-bearing — ändrar merge-designen):** `loyalty_ledger` är append-only OCH `on delete cascade`. `trg_loyalty_no_update` + `trg_loyalty_no_delete` (`0011:456-468`) anropar `block_audit_mutation()` (`0002_rls.sql:84-91`) som är **OVILLKORLIG** — kastar på VARJE update/delete oavsett radinnehåll. Följd:
  - Kan **INTE** `UPDATE loyalty_ledger.customer_id` loser→survivor (no-update-vakten kastar).
  - Kan **INTE** hård-radera en loser-rad som bär lojalitet (cascade-DELETE på `loyalty_ledger` träffar no-delete-vakten → hela transaktionen faller).
  - → Merge MÅSTE vara **tombstone, inte move** (samma form som repo:ts GDPR-path: anonymisera, radera aldrig hårt).
- **Barn-FK till `customers(id)`:** `bookings.customer_id` (`0011:82`, **on delete set null** → plain UPDATE tillåten), `customer_favorites.customer_id` (cascade + unika `(customer_id, staff_id)`/`(customer_id, service_id)`, `0011:215-218`), `customer_notes.customer_id` (cascade + unik `(tenant_id, customer_id)`, `0011:157`), `loyalty_ledger.customer_id` (cascade + append-only, se ovan).
- **Lojalitet-läs-path (i scope):** `getLoyaltyView` (`5-Kod/apps/web/lib/kund/loyalty.ts:160-163`) och `getCustomerLoyaltyPointsPerVisit` (`:238-242`) läser `loyalty_ledger` med `.eq('customer_id', customerId)`. Lämnas loser-poäng kvar under loser-id försvinner de ur UI:t även om raderna finns kvar → läs-pathen MÅSTE summera över merge-kedjan (`merged_into`), annars ljuger DoD:t "lojalitet tappas ej".

## Dedup-axel (var ärlig — över-claima inte "EN identitet")
goal-41 löser **`contact_hash`-axeln** (gäst + manuell). Inloggade rader nycklar på `auth_user_id` och lämnar `contact_hash` NULL **by design** (`0015:31-41`) → en inloggad bokning mergas INTE med en manuell rad via hash. Testfall (b) funkar därför bara om den senare bokningen sker **som gäst** (sägs explicit i testet). Authed↔contact-rekonciliering = uttalad `## Kvar`-rad nedan, inte tyst med i scope.

## Berörda filer
- `5-Kod/supabase/migrations/00XX_kund_dedup_merge.sql` — **NY.** Grep nästa lediga nummer vid bygg (högst applicerad = `0038`; ≈`0039`, men `goal-40` reserverar också ett `00XX`-slot → undvik kollision). Idempotent, numrerad, `set search_path`, rollback-fil bredvid (mönster `0038_*_rollback.sql`). Innehåll: `customers.merged_into uuid` self-FK + merge-fn (SECURITY DEFINER, tenant-fence inuti) + backfill-via-merge-path.
- `5-Kod/apps/web/lib/platform/actions.ts` — `createPlatformCustomer`: byt rå `insert` → **upsert på `(tenant_id, contact_hash)`** och sätt `contact_hash = customer_contact_hash(tenant, email, phone)` (via RPC/SECURITY DEFINER, inte TS-hash). Annars kastar första manuella add av någon som redan bokat som gäst en unique-violation i stället för att återanvända raden.
- `5-Kod/apps/web/lib/kund/loyalty.ts` — `getLoyaltyView` + `getCustomerLoyaltyPointsPerVisit`: summera ledger över merge-kedjan (survivor + alla `merged_into = survivor`), inte bara `.eq('customer_id', survivor)`.
- `@corevo/db`-typer — synka mot migrationen (`merged_into`).
- Test: ny vitest-svit för dedup/merge + manuell-add-upsert.
- *(grep fram exakta sökvägar + ev. fler `loyalty_ledger`-/`customers`-läsare innan ändring — inventera ALLA `.eq('customer_id', ...)`-läsare; en oövergiven läsare = tyst datatapp.)*

## Spec — definiera i klartext (ingen tyst tolkning)
1. **Normaliserings-regel:** EXAKT `public.customer_contact_hash` (`0011:249-267`). E-post: `lower(btrim)`. Telefon: `\D`-strip (siffror-only). E-post vinner när båda finns (hashen bygger på e-post om den finns, annars telefon — speglar resolvern). Tenant-saltad. Ingen TS-omimplementering. (Not: detta är INTE äkta E.164; om vi vill normalisera `+46`/`0046`/`07…` till en kanonisk form är det en separat, hash-kompatibel ändring i `customer_contact_hash` själv som kräver backfill-omkörning — `## Kvar`-kandidat, inte tyst i denna goal.)
2. **Backfill-strategi (⚫ riskigaste enskilda op — alla historiska rader):** för varje `customers`-rad med `contact_hash IS NULL` men hashbar `email`/`phone`: beräkna `customer_contact_hash`. Backfillen är DÄR krockarna uppstår — den måste gå **GENOM merge-pathen**, inte en blind `UPDATE customers SET contact_hash=...` (som kastar på `customers_tenant_contact_uniq` så fort två rader hashar lika). Dry-run-count FÖRST (hur många rader får hash, hur många kollisioner → merges). Idempotent (återkörbar). advisor + Zivar-OK FÖRE live.
3. **Merge-semantik (tombstone, inte move):**
   - **Vinnare (survivor):** den ÄLDSTA raden (`first_seen_at` min, tie-break `created_at`/`id`) — stabilast band till befintlig historik. Skriv ut regeln; ingen tyst tolkning.
   - **Förlorare (loser):** sätt `merged_into = survivor.id`, `status` lämnas (radera ALDRIG hårt — append-only-vakten + GDPR-stub-mönstret). Loser slutar dyka upp i kundlistor (lägg `where merged_into is null`-filter i läs-pathar / lista).
   - **`bookings.customer_id`:** plain `UPDATE ... SET customer_id = survivor WHERE customer_id = loser` (FK är `on delete set null` → update tillåten). Bokningshistoriken följer med.
   - **`loyalty_ledger`:** RÖR ALDRIG raderna (kan ej update/delete:as). Poäng "följer med" genom att läs-pathen summerar survivor + hela `merged_into`-kedjan. Belt-and-suspenders: bevisa att inga poäng dubbelräknas (en rad tillhör exakt en loser/survivor).
   - **`customer_favorites`:** repoint till survivor med `on conflict do nothing` (unika `(customer_id, staff_id)`/`(customer_id, service_id)` → dubblettfavorit droppas tyst, ingen krasch).
   - **`customer_notes`:** unik `(tenant_id, customer_id)` → om BÅDA har ett klientkort = explicit pick-regel (survivors kort vinner; losers kort behålls EJ tyst eller mergas in i `internal_note` — välj och skriv ut; ingen tyst förlust av ett klientkort).
4. **`merged_into` self-FK:** `uuid references public.customers(id) on delete set null`, default NULL. Index för kedje-läsning. Aktiva rader = `merged_into is null`.
5. **Idempotens:** hela migrationen + merge-fn återkörbar (re-apply = no-op). En redan mergad loser mergas inte igen.

## Verifiering (klar när — mekaniskt 0 FAIL, ingen ögonmått)
- [ ] Migration applicerad (`customers.merged_into` finns; merge-fn finns); **rollback testad på branch** (separat `_rollback.sql`).
- [ ] **Testfall (a):** gäst bokar (rad m. `contact_hash`) → manuell kund med SAMMA tel/e-post läggs senare → upsert återanvänder raden → **EN rad** (`select count(*) ... where contact_hash = ...` = 1).
- [ ] **Testfall (b):** manuell kund FÖRST (nu med `contact_hash`) → samma person bokar **som gäst** → resolvern träffar samma `(tenant, contact_hash)` → **EN rad**. (Inloggad-bokning-axeln = `## Kvar`, inte detta test.)
- [ ] **Testfall (c):** två OLIKA personer (olika tel + olika e-post) → **SEPARATA rader** (ingen falsk merge; bevisa hashar skiljer).
- [ ] **Testfall (d) cross-tenant:** samma tel/e-post i två tenants → **ALDRIG merge** (RLS-fence). Bevisas by construction — `customer_contact_hash` saltar med `p_tenant` + indexet är `(tenant_id, contact_hash)`; testet bekräftar bara, inget designarbete.
- [ ] **Lojalitet följer med:** merga två rader där loser bär `loyalty_ledger`-poäng → survivors `getLoyaltyView`-balance = summan av båda; **0 poäng tappade, 0 dubbelräknade**. (Bevisa mot läs-pathen, inte bara mot DB-raderna.)
- [ ] **Bokningshistorik följer med:** survivors bokningslista = bådas bokningar efter merge.
- [ ] **Klientkort-kollision:** två rader med var sitt `customer_notes` → den uttalade pick/merge-regeln håller; inget kort försvinner tyst.
- [ ] **Backfill dry-run-count** loggad (rader som får hash + antal merges) FÖRE live-körning; idempotent (re-apply = 0 nya merges).
- [ ] **⚫ advisor-consult** på (1) merge-mekaniken (tombstone vs move, append-only-vakten) och (2) backfill-via-merge-pathen, FÖRE live-migration. Zivar-OK på schema + backfill.
- [ ] Gröna gates: vitest grönt, `tsc` 0, lint 0. Om kod ändras (actions.ts/loyalty.ts): bygg via `C:\tmp\kod` + grep-guard + innehålls-smoke; worker-version + rollback-id noterade.
- [ ] Compliance: ingen PII läcker cross-tenant; GDPR-erase-pathen (`lib/gdpr/erase.ts`) fungerar fortfarande på en mergad survivor (merge får inte göra en kund o-raderbar).
- [ ] **⚠️ GDPR-kedja (load-bearing):** erase MÅSTE anonymisera/scrubba HELA merge-kedjan (survivor + ALLA `merged_into`-losers). Loser-tombstones bär kvar `full_name/email/phone` + den nyss backfillade `contact_hash` — en erase keyad på survivor/`auth_user_id` rör dem aldrig → PII överlever "rätten att bli glömd" (exakt P2-regressionen i `0011:34-41`; `scrub_customer_notes_on_anonymize` `0011:357-367` nollar dessutom BARA `customer_notes`, inte PII-kolumnerna). Namnge kravet — implementeras av byggaren, men får ej tappas tyst.

## Anti-patterns
- ALDRIG omimplementera normaliseringen i TS — anropa `public.customer_contact_hash` (drift = den exakta bugg goal-22 fruktade).
- ALDRIG `UPDATE`/`DELETE` på `loyalty_ledger` (append-only-vakt kastar → transaktionen faller). Merge = tombstone, poäng summeras via läs-pathen.
- ALDRIG hård-radera en loser-rad (cascade träffar no-delete-vakten; GDPR-mönstret raderar aldrig hårt).
- ALDRIG blind `UPDATE customers SET contact_hash` i backfillen (kastar på unique-index) — gå genom merge-pathen.
- ALDRIG röra `customer_profile_id` (fryst live-RLS/GDPR-nyckel; `0011:12`) eller `auth_user_id`-grenen.
- ALDRIG merge:a över tenant-gräns (hashen är tenant-saltad — bekräfta, bryt inte).
- ALDRIG lämna loser-tombstones med kvar-PII vid GDPR-erase — scrubba hela `merged_into`-kedjan (annars en GDPR-regression införd av denna migration).
- Aktivera INTE betal-rails/Stripe som del av detta (separat ägar-steg).

## Kopplingar
`0011_customers_identity_and_schedule.sql` (identitet + index + vaktar), `0015_booking_customer_id_resolve.sql` (resolver + delad hash), goal-22 (bekräftad gräns + reverserad anti-pattern), `lib/kund/loyalty.ts` (läs-path i scope), `lib/platform/actions.ts` (manuell add → upsert), `lib/gdpr/erase.ts` (får ej regressa). fix-26 (betal-rails-gate) = parallell dataintegritets-förutsättning före pengar.

## Kvar (uttalat — inte tyst med i scope)
- **Authed↔contact-rekonciliering:** en inloggad rad (`auth_user_id` satt, `contact_hash` NULL by design) mergas inte automatiskt med en manuell/gäst-rad för samma fysiska person. Kräver egen regel (matcha på `users.email`/`phone` → samma hash) + advisor — separat iteration.
- **Äkta E.164-normalisering** av telefon (kanonisera `+46`/`0046`/`07…`) = hash-kompatibel ändring i `customer_contact_hash` + backfill-omkörning — separat goal.

## Rollback
Ren verify (inga merges körda) = ingen. Vid migration: kör `_rollback.sql` (`DROP COLUMN merged_into`, droppa merge-fn). ⚠️ En körd merge är INTE trivialt reversibel (loser-flaggad, bokningar repointade) — därför dry-run-count + advisor + Zivar-OK FÖRE live, och ALDRIG hård-radering (loser-raderna finns kvar = manuell un-merge möjlig). Kod: `git revert` + `wrangler rollback <förra-version-id>`. Inga raderingar av kund-/boknings-/lojalitets-data.
