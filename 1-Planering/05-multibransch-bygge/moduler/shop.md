# Modul: Webshop (shop)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md` (EN universal motor, anpassning = config). DB-sanning: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md` §1.2 + migrationer `5-Kod/supabase/migrations/0031_shop_module_register.sql` + `0032_shop_tables_rls.sql`. Status: ✅ **LIVE** (rad i `modules`, tabeller `shop_products`/`shop_orders`/`shop_order_items`, RLS på). **Detta är bevis-modulen för principen: EN motor + fulfilment-variant, aldrig en shop per bransch.**

## 1. Kärna (universell)
Företaget lägger upp produkter (`shop_products`) → besökaren bläddrar, lägger i varukorg och lägger en order (`shop_orders` + `shop_order_items`). EN modul, tre tabeller, ALLA shop-branscher (florist, café, optiker, second hand, cykel, frisör, + opt hund/nagel). Order-raden **snapshottar** produktnamn + pris vid läggning (`shop_order_items.product_name`/`unit_price_cents`) → historik är orörd även om produkten senare ändras/avaktiveras. Betal-rails PAUSADE (beslut 14.2): varukorg + order skapas (`payment_status='unpaid'`), men inga pengar rör sig — `default_config.payment` är en TOM hook (`provider=null, enabled=false`). Anon får läsa `shop_products` (publik storefront, app-lagret filtrerar tenant_id); ordrar är **aldrig** anon-läsbara (privat). Order-statuskedjan flyttas av personal i admin.

## 2. Universal vs variant — beslut + axlar
**Variant, aldrig fork.** Florist-shop och café-shop skiljer sig i *hur varan når kunden* och *vilka fält som fångas vid köp* — ren data/config. **Skillnaden är aldrig en annan tabell → alltid variant.** Detta är själva exemplet Zivar frågade om; svaret står ordagrant i 0031: "beteende-skillnader = varianter inuti modulen, aldrig `if (bransch)` i motorn."

- **`variant_schema.fulfilment`** (enum, **snapshottas på `shop_orders.fulfilment` vid orderläggning**):
  - `ship` — posta hem (frakt). Default. Fyller `ship_address`.
  - `pickup_within_days` — handla online, hämta i butik inom X dagar. Param `pickup_days` (int, def 3). Fyller `pickup_location_id` + `pickup_by` (senast-hämta-datum).
  - `order_in_then_pickup` — beställ hem varan till butik, hämta sen. Param `lead_days` (int, def 7). Fyller `pickup_location_id` + `ready_at` (beräknad klar-tid).
  - Labels (ur 0031): "Posta hem" · "Hämta i butik inom X dagar" · "Beställ hem till butik & hämta".
- **Schema är variant-agnostiskt:** EN tabellmodell rymmer alla tre varianter. De variant-specifika kolumnerna (`ship_address`, `pickup_location_id`, `pickup_by`, `ready_at`) är nullable och fylls bara av den variant som använder dem. **Ingen fork per variant.**
- **`tenant_modules.config`** = per-kund-finjustering ovanpå branschens default-variant (egen `pickup_days`, egen valuta, egen fulfilment).
- **`verticals.terminology`** styr orden runt produkten (Produkt vs Vara vs Arrangemang).
- **Tilläggsfält per bransch** (datum, adress, recept-upload, lager=1) = config + befintliga nullable-kolumner / `media_assets`, INTE nya kolumner per bransch.
- **Varför aldrig forkad:** en bugg i varukorgen fixas en gång → alla branscher; ny shop-bransch = en `verticals`-rad + vald default-variant, noll kod. "Bygg uttag, inte apparater."

## 3. Per bransch
| Bransch | variant-val (fulfilment) | UI-skillnad (storefront) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| **Florist** 🌱 | `ship` + `pickup_within_days` | Vid köp: **leveransdatum** + **mottagaradress** (`ship_address`) ELLER butiksupphämtning; hälsningstext-fält | Välj bukett → datum + adress → order; säsongs-buketter | Blombud i SE levereras på vald dag, ofta samma dag vid beställning före cutoff (Interflora: vard. 14:00 / lör 12:00); adress + datum är kärnan |
| **Café / Konditori** 🌱 | `order_in_then_pickup` | **Förbeställ tårta** + **hämtdatum** (`pickup_by`/`ready_at`); lead-dagar visas ("beställ X dagar innan") | Beställ tårta → välj hämtdag (≥ lead_days) → order; hämtas i butik | Tårtor bakas på beställning; lead-tid varierar per bageri (ex. helg kräver fredag/lördag-beställning); ingen hemleverans behövs |
| **Optiker** 🌱 | `order_in_then_pickup` | Bågval + **receptkoppling**: kund laddar upp/anger recept (→ `media_assets` / `details`); "hämtas efter slipning" | Välj båge → bifoga recept → order → slipas → hämtas | Glas slipas efter recept (giltigt ~2 år i SE); kan ej skickas direkt — beställ-hem-till-butik passar exakt |
| **Second hand** ✅ | `pickup_within_days` | **Unika varor, lager = 1** (`stock=1`); "reservera, hämta inom X dagar"; säljs = döljs | Hitta unikt plagg → reservera → hämta i butik; matar från modul `inlamning` | Konsignation = varje plagg unikt (Judits: 30-dagars-fönster, säljaren får 40%); kan ej "beställa fler" |
| **Cykelbutik** 🌱 | `ship` + `pickup_within_days` | Standard produktshop (delar/tillbehör); frakt eller hämta | Lägg delar i varukorg → frakt/hämta → order | Reservdelar är standard-lagervaror; vanlig e-handel |
| **Frisör** ✅ | `ship` + `pickup_within_days` | Hårvårdsprodukter; frakt eller hämta vid nästa besök | Köp schampo/styling → frakt/hämta | Retail-merförsäljning vid sidan av bokning; enkel produktshop |
| **Hund** 🌱 (opt) / **Nagel** ✅ (opt) | `ship` + `pickup_within_days` | Pälsvård / nagelprodukter; frakt eller hämta | Standard produktshop | Komplement till bokning; default off, slås på per kund |
| Restaurang ✅ / Klinik 🌱 / Bilverkstad 🌱 m.fl. | (default off) | — | Shop default av (meny/booking/offert bär behovet) | Bär inte produkthandel som kärna |

## 4. DB-form (LIVE — migrationer 0031 register + 0032 tabeller/RLS)
**`public.shop_products`** (produktkatalog/tenant): `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants (cascade) · `name` NOT NULL · `slug` · `description` · `price_cents` int NOT NULL def 0 CHECK ≥0 (minsta valuta-enhet) · `currency` text def SEK · `stock` int CHECK (null=ospårat/obegränsat ELLER ≥0; **second hand sätter 1**) · `image_asset_id` uuid FK→media_assets (set null) · `active` boolean def true (false=dold, ej raderad) · `sort_order` int · `created_at` · `updated_at`. Index: tenant, (tenant,active).

**`public.shop_orders`** (header + fulfilment-snapshot + status): `id` · `tenant_id` FK (cascade) · `customer_id` FK→customers (set null, känd kund om inloggad) · `customer_name`/`_email`/`_phone` (kan vara anon) · **`fulfilment` text NOT NULL def `ship` CHECK in (ship, pickup_within_days, order_in_then_pickup)** — snapshot av vald variant · **variant-fält (nullable):** `ship_address` (ship) · `pickup_location_id` uuid FK→locations (pickup-varianter) · `pickup_by` date (pickup_within_days: senast-hämta) · `ready_at` timestamptz (order_in_then_pickup: klar-tid) · `total_cents` int CHECK ≥0 (summeras ur items) · `currency` SEK · `status` text NOT NULL def `pending` CHECK in (**pending, confirmed, ready, completed, cancelled**) · `payment_status` text def `unpaid` CHECK in (unpaid, paid, refunded) — **ren status, ingen provider** · `note` · `created_at`/`updated_at`. Index: tenant, (tenant,status), customer.

**`public.shop_order_items`** (rader, produkt-snapshot): `id` · `tenant_id` FK (cascade, denormaliserat för RLS) · `order_id` FK→shop_orders (cascade) · `product_id` FK→shop_products (set null om borttagen) · `product_name` NOT NULL (snapshot) · `unit_price_cents` int CHECK ≥0 (snapshot) · `quantity` int CHECK >0 · `created_at`. Index: order, tenant.

**RLS** (0032, mönster ur 0027): alla tre tenant-scoped `for all to authenticated using/with check (tenant_id = (select private.tenant_id()) or is_platform_admin())`. **`shop_products` har dessutom `shop_products_public_read for select to anon using(true)`** (publik produktläsning; app-lagret filtrerar tenant_id). **`shop_orders` + `shop_order_items` har INGEN anon-policy** (ordrar är privata). Grants: select på products→anon+authenticated; full CRUD på alla tre→authenticated. `set_updated_at`-trigger på products + orders.

> **NY:** ingen ny tabell krävs för någon shop-bransch. Recept (optiker) + hälsning (florist) lever i `media_assets` / order-`note`; lager=1 (second hand) är bara ett värde i `stock`. **Allt är variant + config på befintligt schema.**

## 5. Två ytor — Storefront + Admin
- **Storefront** (`5-Kod/apps/web/components/storefront/ShopSection.tsx` + `ShopCta.tsx`): produktgrid + produktsida, gatad på `tenant_modules.state='live'`. **Sektionen beter sig per `config.fulfilment`** (header i ShopSection.tsx bekräftar): `ship` → "Posta hem" + CTA "Lägg i kundvagn"; `pickup_within_days` → "Hämta i butik inom X dagar" + CTA "Reservera"; `order_in_then_pickup` → beställ-hem-till-butik. MODULE_FACE sf: *"Besökaren bläddrar produkter och lägger i varukorg (betalning pausad)."*
- **Admin** (`5-Kod/apps/web/components/admin/ShopAdmin.tsx`, design `kund-admin/surfaces-more.jsx` → `Produkter` + `Ordrar`): **Produkter** — CRUD (namn, pris, lager, bild via media_assets). **Ordrar** — lista med Order / Kund / Antal / Summa / **Leverans** (fulfilment-label) / Status; ägaren flyttar status. ShopAdmin.tsx har redan fulfilment-display-label. MODULE_FACE adm: *"Ägaren lägger upp produkter, priser, lager och bilder."* "Tändes för att du aktiverade Webshop."

## 6. Verklighets-koll
- **Status-mismatch (löst, DB vinner):** mockup (`surfaces-more.jsx` Ordrar) säger *"ny → packad → hämtad"* och cfg-data säger order skapas som *"draft"*. **DB-enumet är `pending/confirmed/ready/completed/cancelled` + `payment_status unpaid/paid/refunded`.** Bygg mot DB. Svenska UI-etiketter får mappas (Ny/Bekräftad/Klar att hämta/Slutförd/Avbruten) men *värdet* är DB-enumet. cfg-data's "draft" finns inte i schemat.
- **Mockup renderar INTE varianten:** `preview.jsx` ModShop är en generisk 3-kolumners grid med "Köp"-pill — **ingen** leverans/datum/adress-fält. Det är design-bristen, inte sanningen; **DB+ShopSection har varianten.** Bygg variant-UI:t, kopiera inte den platta mockupen.
- **Florist (datum/adress):** leveransdatum + mottagaradress måste fångas vid köp (`pickup_by`/`ship_address`). Svensk verklighet: cutoff-tider för samma-dag-leverans (Interflora vard. 14:00 / lör 12:00) → en cutoff-regel hör i `config`, inte hårdkod.
- **Café (förbeställ):** hämtdatum måste vara ≥ `lead_days` framåt; helg-stängt-bageri = lead-tid kan hoppa över dagar. Validera i app-lagret (DB tvingar inte minsta-datum).
- **Optiker (recept):** receptkoppling är **känslig hälsodata** — lagra i `media_assets`/`details`, exponera aldrig anon; recept giltigt ~2 år (affärsregel, ej DB-tvång).
- **Second hand (lager=1):** `stock=1` + "sälj döljer" kräver att order-läggning dekrementerar/avaktiverar atomiskt så två kunder inte reserverar samma unika plagg (race → app-lager/RPC, jfr `slot_holds` i booking).
- **Svenska moms/kvitto vid rails-på:** e-handel med **online-betalning kräver INTE kassaregister**; **betalning vid upphämtning i butik (`pickup_*`/`order_in_then_pickup`) räknas som på-plats-försäljning → kassaregister + kvitto-skyldighet** (kvitto ska erbjudas vid kontant/kort/Swish oavsett om kunden vill ha det). Momssatser: **blommor 25%** (ej i reducerad-lista); **café-tårta avhämtning 6%** (fr.o.m. 2026-04-01, tidigare 12%), **fika på plats 12%**, **alkohol 25%**; cykeldelar/hårvård/bågar 25%. Order-raden bör därför bära momssats per rad när rails öppnas (finns ej i schemat idag — additivt). Nytt kassaregisterkrav (XML-journal) fr.o.m. 2027.
- **Lätt missat:** `fulfilment` är **snapshot** (ändrar tenant variant senare påverkas ej gamla ordrar) — korrekt; håll variant-UI data-drivet ur `variant_schema`, aldrig `if(bransch)`; total summeras ur items (validera server-side, lita inte på klient).

## 7. Status idag vs bygg
- **Finns:** modules-rad (0031), `shop_products`/`shop_orders`/`shop_order_items` + RLS (0032), `ShopSection.tsx` (variant-medveten copy/CTA), `ShopAdmin.tsx` (Produkter + Ordrar, fulfilment-label).
- **Bygg/justera:** (a) **varukorg + faktisk order-INSERT** på storefront (ShopSection saknar cart/checkout-flöde idag — bara grid/CTA); (b) variant-INPUT-fält i checkout (florist datum/adress, café hämtdatum, optiker recept-upload) data-drivet ur `variant_schema`; (c) lager=1 atomisk reservation för second hand; (d) mappa svenska status-etiketter mot DB-enum; (e) cutoff/lead-regler i config; (f) momssats-per-rad + kvitto först när betal-rails öppnas (fas senare).

## 8. Öppna beslut för Zivar
1. **Varukorg-scope v1:** ska storefront-shoppen ha full varukorg + order-INSERT nu, eller "intresse/reservera"-flöde tills rails öppnas? (Påverkar hur mycket av §7a som byggs direkt.)
2. **Lager=1 race (second hand):** RPC med hold (som booking `slot_holds`) eller enklare optimistisk `active=false` vid order? 
3. **Optiker-recept:** eget recept-fält i `details` + media_assets, eller återanvänd offert-modulens upload-mönster? Hälsodata-RLS-nivå?
4. **Florist cutoff + café lead-days:** ren `config`-regel per tenant, eller del av `variant_schema.params`? 
5. **Momssats per orderrad:** lägg additiv kolumn nu (förbered rails) eller vänta tills betalning aktiveras?
6. **Hund/nagel-shop:** bekräfta att de bara är "shop på via tenant_modules" utan egen variant (default `ship`+`pickup`).

## 9. Källor
- DB-sanning §1.2 + §4.2: `4-Dokument-Underlag/01-acceptans/02-Arkitektur-sanning.md`
- Migrationer (kanon): `5-Kod/supabase/migrations/0031_shop_module_register.sql` (variant_schema.fulfilment) + `0032_shop_tables_rls.sql` (tabeller, variant-kolumner, RLS, grants)
- Variants/faces/branscher: `super-admin/cfg-data.js` (MODULES.shop variants florist/cykel/cafe/optiker/secondhand, MODULE_FACES.shop, BRANCHES), `super-admin/preview.jsx` (ModShop — generisk, saknar variant-UI)
- Admin/storefront-UI: `kund-admin/surfaces-more.jsx` (Produkter, Ordrar) · kod `apps/web/components/{storefront/ShopSection,storefront/ShopCta,admin/ShopAdmin}.tsx`
- Princip: `10-arkitekturprincip-universal-vs-variant.md` · Backlog: `09-modul-bransch-spec-backlog.md`
- Verklighet (SE): florist leverans/cutoff — [Interflora](https://www.interflora.se/), [Euroflorist](https://www.euroflorist.se/); café förbeställ/lead — [Cake it easy](https://www.cakeiteasy.se/), [Tages](https://tages.se/konditori-butik/tartor); optiker recept (~2 år) — [Specsavers](https://www.specsavers.se/synvard/ditt-recept/ecomm), [Optikerna.se](https://optikerna.se/synundersokning-recept/); second hand konsignation (40%, unik, 30 dgr) — [Judits](https://www.judits.se/inlamning), [Arkivet](https://arkivet.com/sida/inl%C3%A4mning/); moms/kassaregister — [Skatteverket momssatser](https://www.skatteverket.se/foretag/moms/saljavarorochtjanster/momssatserochundantagfranmoms.4.58d555751259e4d66168000409.html), [Skatteverket undantag kassaregister](https://www.skatteverket.se/foretag/drivaforetag/kassaregister/undantagfrankravpakassaregister.4.6efe6285127ab4f1d2580005105.html)
