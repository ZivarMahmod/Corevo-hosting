# goal-54 — Körningsplan: 6 körningar (efter grund-audit 2026-07-11)

> Zivars order: "gör en djup utförlig plan innan varje körning… grundlig audit på alla
> ologiska saker… vi har en SaaS-plattform, komplex — planera ut 6 körningar."
> Detta dokument = master-planen. Före VARJE körning skrivs en utförlig detaljplan
> (körning 1:s detaljplan finns längst ner). Efter varje körning: tsc + vitest grönt,
> commit, deploy via v*-tagg, prod-verify + FreshCut orörd.

## AUDIT-FYND (grunden — allt ologiskt, 2 oberoende genomgångar)

### Storefront (riktig kunds perspektiv)
- **S1** Nav saknar Offert + Presentkort helt (`app/(public)/layout.tsx:184-195`) — når bara via startsidans teasers; på undersida oåtkomliga.
- **S2** Blogg = återvändsgränd: ingen `/blogg/[slug]`, inläggskorten är INTE länkar (BloggSection PostCard/PostRow/FeaturedLead). Går inte att läsa ett inlägg.
- **S3** "Tillfälligt otillgänglig" trots lager: köpbarhet = `product.variants.length > 0` (AddToCart.tsx:35-41); `product.stock` laddas men används ALDRIG (load-shop.ts:84 vs 102). Produkt utan variantrader = okörbar.
- **S4** Ingen produktdetaljsida; produktkort ej klickbara.
- **S5** Presentkort: "Köp öppnar snart" — inert CTA, modul utan funktion (PresentkortSection.tsx:138-169).
- **S6** Kassa `notFound()` om shop pausas medan kund har varukorg → strandad cart (app/butik/kassa/page.tsx:20).
- **S7** BookingWizard stepTitles hårdkodade ('Vad vill du ha?', 'Hos vem?' — BookingWizard.tsx:492); staff-noun default = 'Frisör' (staff-noun.ts:21).
- **S8** Kurs-bokning finns inte: "Boka kurs"-pelaren → vanlig 1:1-wizard, inga deltagare/platser.
- **S9** Flora-pelarna länkar /shop, /offert, /boka OAVSETT modulstatus → kan 404:a (FloraLayout.tsx:96-116).
- **S10** Endast flora väver in moduler; övriga teman får generisk teaser-stapel (page.tsx:108-110). /om + /kontakt faller alltid tillbaka till salong-sektionerna oavsett tema.
- **S11** SEO fel: sitemap saknar /shop /blogg /offert /presentkort (sitemap.ts:12); JSON-LD hårdkodar `'@type': 'HairSalon'` för ALLA (seo.tsx:171); PAGE_META.om säger "vår salong"; layout-beskrivning "Boka tid hos X online" boknings-centrerad; alt-texter "salongsmiljö".
- **S12** LIVE modul utan innehåll visar "Produkter visas snart."/"Inlägg visas snart." till besökare istället för att döljas.

### Admin (kundens verktyg + Zivars kontroll)
- **A1** Modulverktyg saknas HELT i kundkortet — Drift kan tända modul men ingen yta att hantera innehållet. "Hjälp salongen" = stub (enterHelpMode skriver bara audit-rad, people.ts:485-494).
- **A2** Alla modul-actions JWT-låsta via `adminCtx()` (copy-pastad i actions.ts:32 + shop/blogg/media/offert) — ingen dual-guard. `sidaCtx` (guard.ts:32) = det färdiga mönstret. Data-loaders tar redan tenantId ✅. Modul-pages resolvar tenant ur JWT via getAdminTenant → platform_admin får "Ingen salong kopplad".
- **A3** `revalidatePath('/admin/...')` i varje action → fel path vid mount i kundkortet.
- **A4** OffertInbox: svara-flöde FINNS INTE — status "Offererad" ljuger, inget skickas till kunden någonsin. Note = intern. Ingen FSM på statusövergångar.
- **A5** Shop-ordrar: ingen ALLOWED_FROM-FSM (fri statusövergång, kontrast bokningarnas matris actions.ts:1392-1410).
- **A6** Kurs/event-koncept finns inte i datamodellen: services saknar capacity/datum; bokning 1:1 med EXCLUDE-constraint.
- **A7** `working_hour_slots` redigerbara i admin men publika motorn läser dem ALDRIG — död feature.
- **A8** Kundkortets flik-kommentarer föråldrade (beskriver 6 gamla flikar); flikval ej URL-state.
- **A9** Branding/sajtbyggar-uploads skriver R2 men inte media_assets (tredje osynligt bildspår).

## DE 6 KÖRNINGARNA

### Körning 1 — Kundkortet = modul-kontrollrummet (A1, A2, A3, A8 + stub-pension)
Dual-guard-refactor + 4 modul-flikar i `/salonger/[id]`. Detaljplan nedan.

### Körning 2 — Storefronten slutar ljuga (S1, S2, S3, S4, S9, S11, S12 + S7-terminologi)
Riktig sida för riktiga besökare:
- `/blogg/[slug]` detaljsida + klickbara inläggskort (lista + flora-teasern).
- Shop-tillgänglighet: produkt utan varianter köpbar via `product.stock` (auto-"default variant"-logik i load-shop + AddToCart) — "Tillfälligt otillgänglig" bara när verkligt slut.
- Produktdetaljsida `/shop/[slug eller id]` (bild, beskrivning, varianter, AddToCart).
- Nav: Offert + Presentkort in i menyn, modulstyrt som Butik/Blogg.
- Flora-pelare gate:as på modulstatus (ingen länk → 404).
- SEO: sitemap dynamisk per modulstatus; JSON-LD `@type` per bransch (Florist/HairSalon/LocalBusiness ur vertical); PAGE_META/alt/layout-beskrivning avsalongifieras (terminology-driven); staff-noun default neutral ('Medarbetare'); BookingWizard stepTitles ur vertical-terminologi.
- Tomma live-moduler döljs på storefronten (sektion + nav) tills innehåll finns.

### Körning 3 — Modulerna får riktiga flöden (A4, A5, S6 + offert-UX)
- Offert-svara: skicka svar till kunden via mejl-rälsen (booking@corevo.se, samma räls som bokningsmejl); svar + estimate lagras; status-FSM (ALLOWED_FROM) för offert.
- Shop-order-FSM: ALLOWED_FROM-matris som bokningarna; ordrar i kundkortets Webshop-flik.
- Strandad varukorg: kassa vid pausad shop visar "stängt"-sida med kvarvarande kort istället för notFound.
- Kundmejl vid orderstatus (bekräftad/klar) via samma räls.

### Körning 4 — Kurser som riktigt koncept (A6, S8, A7)
- Datamodell: `service_events` (tillfälle: service_id, starts_at, capacity, price/anmälningsavgift) + `event_bookings` (n deltagare per tillfälle) — migration.
- Admin: kurs-tillfällen i Tjänster (kund-admin + kundkortet, dual-guard från start).
- Storefront: "Boka kurs" → tillfälleslista (datum, platser kvar) → anmälan (namn/antal/kontakt), inte 1:1-wizarden.
- Beslut i detaljplanen: working_hour_slots kopplas in ELLER rivs (död feature får inte ligga kvar).

### Körning 5 — Betalningar per kund (goal-54 §4 + S5)
- Integrationer-fliken: koppla KUNDENS Stripe (Connect) — nyckel/onboarding per tenant.
- Webshop-checkout betalar på riktigt → kundens konto; order payment_status levande.
- Presentkort köpbart (S5) när rälsen finns.
- Zettle = utred/parkera i detaljplanen (Stripe först).

### Körning 6 — Tema×moduler + städ (S10, A9 + resterna)
- Övriga teman (salvia/leander/zigge/linnea/edit) väver in modul-sektioner i sitt formspråk som flora; /om + /kontakt tema-medvetna.
- Branding/sajtbyggar-uploads → media_assets med source-tagg.
- Kvarvarande smått: SMS-rad, föråldrade kommentarer, dubbletter.

Ordning: 1 → 2 → 3 → 4 → 5 → 6. Före varje körning: ny utförlig detaljplan skrivs + visas.

---

## DETALJPLAN KÖRNING 1 — Kundkortet = modul-kontrollrummet

**Mål:** för VARJE kund, varje modul som är PÅ → flik i `/salonger/[id]` med samma verktyg
som kundens admin. "Som att jag är i deras inlogg men ändå inte."

### Steg 1 — En delad dual-guard: `moduleCtx(fd)`
Ny helper i `lib/admin/context.ts` (eller utöka guard.ts): exakt `sidaCtx`-formen —
`requirePortal('admin')`; platform_admin → `tenantId = fd.get('tenantId')` (validera uuid,
tenant finns); annars → JWT. Ersätter de 4-5 copy-pastade `adminCtx()` (actions.ts, shop,
blogg, media, offert). Actions utan FormData (t.ex. delete med bara id) får tenantId-fält
tillagt i sina anrop.

### Steg 2 — Actions-refactor (shop/blogg/media/offert)
Varje action: `adminCtx()` → `moduleCtx(formData)`. Alla writes behåller `.eq('tenant_id', ctx.tenantId)`
(RLS `private.tenant_id()` gäller bara kund-JWT; platform_admin går via service-fence som Sida-actions —
följ exakt sidaCtx-actionsens klientval). `revalidatePath`: revalidera BÅDA (`/admin/<mod>` +
`/salonger/[id]`) eller byt till revalidatePath med `page`-typ + router.refresh i kundkortet.

### Steg 3 — Hidden tenantId i formulären
ShopAdmin/BloggAdmin/MediaLibrary/OffertInbox får optional prop `tenantId?: string`;
när satt → `<input type="hidden" name="tenantId">` i varje form + skickas i alla
action-anrop som tar id-argument (via bindning eller extra FormData-fält). Kund-admin
skickar INTE prop → inget hidden-fält → JWT-vägen (noll beteendeändring för kunden).

### Steg 4 — Flikar i kundkortet
`TenantDetailTabs`: + Webshop, Blogg, Offerter, Bildbibliotek — visas ENDAST när
modulens `tenant_modules.state` ∈ {live, paused} (samma gate som kund-nav).
page.tsx laddar per modul (endast när på): `listShopProducts/Orders(id)`,
`listBlogPosts(id)`, `listOffertRequests(id)`, `listMediaAssets(id)` + assets till
pickers — och mountar samma komponenter med `tenantId={id}`.

### Steg 5 — Pensionera stubben + städ
Ta bort "Hjälp salongen"-knappen + `enterHelpMode`; uppdatera föråldrade
flik-kommentarer (A8). Audit-loggning: modul-writes av platform_admin loggas som
Sida-actions gör (samma mönster, ingen ny mekanik).

### Verify
- tsc + vitest grönt (befintliga 680).
- Nya tester: moduleCtx (platform_admin med tenantId-fd; salon_admin ignorerar fd-tenantId — säkerhetstestet).
- Prod efter deploy: kundkortet florist visar 4 nya flikar; skapa/ändra produkt från kundkortet syns på florist.corevo.se; kund-admin (info@freshcut.se-flöde) oförändrad; FreshCut orörd.

### Risker
- Säkerhet: fd-tenantId får ALDRIG äras för salon_admin — testet ovan är gate.
- revalidate-miss i kundkortet → router.refresh() finns redan i komponenterna som fallback.
- Stor yta (15+ actions) → mekanisk, en modul i taget (shop → blogg → media → offert), tsc mellan varje.

**UTFALL KÖRNING 1 (2026-07-11):** KLART — commit dada1f6, tag v1.7.21. moduleCtx
dual-guard + TenantScope/TenantField (15 formulär) + 4 modul-flikar i kundkortet +
stub pensionerad. 685 tester gröna (5 nya säkerhetstester), tsc + eslint rent.

---

## DETALJPLAN KÖRNING 2 — Storefronten slutar ljuga

**Mål:** riktig sida för riktiga besökare — inga återvändsgränder, ingen felaktig
bransch-data, allt nåbart. Fynd som täcks: S1, S2, S3, S4, S9, S11, S12 + S7-delarna.

### Steg 1 — Blogg blir läsbar (S2)
- Ny loader `loadBlogPost(tenantId, slug)` (published only) + `/blogg/[slug]`-sida:
  omslag, rubrik, datum, brödtext (samma modul-gate som /blogg; okänd slug → notFound).
- Inläggskorten (PostCard/PostRow/FeaturedLead i BloggSection) blir länkar till
  `/blogg/<slug>`; flora-teaserns blogg-kort likaså.

### Steg 2 — Shop slutar säga "otillgänglig" när det finns lager (S3, S4)
- Rotorsak: köpbarhet = variantrader; produkter skapade UTAN variant (seed/provisionering)
  blir okörbara trots stock>0. Fix i två delar:
  a) Backfill-SQL (alla tenants): produkter med 0 varianter får en Standard-variant
     ur produktens price_cents/stock/image (samma modell som syncDefaultVariant).
  b) UI-sanning: utan variant ELLER alla varianter slut → "Slutsåld" när stock=0,
     "Tillfälligt otillgänglig" ENDAST när varianter saknas helt (nu sällsynt).
- Produktdetaljsida `/shop/[id]`: stor bild, namn, beskrivning, pris, varianter,
  AddToCart; produktkorten i ShopSection + flora-valven blir länkar dit.

### Steg 3 — Menyn + pelarna slutar gömma/404:a (S1, S9, S12)
- layout.tsx nav-links: + Offert och Presentkort (modulstyrda, samma som Butik/Blogg).
- FloraLayout-pelarna gate:as på modulstatus (shop av → pelaren pekar inte på 404;
  visa boka/annan pelare istället eller göm).
- Sektioner för LIVE modul utan innehåll returnerar null på startsidan (inga
  "visas snart"-löften till besökare); modulens egen sida behåller vänlig tom-text.

### Steg 4 — SEO/terminologi per bransch (S11, S7)
- sitemap.ts: + /shop /blogg /offert /presentkort när modulen är live.
- JSON-LD `@type` ur bransch (florist→Florist, frisor→HairSalon, annars LocalBusiness).
- PAGE_META/alt-texter/layout-beskrivning avsalongifieras (neutral svenska).
- staff-noun default 'Frisör' → neutral default; bransch-ordet ur verticals.terminology
  (frisören FÅR "Frisör" via sin vertical, ingen regression för FreshCut).
- BookingWizard stepTitles: bara den hårdaste frisör-frasen neutraliseras (kurs-språk
  kommer i körning 4 med riktiga kurser).

### Verify
tsc + vitest + eslint; deploy v1.7.22; prod: florist.corevo.se blogg-inlägg läsbart,
produkt klickbar + köpbar, meny visar Offert/Presentkort, sitemap.xml innehåller
modulsidorna, JSON-LD ≠ HairSalon för floristen; FreshCut orörd (HairSalon kvar, boka
funkar, "Frisör" kvar via vertical).

### Risker
- Backfill-SQL rör alla tenants → körs som enkel INSERT…SELECT WHERE NOT EXISTS,
  idempotent, verifieras med count före/efter.
- Cart/checkout-rälsen förutsätter variant-id — därför backfill, ALDRIG syntetiska
  varianter i loadern.
- FreshCut-regression störst i steg 4 → verify-listan ovan är gate.

**UTFALL KÖRNING 2 (2026-07-11):** KLART — tag v1.7.22. /blogg/[slug] + /shop/[id],
klickbara kort överallt, köpbarhets-sanning (Slutsåld vs otillgänglig) + DB-backfill
6 Standard-varianter, meny + flora-pelare modulstyrda, tomma teasers döljs, sitemap +
JSON-LD per bransch, salong-hårdkodningar neutraliserade. 685 tester, tsc/eslint rent.

---

## DETALJPLAN KÖRNING 3 — Modulerna får riktiga flöden (A4, A5, S6)

**Mål:** offerter och ordrar blir ärliga processer med kundkommunikation, inte bara
statusetiketter som ljuger.

### Steg 1 — Offert-svar som når kunden (A4)
- Migration: `offert_requests` + `reply_message text`, `replied_at timestamptz`.
- Ny action `sendOffertReply` (moduleCtx dual-guard): svarstext (+ ev. prisuppskattning)
  → mejl till kundens e-post via mejl-rälsen (sendEmail; From = kundens namn via
  buildFrom, Reply-To = kundens kontaktmejl så svaret landar hos kunden, inte hos oss).
  Vid skickat: spara reply_message/replied_at + status → 'quoted'. Best-effort-mejl:
  utan kund-e-post → ärligt fel ("förfrågan saknar e-post").
- OffertInbox-drawern: "Svara kunden"-sektion (textarea + skicka-knapp, visar
  replied_at när svar finns). Funkar i BÅDA ytorna (kund-admin + kundkortet) via
  TenantField som körning 1 la in.
- Offert-status-FSM: ALLOWED_FROM (new→reviewing/quoted/declined/closed;
  reviewing→quoted/declined/closed; quoted→accepted/declined/closed;
  accepted/declined→closed; closed→∅; samma status = no-op) i updateOffertRequest.

### Steg 2 — Order-FSM + kundmejl (A5)
- setShopOrderStatus: ALLOWED_FROM-matris (pending→confirmed/cancelled;
  confirmed→ready/cancelled; ready→completed; completed/cancelled→∅) — samma
  mönster som bokningarnas matris.
- Kundmejl (best-effort, aldrig blockerande) vid confirmed/ready/completed —
  ordernummer, rader, status på svenska; brand-From som offert-svaret.

### Steg 3 — Strandad varukorg (S6)
- /butik/kassa vid PAUSAD shop: "stängt"-sida (behåll varukorgen, ärlig text) i
  stället för notFound. Av/draft → notFound som idag.

### Verify
tsc + vitest (+ nya FSM-tester för offert & order) + eslint → v1.7.23 → prod-smoke
(florist offert-svar mejlas — relay konfad i prod; FreshCut orörd).

### Risker
- Mejl får ALDRIG blockera statusskrivning → send efter lyckad DB-write, fel loggas.
- FSM får inte låsa gamla rader i ogiltiga states → okänd/legacy status behandlas
  som fri övergång till closed/cancelled.

**UTFALL KÖRNING 3 (2026-07-11):** KLART — tag v1.7.23. Offert-svar mejlas kunden
(reply_message/replied_at, migration 0051), offert- + order-FSM med race-skydd,
kundmejl vid orderstatus, kassa-paus ärlig. 699 tester gröna.

---

## DETALJPLAN KÖRNING 4 — Kurser som riktiga event (A6, S8, delar av A7)

**Mål:** floristens kurser (och vilken bransch-kunds event som helst) blir riktiga
TILLFÄLLEN med datum, max antal platser och anmälningsavgift — inte 1:1-bokningstider.

### Datamodell (migration 0052)
- `tenant_events`: id, tenant_id, title, description, starts_at, duration_min,
  capacity (1–500), price_cents (anmälningsavgift, 0 = gratis), status
  (open/cancelled/done), created/updated. RLS = offert-mönstret; anon får LÄSA
  (publik kurslista) men inget mer.
- `event_registrations`: id, tenant_id, event_id, name, email, phone, party_size
  (1–20), message, status (confirmed/cancelled), created_at. anon INSERT only
  (publik anmälan, som offert-intake); ingen anon-läsning (PII).
- Platser kvar = capacity − sum(party_size där status=confirmed). Överbokningsskydd:
  insert → räkna om → vid översåld ta bort egen rad + ärligt "fullbokat"-svar.

### Storefront
- Ny sida `/kurser` (gate: booking-modul live/paused): kommande tillfällen med
  datum (sv-SE), platser kvar, avgift + anmälningsformulär (namn, e-post, antal,
  meddelande) — rate-limited anon-intake som offert. Bekräftelsemejl best-effort.
- Flora-pelaren "Boka kurs" → /kurser; nav-länk "Kurser" när kommande tillfällen finns.

### Admin (BÅDA ytorna via dual-guard, som körning 1)
- `KursAdmin`-komponent + actions (moduleCtx): skapa/ändra/ställ in tillfälle,
  se anmälningar (namn, antal, kontakt), summa platser. TenantScope/TenantField.
- Kund-admin: ny sida /admin/kurser (nav under bokning). Kundkort: ny flik "Kurser".

### Floristens data
- Seed: 2 kommande tillfällen (Bukett & bubbel, Barr & bubbel — 690 kr, 15 platser).
- De gamla "Kurs:"-tjänsterna avaktiveras (kurser bor nu i /kurser, inte i 1:1-boka).

### Ej i denna körning
- working_hour_slots-beslutet flyttas till körning 6 (städ) — orelaterat till event.

### Verify
tsc/vitest/eslint → v1.7.24 → prod: /kurser listar tillfällen, anmälan minskar
platser kvar, kundkortets Kurser-flik visar anmälan; FreshCut orörd (ingen
kurser-nav utan event).

**UTFALL KÖRNING 4 (2026-07-11):** KLART — tag v1.7.24. tenant_events/registrations
(0052), publik /kurser + anmälan m. kapacitetsvakt + bekräftelsemejl, KursAdmin i
båda ytorna, floristens 2 kurser seedade, gamla Kurs-tjänster av. 699 tester gröna.
OBS: överbokningsvakt = check-then-insert (ponytail-ceiling dokumenterad).

---

## DETALJPLAN KÖRNING 5 — Betalningar per kund (Stripe i kundbilden)

**Läge:** hela Stripe Connect-rälsen FINNS (G09): Express-konton, onboarding-länk,
status-spegling, payments_enabled-toggle, checkout-session för awaiting_payment-
ordrar med DIRECT charge på kundens konto. Allt bor dock ENBART i kund-adminens
/admin/installningar. Körning 5 = samma kontroll i KUNDKORTET (principen från
körning 1) så Zivar kopplar betalningar åt kunden.

### Steg
1. lib/admin/stripe.ts: alla tre actions (startStripeOnboarding, refreshStripeStatus,
   setPaymentsEnabled) → moduleCtx(fd)-dual-guard. Konto-mejl vid skapande = bara
   salon-adminens (platform-vägen skickar null — kunden fyller i hos Stripe).
   Return/refresh-URL per yta: kund-admin → /admin/installningar, kundkortet →
   /salonger/<id>. revalidatePath för båda ytorna.
2. StripeConnectCard: tenantId-prop + TenantScope/TenantField (tre formulär).
3. Kundkortets Integrationer-flik: riktiga Stripe-panelen (samma kort) ersätter den
   statiska Stripe-raden; payments_enabled + stripe_* läses per kund.
4. Zettle: ärlig "planerad"-rad (ingen fejk-integration).
5. Presentkort-köp: SKJUTS — kräver egen köpräls; byggs när första kund vill sälja
   presentkort online (noterat i goal-54 §2).

### Verify
tsc/vitest/eslint → v1.7.25 → prod: kundkortets Integrationer visar Stripe-panel för
floristen ("Ej kopplad" + Koppla Stripe-knapp — riktig koppling görs när floristens
Stripe-konto ska in); kund-admin /admin/installningar oförändrad; FreshCut orörd.
