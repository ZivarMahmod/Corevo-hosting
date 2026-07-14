# Audit — 12 mallar, tre ägarlager och fallbackkedjan

**Datum:** 2026-07-13  
**Granskat:** `main` @ `c524440` / `v1.30.2`  
**Kanon:** `handoff/HANDOFF.md` och samtliga 12 `.dc.html` i `handoff/`  
**Omfattning:** strukturell variation och funktion — inte pixelidentitet  
**Arbetssätt:** read-only kod-, route-, preview-, CSS-, modul- och produktionsdataaudit. Ingen produktionskod eller produktionsdata ändrades i denna audit.

## Kort dom

De 12 mallarnas grundlayouter är olika och korrekt registrerade. Presentkort har nu också 12 olika registrerade vyer och den ändringen är live.

Det går däremot **inte** att säga att alla 12 fungerar som 12 genomgående olika mallar ännu. Claude hittade en verklig kontraktslucka, men den förklaringen var ofullständig. Samma fallbackmönster finns kvar i flera lager:

1. mallkontraktet tillåter att obligatoriska vyer saknas,
2. routes faller då tyst till en gemensam komponent,
3. admin-preview använder delvis en annan komposition än live,
4. tenant- och moduldata har ytterligare tysta standardvärden,
5. modulens affärslogik har flyttats in i vissa temavyer och har där tappat data.

Det här är orsaken till att flera mallar kan börja olika på startsidan men sedan konvergera till samma offert, kurs, produkt, korg, kassa, artikel eller bekräftelse.

## Det som är verifierat grönt

- Exakt 12 kanoniska mallnycklar är valbara och servervaliderade.
- Alla 12 har olika registrerade React-layoutkomponenter för startsidan.
- Alla 12 har egna CSS-moduler; ingen tydlig global CSS-läcka mellan mallarna hittades.
- Alla 12 har egen navigation, footer, Om, Tjänster och Kontakt.
- Alla 12 har egen Shop, Blogg, Presentkort, Lojalitet och Galleri.
- De tre salongsmallarna har var sin Team-vy.
- Presentkortsrouten frågar nu efter vald malls vy i både live och route-preview.
- De riktade testerna är gröna: 197/197 i fem testfiler.
- Produktionskunderna har för närvarande inga färg-, font-, layout- eller custom-CSS-overrides som får mallarna att se likadana ut.

Gröna tester betyder här att det som testerna täcker fungerar. De testar inte hela handoffens sidmatris eller live/preview-paritet.

## Tre lager som behöver hållas isär

### A. Mallens tre presentationsregister

I nuvarande kod delas en mall i praktiken upp i:

1. **Layout** — startsidans komposition.
2. **Chrome + pages** — navigation, footer, Om, Tjänster och Kontakt.
3. **Module views** — shop, blogg, presentkort, offert, kurser, produkt, varukorg, kassa med flera.

Lager 1 och 2 är kompletta för de 12. Lager 3 är `fail-open`: alla vyplatser är frivilliga i `florist/types.ts`, och `florist/layouts.ts` returnerar ett tomt objekt när något saknas. Route-filen väljer då delad fallback.

### B. Rätt funktionsägande

Den hållbara gränsen är:

1. **Tenant/config/content** väljer kundens värden och aktiva funktioner.
2. **Modulen** äger validering, tillstånd, formulärdata, korg, checkout, API/RPC och livscykel.
3. **Temat** äger DOM-komposition, visuellt uttryck och CSS.

De nya presentkortsvyerna korsar denna gräns: temalagret bygger själv `addLine`-payloaden och tappar mottagarnamn, e-post och meddelande som den generiska modulkomponenten tidigare bevarade. Calytrix visar dessutom ett e-postfält vars värde inte kopplas till state eller korg.

### C. Dokumenterad parameterarvning

Planeringen beskriver:

1. universell modulstandard: `modules.default_config`,
2. branschstandard: `verticals.module_params`,
3. kundoverride: `tenant_modules.config`.

Presentkortets runtime läser i praktiken bara kundens config och går annars till hårdkodade UI-standarder. Databasens checkout-RPC använder däremot kundconfig och avvisar tom config. De tre dokumenterade nivåerna är alltså inte en gemensam resolver ännu.

## P0 — aktiva funktionsfel

### 1. Presentkort kan köpas i UI men nekas i checkout

Nya kunder och första aktivering sparar `tenant_modules.config = {}`. UI visar ändå 200/500/1000 kr via hårdkodade parser-standarder. Checkout-RPC kräver däremot `amounts` eller `amount_presets` i tenant-config och ger `gift_amounts_not_configured` när de saknas.

Produktionskunden med Ateljé Vinter har presentkort live men config `{}`. Den visuella sidan är därför live, men flödet är inte verifierat fungerande ända genom checkout; kod- och databeviset säger att det stoppas där.

Berörda områden:

- `lib/platform/actions/tenant-modules-write.ts`
- `lib/platform/actions/tenant-modules-admin.ts`
- `lib/modules/presentkort/types.ts`
- migration/RPC `0059`
- presentkortsadmin saknar beloppskonfiguration

### 2. Presentkort är fristående i admin men korg/kassa kräver Shop

`/presentkort` kan vara live när Shop är avstängd, och alla 12 vyer kan lägga en presentkortsrad i korgen. Det publika skalet visar dock korg enbart när Shop är live/pausad, och `/varukorg` samt `/kassa` kräver Shop. Kombinationen Presentkort på + Shop av leder därför till saknad korgikon och 404 i korg/kassa.

Berörda routes:

- `app/(public)/layout.tsx`
- `app/(public)/varukorg/page.tsx`
- `app/(public)/kassa/page.tsx`

### 3. Onboarding kan märka ett ogiltigt gammalt tema som klart

Aktiv Onboarding Studio startar med `salvia`. Branschval kopierar `vertical.default_template` utan kontroll mot de 12 kanoniska mallarna. Galleriet återinför det gamla värdet och checklistan betraktar varje icke-tom temasträng som giltig. Servern godkänner däremot bara de 12 nya nycklarna.

Produktionsdata visar att alla sex branschstandarder fortfarande är äldre, icke-kanoniska nycklar: `zigge`, `flora`, `salvia`, `edit`, `linnea`, `leander`. UI kan alltså visa "klart" och kundskapandet sedan nekas av servern.

Berörda filer:

- `components/platform/onboarding-studio/OnboardingStudio.tsx`
- `lib/platform/onboarding-studio/model.ts`
- `components/platform/ThemeGallery.tsx`
- `components/platform/onboarding-studio/StudioPanels.tsx`
- `lib/platform/actions/tenants.ts`

### 4. De 12 presentkortsvyerna tappar mottagardata

Den generiska `GiftCardBuy` samlar mottagarnamn, mottagar-e-post och hälsning och skickar dem i korgens metadata. De 12 temavyerna skickar bara belopp och leveranssätt. Det gör utseendet olika men funktionen sämre och inkonsekvent.

Berörda filer:

- `components/storefront/shop/GiftCardBuy.tsx`
- `components/storefront/layouts/presentkort-views.tsx`
- `components/storefront/layouts/florist/ateljevinter.forms.tsx`

## P1 — strukturella fallbackar

### 1. 38 obligatoriska handoff-vyer saknar registrering

Mekanisk jämförelse mellan varje `corevo-manifest.pages` och registrerade `moduleViews`:

| Slot | Förväntas av handoff | Egen vy | Saknas |
|---|---:|---:|---:|
| Offert | 12 | 1 | 11 |
| Kurser | 9 | 1 | 8 |
| Varukorg | 11 | 2 | 9 |
| Kassa | 12 | 2 | 10 |
| **Totalt** | **44** | **6** | **38** |

Per mall:

| Mall | Saknade handoff-vyer |
|---|---|
| Ateljé Vinter | inga av dessa fyra |
| Aurora | offert, kurser, varukorg, kassa |
| Blomstertorget | offert, kurser, varukorg, kassa |
| Calytrix | offert, kurser |
| Eloria | offert, kurser, kassa; handoff har ingen egen varukorg |
| Lunaria | offert, kurser, varukorg, kassa |
| Onyx | offert, kurser, varukorg, kassa |
| Siv & Sav | offert, kurser, varukorg, kassa |
| Sol & Salt | offert, kurser, varukorg, kassa |
| Källa | offert, varukorg, kassa |
| Siluett | offert, varukorg, kassa |
| Snitt | offert, varukorg, kassa |

### 2. Produktsida, bloggpost och bekräftelse är fortfarande gemensamma

- Alla 12 shopvyer länkar till `/shop/[id]`; bara Calytrix har en `product`-slot. 11 faller till generisk produktdetalj.
- Alla 12 bloggvyer länkar till `/blogg/[slug]`; kontraktet saknar helt `blogPost`. 12/12 använder generisk artikelvy.
- Alla 12 handoff-manifest har en egen bekräftelse; kontraktet saknar confirmation-slot. 12/12 använder samma `OrderConfirmation`.

Det här är samma typ av saknad koppling som Claude beskrev, men på fler sidor.

### 3. Ett enda slot per modul räcker inte för handoffens sidor

Handoff innehåller flera olika sidor inom samma modul. Exempel:

- Aurora: både `/brollop` och `/offert` inom offertområdet.
- Eloria: `/brollop`, `/bestallning` och `/offert` med olika kompositioner.
- Calytrix: `/shop` och separat `/leverans`.

Ett enda `moduleViews.offert` eller `moduleViews.shop` kan inte uttrycka detta. 16 unika handoff-routes saknas i public router, bland annat `/event`, `/journal`, `/katalog`, `/leverans`, `/brollop`, `/priser` och `/vanner`. Blomstertorget länkar redan till `/stamkund`, som därför kan ge 404.

### 4. Admin-preview och live renderar inte samma produkt

Live laddar mallens modul-teasers, skickar `modules` till layouten och undertrycker den generiska modulstacken för de kanoniska mallarna.

Kundens Sida-preview skickar inte `modules` och lägger alltid `StorefrontModuleSections` efter layouten. Onboarding Studio gör samma sak med `ModuleSections`. Därför ser modulområdet mer likadant ut mellan mallarna i admin än det gör live.

Preview-routes för Om, Tjänster och Kontakt frågar dessutom inte efter mallens egna `themePages`, trots att live gör det. Galleri, Klubb, Team, produkt, varukorg, kassa, bekräftelse och bloggpost saknar full preview-paritet eller blockeras av preview-bryggans whitelist.

Berörda filer:

- `app/(public)/page.tsx`
- `app/salong-preview/[slug]/page.tsx`
- `components/platform/onboarding-studio/StorefrontPreview.tsx`
- `components/platform/SidaPreviewBridge.tsx`
- `app/salong-preview/[slug]/{om,tjanster,kontakt}/page.tsx`

### 5. Två tysta temafallbackar maskerar fel

- Saknad, gammal eller okänd `settings.theme` blir tyst Leander i `lib/tenant-data.ts`.
- En giltig nyckel som saknas i ett registry får tomt `chrome/pages/moduleViews` via `?? {}` i `florist/layouts.ts`.

Inställnings- och moduldatafel kan dessutom bli fallback/tomt state och cachas i 300 sekunder. Det gör ett data-/RLS-fel visuellt likt "kunden valde standardmallen" eller "modulen är av".

### 6. Kassa och navigation pressas fortfarande genom gemensamma beslut

- En egen checkout-vy omsluts fortfarande av ett gemensamt skal med bland annat `max-width: 720px`.
- Publik layout bygger gemensamma navetiketter som `Butik`, `Kurser`, `Blogg`, `Offert` och `Klubben`. 11 av 12 custom-navar skriver dessa etiketter direkt, så mallord som `Event`, `Journal`, `Katalog`, `Kretsen`, `Stamkund` och `Behandlingar` går förlorade.

## CSS och tenantlager

Det finns ingen hittad CSS-"smitta" som ensam gör alla 12 identiska. CSS-modulerna är scoped och de 12 filerna är olika.

Tenantens färg- och fonttokens injiceras däremot inline och vinner över mallens egna tokens. Mallbyte bevarar befintlig branding. Detta kan medvetet få två mallar att behålla samma färger och typsnitt efter byte, men ändrar inte deras grundstruktur.

Produktionskontrollen visade:

- 3 aktiva tenants,
- 1 med kanoniskt tema (`ateljevinter`), 2 med äldre teman (`freshcut`, `zentum`),
- 0 fulla palett-overrides,
- 0 accent-overrides,
- 0 font-overrides,
- 0 custom CSS,
- 0 gamla layoutvarianter.

Alltså förklarar tenant-CSS inte den aktuella likriktningen i produktion.

Den äldre dokumentationen beskriver också tre temanivåer: brandingtokens, nav/hero-varianter och custom CSS. I runtime gäller:

- brandingtokens fungerar,
- nav/hero A/B/C är pensionerade och mappar till samma implementation,
- custom-CSS-renderingsspåret finns kvar men någon aktiv admin-/skrivväg hittades inte; produktion har inga värden.

## Varför befintliga tester inte stoppade detta

Nuvarande testskydd verifierar bland annat:

- exakt 12 presentkortsvyer,
- unika komponentreferenser och signaturer för presentkort,
- shop/blogg i modulvysviten,
- att den generiska preview-komponenten fungerar.

Det saknas ett test som mekaniskt säger:

> Om handoff-manifestet deklarerar en sida måste det finnas en route, en registrerad temavy och en preview-väg, eller ett uttryckligt beslut om att sidan ska vara gemensam.

Preview-testet testar i dag den generiska `ModuleSections`-vägen och cementerar därmed en del av avvikelsen i stället för att jämföra mot live.

## Rekommenderad åtgärdsordning

1. **Stoppa de aktiva P0-felen:** normalisera onboarding-defaults, bygg en gemensam config-resolver och öppna commerce rail för Presentkort utan Shop.
2. **Flytta funktionslogik ur temavyerna:** en headless presentkort-controller ska äga mottagardata, validering och korgpayload; temat renderar bara UI.
3. **Ett uttömmande mallmanifest:** route + chrome + vanliga sidor + modulvyer + undersidor ska valideras som en helhet. Obligatoriska luckor ska ge test/build-fel, inte generisk fallback.
4. **Bygg de 38 saknade vyerna från respektive handoff** och lägg till slots för `blogPost` och `confirmation` samt ett route-alias/undersidesystem.
5. **Samma resolver i live och preview:** preview ska konsumera samma page model, theme dispatch och moduldata som live.
6. **Fail loud:** okänd temanyckel, registry-lucka och datafel ska loggas och synas i admin/test; de ska inte tyst bli Leander eller tom modulstate.
7. **Ny acceptansmatris:** 12 mallar × alla deklarerade handoff-sidor × live/preview × modulstatus, med strukturella fingeravtryck och funktionsflöden — inte pixeljämförelse.

## Deploy-status

`c524440` / `v1.30.2` är pushad till `main` och live. Den releasen innehåller den avgränsade presentkortsändringen: 12 olika registrerade presentkortsvyer och route-dispatch.

Fynden i denna bredare audit är **inte** kodfixade eller deployade. Rapporten ska inte användas som bevis för att alla 12 redan fungerar end-to-end; den visar exakt vad som återstår för att kunna ge den garantin.
