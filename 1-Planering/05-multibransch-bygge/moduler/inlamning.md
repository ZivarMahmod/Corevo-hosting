# Modul: Inlämning / Konsignation (inlamning)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md`. Status: 🆕 **NY MODUL** (finns EJ i DB — kräver tabell + RLS + `modules`-rad). Korsref: **orderstatus** (`work_orders`) + **shop** (konsignation). DB-sanning §0/§7.2. Schema bara på Zivars go.

## 1. Kärna (universell)
En besökare/kund lämnar in en fysisk vara — för **arbete** (cykel/skräddare) eller för **försäljning** (second hand-konsignation). Formulär: beskrivning + bild + datum → en rad i `intake_items` (NY) → **kvittonummer genereras** (kunden får en referens). Posten kopplas sedan antingen till en `work_order` (status, se orderstatus) eller till `shop` (konsignation, lager=1). EN modul, varianter per bransch. defaultPos = `main`.

## 2. Universal vs variant — beslut + axlar
**NY modul (egen tabell), universell + togglad** — inte butiks-specifik kod. "Inlämnad vara med kvittonr" är en egen datamodell (inte booking, inte offert) → egen tabell. Varianterna skiljer bara fält + nedströms-koppling.
- **`variant_schema`** (förslag, enum): `for_work` (cykel/skräddare → leder till work_order/orderstatus) · `for_consignment` (second hand → leder till shop, butik godkänner, skick + önskat pris). Sätter default nedströms-väg.
- **Fält per bransch** = config (renderas dynamiskt), lagras i jsonb — inte kolumn per fält.
- **`verticals.terminology`** styr knapptext ("Lämna in" vs "Skicka in").
- **`tenant_modules.config`**: kvittonr-format/prefix, om bild krävs, om second hand kräver godkännande.

## 3. Per bransch
| Bransch | variant-val | UI-skillnad (fält) | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Cykelbutik 🌱 | for_work | Märke & modell · Färg · Vad ska göras? · Önskat färdigdatum · bild (valfri) | Inlämning → kvittonr → **work_order** (orderstatus: mottagen→klar) | Cykel lämnas för service; kund vill kunna hämta-ut-referens + följa status |
| Skräddare 🌱 | for_work | Plagg · Vad ska göras? · Mått/önskemål · Klart senast · bild | Inlämning → kvittonr → **work_order** + ofta föregånget av offert | Plagg lämnas för ändring; spårning + hämtbevis |
| Second hand 🌱 | for_consignment | Vad lämnar du in? · **Skick** · **Önskat pris** · Kontakt · bild | Inlämning → kvittonr → **butik godkänner** → blir produkt i `shop` (konsignation, lager=1); säljs → kund får andel i efterhand | Kommissionsförsäljning; skick+pris är kärnan; avtalskopian = kvitto |
| (Verkstad/övrig service, framtid) | for_work | Generiskt: Beskriv varan · Vad ska göras? · Datum · Kontakt | Samma mönster | Återanvänd modul |
| Alla andra branscher | (off) | — | — | Ingen fysisk inlämning |

## 4. DB-form (NY)
**Förslag `public.intake_items`** (ej skapad):
- `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants · `customer_id` uuid FK→customers (set null; kund kan vara anon vid inlämning)
- `customer_name` · `customer_email` · `customer_phone` (kontakt för avisering)
- `receipt_no` text NOT NULL — **kvittonummer**, unikt per tenant (`unique (tenant_id, receipt_no)`); genereras serverside (prefix ur config + löpnr/slump)
- `variant` text CHECK in (for_work, for_consignment)
- `description` text · `details` jsonb (branschfält: märke/plagg/skick/önskat pris …) · `desired_date` date
- `condition` text + `asking_price_cents` int (för for_consignment; nullable annars)
- `status` text (mottagen / godkänd / avböjd / kopplad / klar) · `work_order_id` uuid FK→work_orders (set null) · `shop_product_id` uuid FK→shop_products (set null)
- `created_at` · `updated_at`
- Bilder → `media_assets` (befintlig), refereras ur `details`.

**RLS** (mönster ur 0033/offert): `for all to authenticated using/with check (tenant_id = private.tenant_id() OR is_platform_admin())`. **Anon INSERT** tillåts (publik inlämning, app sätter tenant) — som offert; **ingen anon SELECT** (privat). Kvittonr ger kunden referens utan att exponera tabellen. (Alt: inlämning kräver inloggning → ingen anon-policy. Öppet beslut.)

## 5. Två ytor — Storefront + Admin
- **Storefront** (design `super-admin/preview.jsx` → ModInlamning): formulär med branschfält + bild-dropzone + text **"Du får ett kvittonummer när vi tagit emot"** + knapp "Lämna in"/"Skicka in" (second hand). INSERT i `intake_items`, kvittonr returneras. MODULE_FACE sf: *"Besökaren lämnar in en vara via formulär (bild, beskrivning)."*
- **Admin**: ägaren tar emot, sätter status, **kopplar** posten till en work_order (orderstatus) eller godkänner → skapar shop-produkt (konsignation). MODULE_FACE adm: *"Ägaren tar emot och kopplar till jobb/konsignation."* Ingen design-yta i `surfaces-more.jsx` ännu (roadmap) — byggs med modulen.

## 6. Verklighets-koll
- **Kvitto/spårbarhet:** i svensk second hand-praxis fungerar **avtalskopian som kvitto** på inlämnade varor (Arkivet, Mini & Planeten). Kvittonr ska därför vara stabilt, sökbart och kopplat till villkor (kommission, försäljningstid). Konsumentverket: avtalsvillkor ska vara klara/begripliga, inte oskäliga (avtalsvillkorslagen).
- **Kommission:** second hand säljer åt kund → kund får andel **i efterhand** efter försäljning. Det betyder inlämning ↔ shop-konsignation + en utbetalnings-/avräkningsdimension (rails pausade nu → bara status/underlag, inga pengar rör sig ännu).
- **Lätt missat:** kvittonr-kollision (gör unikt per tenant + serverside); vad som händer om vara **inte** säljs (returneras vid försäljningstidens slut → statusväg behövs); GDPR-kontaktdata för avisering (maska som i kunddatabasen, §0 Arkitektur-sanning); bild krävs/valfri per bransch.
- **Korsref:** for_work-grenen skapar en `work_order` → all statuslogik + notis bor i **orderstatus.md** (bygg dem ihop). for_consignment-grenen lever i **shop**.

## 7. Status idag vs bygg
- **Finns:** inget i DB. Endast design-mockup (ModInlamning, MODULE_FACE, cfg-data variants cykel/skraddare/secondhand).
- **Bygg (fas D, per riktig kund):** migration `intake_items` + kvittonr-generator (unik/tenant) + RLS + koppling till `work_orders` (orderstatus) och `shop_products` (konsignation) + storefront-form + bild→media_assets + admin mottag-/koppla-vy. Bygg **tillsammans med orderstatus** (for_work delar livscykel).

## 8. Öppna beslut för Zivar
1. **Anon vs inloggad inlämning:** får besökare lämna in utan konto (anon INSERT, som offert) eller krävs konto för att kunna följa kvittonr? (Påverkar second hand drop-in.)
2. **Kvittonr-format:** löpnummer per tenant (prediktabelt) vs slump/kort kod (svårgissat) — config-prefix per kund?
3. **Konsignation-avräkning:** modellera utbetalningsandel nu (parkerad bakom pausade rails) eller bara status tills rails öppnas?
4. **Osåld vara:** statusväg + ev. auto-påminnelse när försäljningstid löper ut — i scope?
5. **En modul eller två varianter:** håller `for_work` + `for_consignment` i EN modul, eller känns konsignation tillräckligt egen för att motivera split senare? (Rekommendation: EN, varianterna räcker.)

## 9. Källor
- Arkivet Second Hand, allmänna villkor + inlämning (kommission, avtalskopia = kvitto): https://arkivet.com/sida/allmanna-villkor/ · https://arkivet.com/sida/inl%C3%A4mning/
- Mini & Planeten, inlämningsvillkor (avtal fungerar som kvitto på inlämnade varor): https://minioplaneten.se/pages/vill-du-salja
- Konsumentverket, avtalsvillkorslagen (klara/begripliga, ej oskäliga villkor): https://konsumentverket.se/for-foretag/avtal-och-mallar/avtalsvillkorslagen
- Konsumentverket, regler för kvitto: https://www.konsumentverket.se/konsumentratt/regler-for-kvitto/
- Internt: DB-sanning §0/§4/§7.2; `cfg-data.js` (MODULES.inlamning, MODULE_FACES.inlamning); `preview.jsx` (ModInlamning); `09-modul-bransch-spec-backlog.md`. Korsref: `moduler/orderstatus.md`.
