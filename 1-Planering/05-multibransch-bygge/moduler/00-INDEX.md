# Modul-specer — index + verifiering (2026-06-17)

> Oberoende verifiering av de 16 modul-specerna i denna mapp mot DB-sanningen
> (`4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`), backloggen
> (`../09-modul-bransch-spec-backlog.md`) och universal-principen (`../10-arkitekturprincip-universal-vs-variant.md`).
> Planering only — ingen kod rörd. Granskaren byggde inte specerna.

## Status per modul

| Modul | LIVE/VARIANT/NY | Branscher (från backloggen) | Fil |
|---|---|---|---|
| booking | LIVE (variant-config = nybygge) | frisör, nagel, klinik, bilverkstad, cykel, hund, tatuering, restaurang, städ, fotograf, skräddare, optiker | `booking.md` |
| shop | LIVE | florist, café, optiker, second hand, cykel, frisör, hund(opt), nagel(opt) | `shop.md` |
| offert | LIVE | florist, bilverkstad, tatuering, städ, fotograf, skräddare, cykel | `offert.md` |
| lojalitet | LIVE | frisör, nagel, hund, café, restaurang | `lojalitet.md` |
| presentkort | LIVE | frisör, nagel, florist, café, restaurang, fotograf (+opt) | `presentkort.md` |
| blogg | LIVE | alla (universell opt-in, default off) | `blogg.md` |
| media_library | LIVE (infra, ingen publik yta) | alla (infra) | `media_library.md` |
| recurring | NY (`booking_series`) | städ, klinik | `recurring.md` |
| deposit | NY (`payments`-grind) | tatuering (+ universell flat-variant förberedd) | `deposit.md` |
| fordon | NY (`vehicles`) | bilverkstad | `fordon.md` |
| husdjur | NY (`pets`) | hund | `husdjur.md` |
| intag | NY (`intake_forms`, hård RLS) | privatklinik | `intag.md` |
| inlamning | NY (`intake_items`) | cykel, skräddare, second hand | `inlamning.md` |
| orderstatus | NY (`work_orders`) | bilverkstad, skräddare | `orderstatus.md` |
| meny | NY (`menu_categories`+`menu_items`) | restaurang, café | `meny.md` |
| portfolio | NY (`portfolio_items`) | tatuering, nagel, fotograf | `portfolio.md` |

7 LIVE matchar exakt DB-sanningens 7 (`booking, shop, offert, lojalitet, presentkort, blogg, media_library`). 9 NY matchar backloggens 9 roadmap-moduler.

## Verifierings-verdikt

**PASS MED ANMÄRKNING** — alla 16 specer är DB-trogna, principföljande och täcker hela backlog-matrisen (16/16 moduler, 0 saknade bransch-rader). Endast en äkta cross-modul-lucka (offert↔fordon, ensidigt deklarerad) + tre namn-/schema-beslut som specerna själva redan flaggar men som måste landas före bygg.

## Avvikelser att rätta

### DB-kontradiktioner mot 02-Arkitektur-sanning
- **Inga raka motsägelser.** Tabellnamn, status-enum, `variant_schema`, RLS och anon-läs-policy i alla §4 stämmer med live-schemat. Specerna citerar DB-sanningen rätt (t.ex. booking owns `staff`/`staff_id`, lojalitet owns `loyalty_ledger`, shop `shop_products`/`shop_orders`/`shop_order_items`).
- **booking `variant_schema` (löst rätt, men öppet beslut):** `02-Arkitektur-sanning §1.1` säger `variant_schema:{}`; mockup/RITNING säger `verticals.rules.booking.object`. `booking.md:23` har ⚠️-callout och resolvar korrekt: varianten bor i `verticals.rules` (lager 2), DB:s `{}` är rätt. Ingen kontradiktion kvar — men `booking.md §8.1` lyfter den för Zivars formella OK.
- **shop_orders status (löst, DB vinner):** mockupens "ny→packad→hämtad" och cfg-data "draft" förkastas explicit i `shop.md:50` till förmån för DB-enumet `pending, confirmed, ready, completed, cancelled`. Korrekt.
- **lojalitet takt-källa (löst, DB vinner):** `lojalitet.md §6` slår fast att triggern (0016) läser `tenant_settings.settings.loyalty.points_per_visit` — INTE `variant_schema`/modul-config. Synk-kravet är dokumenterat. Korrekt mot DB.

### Namnkonflikter (cross-modul)
- **`vehicles` vs `vehicle_profiles` / `pets` vs `pet_profiles`** — specerna är internt konsekventa: `fordon.md §4` använder `vehicles`, `husdjur.md §4` använder `pets`, och booking.md refererar `vehicle_id`/`pet_id` mot dem. Konflikten är mot mockup-koden: `kund-admin/surfaces-more.jsx` använder `vehicle_profiles` i sina `MT keys`. Flaggat på båda håll (`fordon.md:112`, `husdjur.md:118`). **Inte en kontradiktion mellan specerna — ett pending namn-beslut** (välj `vehicles`/`pets` ELLER `vehicle_profiles`/`pet_profiles`, var konsekvent). Rätt värde enligt cfg-data + DB-sanning §7.2-exempel: **`vehicles`/`pets`**.
- **Status-set-namn (inte konflikt, klargörande):** `intake_items.status` (`mottagen/godkänd/avböjd/kopplad/klar`, inlamning.md:32) och `work_orders.status` (`mottagen/under_arbete/klar_for_hamtning`, orderstatus.md:28) är TVÅ olika set på TVÅ olika tabeller (inlämning föder work_order). Korrekt separerade och cross-refererade — ingen rättning.

### Principbrott (per-bransch-fork / kund-specifik kod)
- **Inga.** Varje spec §2/§3 avslutar med en uttrycklig "aldrig ny modul per bransch / EN motor, flera config"-rad (princip 10). Alla bransch-skillnader uttrycks som `variant_schema` + `verticals.rules` + `terminology` + `tenant_modules.config`. Inga florist-shop/café-shop-forkar, inga hårdkodade kund-grenar.

### Cross-modul-kopplingar
- **offert↔fordon — ENSIDIG (rätta):** `fordon.md:76,82` lägger `offert_requests.vehicle_id` FK och listar offert som återanvändning (`reuse=[booking,offert]`), men `offert.md §3` bilverkstad-rad (`offert.md:20`) listar "Regnr · Märke & modell" som **fria fält** och nämner aldrig fordon-modulen eller FK:n. Rätta: lägg fordon-koppling i offert.md §3/§4 (eller notera medvetet att bilverkstad-offert fångar regnr som fritext i `details` tills fordon byggs).
- Alla övriga kopplingar deklareras på **båda** sidor: booking↔deposit, booking↔husdjur, booking↔fordon, booking↔intag, booking↔recurring, inlamning↔orderstatus, offert↔deposit, portfolio↔media_library, meny↔shop. OK.

## Täckning

**16/16 moduler täckta. 0 saknade bransch×modul-rader.** Programmatisk avstämning av varje modul mot dess backlog-branscher (09-backlog per-bransch-sektion) → varje förväntad bransch finns som rad i rätt spec §3:
- booking 12/12 · shop 8/8 · offert 7/7 · presentkort 6/6 · lojalitet 5/5 · inlamning 3/3 · portfolio 3/3 · recurring 2/2 · orderstatus 2/2 · meny 2/2 · husdjur 1/1 · fordon 1/1 · deposit 1/1 · intag 1/1 · blogg (universell) · media_library (infra).
- Specerna går t.o.m. UTÖVER backloggen: booking, fordon, husdjur, meny, portfolio listar HELA `cfg-data.BRANCHES` (inkl. låssmed, second hand m.fl.) med `off`-rad för fullständighet.
- **Inga luckor.** Branscher som backloggen INTE kopplar till en modul står korrekt som `off`/`opt` med motivering.

## Konsoliderade öppna beslut för Zivar

Dedupe från alla 16 §8, prioriterad. Schema-beslut kräver Zivars "go" (build-once-never-delete).

### A. Schema-beslut (måste landas före bygg av NY-moduler)
1. **Namn-konvention `vehicles`/`pets` vs `vehicle_profiles`/`pet_profiles`** — välj en, rätta mockup-koden därefter (fordon §8.1, husdjur §8.1). Rek: `vehicles`/`pets`.
2. **booking-varianten bor i `verticals.rules`, inte modul-enum** — bekräfta (booking §8.1; DB-sanning §1.1 stödjer).
3. **Koppling: dedikerade FK-kolumner (`vehicle_id`/`pet_id`/`series_id`) vs generisk capture-JSON i `bookings`** — rek: explicit FK (booking §8.4-5, fordon §8.2, husdjur §8.2, recurring §8.6).
4. **`bookings.party_size` + `.address` + `restaurang object:table`-kapacitetsmodell** (bord vs staff-rader) — schema-go (booking §8.2-4).
5. **`payments`-tabell delad (deposit+shop+presentkort) eller deposit-specifik** när rails öppnas (deposit §8.5).
6. **recurring: enkelt `frequency+interval+until`-enum vs full rrule** — rek: börja enkelt; rullande genererings-fönster via cron (recurring §8.1-2).
7. **orderstatus: egen `work_order_status_history` vs generalisera booking-historikmönstret** — rek: analog egen tabell (orderstatus §8.1).
8. **meny: separata `menu_categories`+`menu_items` vs kategori-enum** — rek: separata tabeller (meny §8.3).

### B. Legala (blockerar vissa moduler)
9. **intag rättslig grund** — bygg INTE samtycke som enda grund; vård = Art 6.1c/e + Art 9.2h, samtycke endast icke-vård + Corevo = personuppgiftsbiträde (DPA-avtal). Patientdatalagen (journal/åtkomstlogg/gallring). **Bör vänta tills betalande klinik + juridisk granskning** (intag §8.1,3,5).
10. **meny allergen-modell** — fast EU-14-lista (koder, för ikoner+filter+juridik) vs fritext; obligatorisk ifyllnad vs disclaimer (meny §8.1-2). Juridiskt krav att info finns.
11. **orderstatus/aviserings-samtycke** — måste kund aktivt välja SMS/mail (GDPR) eller räcker lämnad kontaktuppgift (orderstatus §8.5).
12. **GDPR-känsliga fält RLS** — `pets.allergies`/hälsoanteckning snävare (endast personal, jfr `customer_notes`)? (husdjur §8.5).

### C. Betal/moms (plattformsbrett, blockerar go-live med pengar)
13. **Moms + kvitto + kassaregisterkrav** måste vara klart före riktiga pengar (deposit §8.3 — plattformsbrett, inte bara deposit).
14. **Momssats per orderrad/kolumn** — additiv kolumn nu (förbered rails) eller vänta (shop §8.5).
15. **REDEEM/inlösen** (lojalitet, presentkort) nu (saldo-drag, inga pengar) eller med rails (lojalitet §8.3, presentkort §8.2).
16. **Presentkort voucher-typ** (flerfunktion → moms vid inlösen) (presentkort §8.1).

### D. Kopplings-/flödesbeslut
17. **"Leder till"-automatik** — accepterad offert auto-skapar booking-utkast / triggar deposit / startar recurring, eller manuellt (offert §8.2, deposit §8.2).
18. **lojalitet café-intjäning** — ny trigger på `shop_orders` vid `completed` vs `paid`; poäng per krona (lojalitet §8.2). Se kod-gap nedan.
19. **lojalitet takt-källa** — låt triggern läsa `tenant_modules.config` (en källa) i st.f. `tenant_settings` (lojalitet §8.1).
20. **Anon vs inloggad inlämning/walk-in** — får besökare lämna in / tjäna lojalitet utan konto (inlamning §8.1, lojalitet §8.5).

### E. Infra/UX (lägre risk)
21. **media: kvot-enforcement** (hård block vs mjuk+fakturera), optimering (Cloudflare Images vs sharp), R2 signed-upload vs Worker-proxy (media §8.1-5).
22. **blogg: detaljsidor `/blogg/<slug>` + kategorier** vs enkel feed (blogg §8.1-2).
23. **Kodformat presentkort/kvittonr** (läsbar vs slumpad) (presentkort §8.5, inlamning §8.2).

## Kända kod-gap

Saker som INTE finns i koden än (medvetna luckor / build-once, ej buggar):

- **shop saknar varukorg + checkout** — `shop_products`/`shop_orders`/`shop_order_items` + RLS finns (0031/0032), men storefront-varukorg och order-INSERT-flöde är ej byggt; betal-rails pausade (`payment.enabled=false`). (shop §7a, §8.1)
- **lojalitet café shop-intjäning saknas** — triggern `earn_loyalty_on_completed()` (0016) tjänar BARA på `bookings→completed`, aldrig på `shop_orders`. Café (som ofta saknar bokning) ger idag **noll poäng**. Kräver ny trigger på `shop_orders`. (lojalitet §3, §6)
- **lojalitet REDEEM saknas** — kund kan tjäna men inte lösa in; "10:e besöket gratis" är bara visuellt. Kräver `reason='redeem'` + saldo-grind. (lojalitet §6, §8.3)
- **lojalitet walk-in/anon tjänar inte** — triggern SKIPpar om `customer_id` saknas; för frisör med många icke-inloggade en lucka. (lojalitet §6)
- **media_library: signed R2-upload, auto-optimering, hård kvot-enforcement** ligger utanför DB och är delvis obyggt. (media §4, §7)
- **booking bransch-medveten rendering** (`object: slot/table/dropoff/syntest` ur `verticals.rules`) — enda riktiga modul-nybygget bland LIVE; config-driven, inga nya tabeller men ny render-logik. (booking §7)
- **De 9 NY-modulerna** (recurring, deposit, fordon, husdjur, intag, inlamning, orderstatus, meny, portfolio) — namngivna och spec:ade, men `modules`-rad + tabell + RLS finns EJ. Byggs en i taget per riktig kund (Fas D), schema bara på Zivars go. (09-backlog, princip 10)
- **Betal-rails pausade plattformsbrett** — shop/presentkort/offert/deposit har alla `payment_status`-kolumner men ingen provider; inga pengar rör sig (DB-sanning beslut 14.2).
