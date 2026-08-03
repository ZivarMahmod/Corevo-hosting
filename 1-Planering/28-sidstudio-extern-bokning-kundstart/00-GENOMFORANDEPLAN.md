# Genomförandeplan - gemensam sidstudio, extern bokning och kundstart

Datum: 2026-08-03
Status: Implementation och produktionsmigration genomförda. Sista UI-rättningen väntar på exakt-SHA CI och deploy.
Startbas: `main` vid `2e0e9df3c18564ce2e07d875625873058299313a` och
Studio-snapshot `01KZ40RBNV9FDYDSW545ME7F1R` för projektet `firs-r-sas`.

## 1. Uppgift

### Problem

Corevo kan redan visa samma revisionsbaserade sidstudio i superadmin och
kundadmin, men bokningsinställningarna är uppdelade mellan studions egen
`Bokning`-flik och en separat `BookingPanel` efter studion. För en kund som
FreshCut, som använder extern Bokadirekt-bokning, visar redigeraren därför
Corevo-specifika bokningsval utan en tydlig karta över vilka publika knappar som
går till vilken extern länk.

Samtidigt saknar den befintliga kundstarten ett uttryckligt val mellan Corevos
bokningsmotor och extern bokning. Kundregistrets arbetsyta och platsväljare har
dessutom konkreta layoutproblem på desktop och mobil.

### Önskat resultat

1. Samma sidstudio används av superadmin och kundadmin.
2. Hela webbplatsen går att redigera oavsett bokningsleverantör.
3. Bokningsfliken visar rätt verktyg för Corevo-bokning respektive extern
   bokning.
4. Extern bokning har en standardlänk och tydliga, valfria länkar per publik
   bokningsknapp, inklusive per tjänst.
5. Alla publika bokningsknappar använder samma validerade resolver.
6. Kundstarten samlar in bokningsval och extern länk utan ett parallellt
   onboarding-system.
7. Kundregistret använder tillgänglig yta utan att se ut som en stor dialog.
8. Platsväljare och övriga paneler öppnas inom viewporten utan klippning eller
   överlapp.

### Ska inte ändras i denna cykel

- Corevos bokningsmotor byggs inte om eller ersätts.
- Ingen kundspecifik kodfork skapas för FreshCut.
- Ingen fri drag-och-släpp-byggare införs.
- Ingen ny databas eller parallell inställningsmodell skapas.
- Tenantisolering, RLS, auth, roller, bokningsberäkning och betalflöden ändras
  inte.
- Produktionsmigration, push och deploy sker endast efter uttryckligt godkännande
  och gröna releasegrindar.

### Färdigkriterier

- En gemensam bokningspanel finns i `SidaStudioV2`; ingen andra panel renderas
  efter studion.
- Corevo-läge visar Corevos befintliga presentationsval.
- Externt läge visar standardlänk, knappinventering, effektiv länk och eventuell
  egen länk per knapp.
- FreshCuts tjänster finns kvar, priser visas inte och varje tjänst har en liten
  fungerande bokningsknapp.
- Ny kund kan konfigureras med Corevo-bokning eller extern bokning i befintlig
  onboarding.
- Superadmin och kundadmin ger samma resultat med sina egna riktiga routes och
  behörigheter.
- Desktop och mobil har inga blockerade kontroller, klippta menyer, osammanhängande
  överlapp eller horisontell sidscroll.
- Relevanta enhets-, kontrakts-, integrations- och browserkontroller är gröna.

## 2. Nuläge

| Område | Faktiskt läge | Klassning | Källor |
|---|---|---|---|
| Modulstatus | App och senaste migration använder endast `off` och `live` | Implementerat | `5-Kod/apps/web/lib/tenant-modules.ts`, `5-Kod/supabase/migrations/20260803070000_binary_tenant_modules.sql` |
| Modul-Realtime | En revisionssignal skickas; klienten läser därefter riktig status genom ordinarie väg | Implementerat | `20260803070000_binary_tenant_modules.sql` |
| Delad sidstudio | Båda adminytorna renderar `SidaStudioV2Lazy` | Implementerat | `app/(admin)/admin/sida/page.tsx`, `app/(platform)/kunder/(board)/[id]/page.tsx` |
| Bokningsredigering | `SidaStudioV2` har `BookingFields`, men routes renderar också `BookingPanel` efter studion | Delvis implementerat och duplicerat | `SidaStudioV2.tsx`, `BookingSettings.tsx`, båda routes ovan |
| Extern bokning | `booking.provider` väljer `corevo` eller `external`; leverantören är skild från modulens `off/live` | Lokalt implementerat | `booking-external-url.ts`, `tenant-data.ts`, `BookingProvider.tsx` |
| Länk per knapp | Global HTTPS-länk och validerade overrides per känd CTA-slot går genom en resolver | Lokalt implementerat | `booking-cta-slots.ts`, `BookCta.tsx`, `Bookable.tsx`, `FreshCutLayout.tsx` |
| FreshCut | Tjänster visas utan priser; varje tjänst får extern bokningslänk när modulen är på och inga bokningskontroller när den är av | Lokalt implementerat | `FreshCutLayout.tsx` |
| Kundstart | Befintlig studio har sju steg och ett eget bokningssteg för modul, leverantör och extern URL | Lokalt implementerat | `onboarding-studio/model.ts`, `state.ts`, `phases.ts`, `StudioPanels.tsx` |
| Kundregister | Boarden använder appytan utan extra kortskal; lista och detalj behåller master/detail | Lokalt implementerat | `CustomerWorkbenchList.tsx`, `components/admin/kunder-v2.module.css` |
| Platsväljare | Desktopmenyn öppnas uppåt och begränsas till viewport; mobil/tablet öppnas nedåt | Lokalt implementerat | `LocationSwitcher.tsx`, `LocationSwitcher.module.css`, `Topnav.module.css` |
| Texter/kontrakt | Berörda kontrakt beskriver binär modulstatus och en integrerad bokningspanel | Lokalt implementerat | storefront-komponenter, `site-editor-platform-parity.contract.test.ts` |

### Konflikt som inte får smygas in

Den nya övergripande arbetspromptens avsnitt om `off/draft/live/paused` motsäger
aktuell kod, den nyaste migrationen och det senast genomförda binära
produktbeslutet. Den här cykeln bevarar därför `off/live` och återinför inte
fyralägesmodellen. Ett uttryckligt nytt produkt- och migrationsbeslut krävs för
att ändra detta.

## 3. Rotorsaker

### R1 - två ägare av samma bokningsyta

`SidaStudioV2` äger redan en bokningsflik, samtidigt som varje route monterar
`BookingPanel` efter studion. Det skapar olika visuella och funktionella sanningar
för samma inställning.

### R2 - extern bokning har bara en global destination

`BookCta` och `Bookable` känner endast till `externalUrl`. De saknar ett stabilt
slot-id och kan därför inte välja en egen URL eller förklaras tydligt i editorn.

### R3 - kundstartens state saknar bokningsleverantör

Den befintliga onboardingmotorn har redan branch, namn, tema, moduler, ägare och
skapande. Problemet är inte att en ny onboarding saknas, utan att dess config och
FormData saknar extern bokningslänk och ett begripligt leverantörssteg.

### R4 - arbetsytan är stylad som ett objekt ovanpå appen

`KunderBoard` lägger en rundad, skuggad yta inuti den redan existerande
appytan. Det skapar en extra nivå och begränsar detaljpanelen till en centrerad
maxbredd.

### R5 - popupens riktning följer inte placeringen

Platsväljaren återanvänder toppmenyns nedåtriktade placering trots att den på
desktop sitter vid sidobarens nederkant.

## 4. Beslut

### Alternativ

| Alternativ | Nytta | Risk/komplexitet | Beslut |
|---|---|---|---|
| A. Specialpatcha FreshCut | Snabbt för en kund | Duplicerar regler och lämnar alla andra mallar fel | Avvisad |
| B. Rätta delad studio, wrappers och onboarding | Löser roten och återanvänds av alla tenants | Avgränsad ändring i gemensamma kontrakt | Rekommenderad |
| C. Införa ny page-builder eller bokningsplattform | Stor framtida flexibilitet | Ny parallell arkitektur, hög risk och onödigt beroende | Avvisad |

### Vald lösning

#### En bokningsflik

`SidaStudioV2` är ensam visuell ägare. Den har det befintliga
bokningsinnehållet direkt i fliken.
Routes skickar in tenantens modulstatus och externa bokningsinställningar, men
renderar ingen andra panel.

#### Ett externt länkkontrakt

Den befintliga JSONB-seamen återanvänds:

```text
settings.booking.external_url
settings.booking.provider = "corevo" | "external"
settings.booking.external_cta_urls = {
  "nav": "https://...",
  "hero": "https://...",
  "service:<service-id>": "https://...",
  "mobile": "https://..."
}
```

- `external_url` är standard.
- En tom eller saknad override ärver standardlänken.
- Bara normaliserade fullständiga HTTPS-länkar sparas.
- Okända slot-id:n ignoreras av storefronten och visas som föräldralösa i
  admin tills de tas bort; ingen data raderas tyst.
- Antal, nyckellängd och URL-längd begränsas vid servergränsen.
- Inställningen merge:as med befintlig `settings.booking`; andra nycklar
  skrivs aldrig över.
- En atomisk, tenant-scope:ad RPC patchar endast bokningens driftinställningar
  och skriver sanerad auditdata. Ingen ny domäntabell skapas.

#### Layoutägda slot-id:n

`BookCta` och `Bookable` får ett valfritt stabilt `slotId`. En liten kodägd
manifestlista beskriver vilka slots varje layout använder och deras mänskliga
namn. FreshCut använder bland annat meny, hero, tjänst per service-id,
tjänsteslut, resultat, salong, slut-CTA och kontakt.

Storefrontens enda resolver är:

```text
egen URL för slot -> global extern URL -> ingen extern destination
```

Corevos bokningsmotor påverkas inte av slot-URL:er när leverantören är `corevo`.
Modulen `off` döljer alla publika bokningskontroller oavsett sparad leverantör.

#### Direkt driftinställning, inte sidrevision

Externa bokningslänkar är driftinställningar och sparas genom samma
tenant-scope:ade action som den globala länken. Lokal preview uppdateras direkt;
servern revaliderar tenantens publika sida efter sparande. Sidans text, bilder och
layout fortsätter använda Utkast/Publicera.

Den befintliga Realtime-kanalen för modulens `off/live` behålls. En ny
Realtime-tabell för samtidig länkredigering byggs inte utan ett bevisat behov;
det skulle vara en separat förbättring, inte ett krav för korrekt publicering.

#### Befintlig onboarding utökas

Ingen ny slide-deck-motor skapas. Nuvarande flöde får ett sjunde fokuserat
`Bokning`-steg efter modulvalet:

1. Modulvalet är strikt `off/live` och styr endast publik synlighet.
2. När modulen är `live` väljs `corevo` eller `external` som leverantör.
3. Extern leverantör kräver en validerad HTTPS-länk; Corevo visar sina
   befintliga presentationsval.
4. Granskningssteget visar vald leverantör och den effektiva destinationen.
5. `buildCreateTenantFormData` och `createTenant` sparar länken i samma atomiska
   kundskapande som övriga inställningar.

Stegbyte får en enkel CSS-transition med `prefers-reduced-motion`. Ingen ny
animations- eller onboardingdependency införs.

#### Arbetsytan blir en del av appen

- Ta bort yttersta boardens radius, skugga och avvikande bakgrund.
- Låt masterlistan behålla stabil bredd och detaljytan använda resterande yta.
- Flytta maxbredd till de enskilda innehållsdelar som faktiskt behöver den.
- Behåll mobilens list-/detaljnavigation.
- Öppna platsmenyn uppåt/inåt när den ligger i desktopsidbaren, men nedåt i
  toppbaren.
- Rätta knappar och texter som inte motsvarar destination eller faktisk funktion.

## 5. Prioritering och genomförande

### Fas 0 - sanningsgrind

Prioritet: Kritisk

1. Lås binär modulstatus för denna cykel.
2. Frys en browserbaseline för superadmin, kundadmin och FreshCut desktop/mobil.
3. Kör befintliga fokuserade kontraktstester innan ändring.
4. Bekräfta att inga andra arbetsändringar finns i berörda filer.

Utgång: dokumenterad baseline och inga oklara produktbeslut i implementationen.

### Fas 1 - gemensamt bokningskontrakt

Prioritet: Hög

1. Lägg till parser/normalisering för `external_cta_urls` bredvid befintlig
   extern-URL-normalisering.
2. Utöka tenantens läsmodell med validerade CTA-overrides.
3. Låt en atomisk RPC patcha tillåtna nycklar med gränser och sanerad auditmetadata.
4. Lägg till en ren resolver för effektiv URL.
5. Lägg små enhetstester för parser, merge och resolver.

Utgång: en tenant-scope:ad, testad och bakåtkompatibel dataseam.

### Fas 2 - en bokningsflik på båda adminytorna

Prioritet: Hög

1. För in provider- och länkverktygen i `SidaStudioV2`.
2. Ta bort route-monterad dubblettpanel från båda routes.
3. Visa Corevo-relevanta kontroller när leverantören är `corevo`.
4. Visa standardlänk, slotlista, effektiv URL och override när leverantören är
   `external`; modulens av/på-val ligger separat.
5. Uppdatera parity-kontraktet så att det kräver samma integrerade flik på båda
   ytorna.

Utgång: en gemensam redigeringsupplevelse utan funktionsbortfall.

### Fas 3 - publika CTA-slots

Prioritet: Hög

1. Ge `BookCta` och `Bookable` valfritt `slotId` och använd den gemensamma
   resolvern endast i externt läge.
2. Registrera stabila slot-id:n i FreshCut och övriga layouter som redan har
   bokningsknappar.
3. Registrera `service:<id>` för varje tjänsteknapp.
4. Behåll global länk som bakåtkompatibel fallback.
5. Säkerställ `target="_blank"` och `rel="noopener noreferrer"` för extern
   navigation.

Utgång: varje synlig knapp kan förklaras, testas och vid behov få egen URL.

### Fas 4 - kundstart

Prioritet: Hög

1. Lägg till bokningsfält i befintlig `StudioCfg` och reducer.
2. Lägg till ett steg i befintliga phases/panels, inte en ny wizard.
3. Visa provider och destination i review.
4. Tråda värden genom FormData och den befintliga atomiska create-actionen.
5. Testa en Corevo-tenant och en tenant med extern leverantör.

Utgång: en ny externbokad kund behöver ingen efterhandsräddning för att få en
fungerande webbplats.

### Fas 5 - kundarbetsyta och popupbuggar

Prioritet: Normal

1. Gör kundboarden fullbredd i appens innehållsyta.
2. Behåll master/detail och mobilnavigation utan extra kortskal.
3. Rätta platsväljarens riktning per placering.
4. Rätta felaktig knapptext/destination och inaktuella hjälprader i berörda ytor.
5. Kontrollera tomt, laddning, fel, få/många kunder och lång text.

Utgång: sammanhängande arbetsyta utan klippning eller falska funktioner.

### Fas 6 - samlad acceptans

Prioritet: Kritisk

1. Kör fokuserade tester efter varje fas.
2. Kör därefter typecheck, lint, relevanta Vitest-sviter och produktionsbuild.
3. Kör browsermatrisen nedan med riktiga routes och isolerade sessioner.
4. Jämför preview och publik sida.
5. Pusha/deploya först efter separat godkännande och grön exakt-SHA CI.

## 6. Påverkade delar

### Primära filer

- `5-Kod/apps/web/app/(admin)/admin/sida/page.tsx`
- `5-Kod/apps/web/app/(platform)/kunder/(board)/[id]/page.tsx`
- `5-Kod/apps/web/components/platform/SidaStudioV2.tsx`
- `5-Kod/apps/web/components/platform/SidaStudioV2.manifest.ts`
- `5-Kod/apps/web/components/platform/BookingSettings.tsx`
- `5-Kod/apps/web/lib/platform/actions/data.ts`
- `5-Kod/apps/web/lib/platform/booking-external-url.ts`
- `5-Kod/apps/web/lib/tenant-data.ts`
- `5-Kod/apps/web/components/storefront/BookingProvider.tsx`
- `5-Kod/apps/web/components/brand/BookCta.tsx`
- `5-Kod/apps/web/components/storefront/Bookable.tsx`
- `5-Kod/apps/web/components/storefront/layouts/FreshCutLayout.tsx`
- `5-Kod/apps/web/lib/platform/onboarding-studio/model.ts`
- `5-Kod/apps/web/lib/platform/onboarding-studio/state.ts`
- `5-Kod/apps/web/lib/platform/onboarding-studio/phases.ts`
- `5-Kod/apps/web/components/platform/onboarding-studio/StudioPanels.tsx`
- `5-Kod/apps/web/components/admin/KunderBoard.tsx`
- `5-Kod/apps/web/components/admin/kunder-v2.module.css`
- `5-Kod/apps/web/components/portal/LocationSwitcher.tsx`
- `5-Kod/apps/web/components/portal/LocationSwitcher.module.css`

### Data och säkerhet

- `tenant_settings.settings.booking` utökas inom befintlig JSONB-kolumn.
- Migrationen lägger till en atomisk RPC men ingen ny domäntabell eller
  service-role-genväg.
- Befintlig auth/tenantkontroll i `siteRevisionCtx` är fortsatt enda skrivväg från
  superadminens Sida-yta.
- Kundadminens eventuella andra skrivväg måste använda samma parser och
  tenantkontroll; ingen duplicerad validering tillåts.
- Modulstatus och Realtime-kontrakt ändras inte.

## 7. Validering

### Automatiska kontroller

- Parser av standardlänk och CTA-map accepterar endast HTTPS och definierade
  storleksgränser.
- Merge bevarar okända befintliga `settings.booking`-nycklar.
- Resolvern bevisar override, fallback och null.
- Båda adminroutes använder samma integrerade studio och saknar separat panel.
- Corevo-läge ignorerar externa overrides och öppnar befintlig bokningsmotor.
- Externt läge öppnar effektiv URL och kan inte falla tillbaka till `/boka`.
- Service-id ger stabil unik slot utan att pris renderas.
- Onboarding serialiserar och sparar rätt providerdata.
- Binär module-state och Realtime-kontrakt fortsätter vara gröna.
- Menyplacering och arbetsytegeometri har fokuserade kontrakt där CSS-regeln är
  bärande.

### Browsermatris

| Yta | Bokning | Desktop | Mobil |
|---|---|---:|---:|
| Superadmin Sida | Corevo `live` | krävs | krävs |
| Superadmin Sida | Extern, booking `live` | krävs | krävs |
| Kundadmin Redigera sidan | Corevo `live` | krävs | krävs |
| Kundadmin Redigera sidan | Extern, booking `live` | krävs | krävs |
| FreshCut publik/preview | Extern | krävs | krävs |
| Kontrolltenant publik/preview | Corevo | krävs | krävs |
| Ny kund-onboarding | Corevo | krävs | krävs |
| Ny kund-onboarding | Extern | krävs | krävs |

För varje ruta kontrolleras:

- alla relevanta kontroller är synliga och klickbara;
- inga paneler eller knappar överlappar;
- ingen horisontell sidscroll;
- popup öppnas inom viewport;
- effektiv URL visas och öppnas korrekt;
- preview och publicerad loader använder samma inställning;
- sparande som misslyckas visar ett ärligt fel och lämnar gammal data intakt;
- tangentbord, fokus, labels och reduced motion fungerar.

### Baselinebevis 2026-08-03

Följande fokuserade Vitest-baseline kördes mot oförändrad produktkod:

```text
14 testfiler passerade
91 tester passerade
```

Baseline omfattade binär modulstatus och dess Realtime-kontrakt,
tenant-module write/admin, bokningskontroller, FreshCut-kontrakt,
site-editor-parity, onboardingens render/transition/slug, portalskal samt
plattformens KunderBoard.

Viktig tolkning: grönt nuläge bevisar de nuvarande kontrakten, inte att den
önskade förändringen redan finns. Exempelvis kräver det nuvarande
`site-editor-platform-parity.contract.test.ts` fortfarande den separata
`BookingPanel` som denna plan ska avveckla. Testet måste därför ändras samtidigt
med rotfixen och därefter bevisa den integrerade panelen.

Efter produktionsmigrationen verifierades `freshcut.corevo.se` på desktop och
390 px mobil: sju tjänster syns utan priser, bokningslänkar går externt och sidan
har ingen horisontell scroll. Den autentiserade browsermatrisen för alla roller
är fortfarande bredare än denna releasekontroll och ska inte beskrivas som
fullständigt manuellt genomgången.

## 8. Risker och rollback

| Risk | Motåtgärd |
|---|---|
| Ett slot-id byter namn och lämnar en override utan konsument | Kodägt manifest, stabilitetskontrakt och visning av föräldralösa overrides |
| En write clobber:ar övriga booking-inställningar | Samma merge-mönster som befintlig action samt explicit test |
| Extern URL används när Corevo är aktivt | Resolvern kräver både `live` och explicit provider `external` och kontraktstestas |
| FreshCut-specialfall sprids i kärnan | Generiskt `slotId`; layouten äger endast sina slotnamn |
| Mobil editor eller kundboard klipps igen | Fast viewportmatris och skärmdumpskontroll före release |
| Samtidiga admins ser gammal länk tills omladdning | Korrekt save/revalidation först; settings-Realtime tas endast som separat beslutad förbättring |
| Rollback behöver återställa tidigare beteende | Nya JSON-nycklar ignoreras av gammal kod; UI/resolver kan rullas tillbaka utan dataradering |

## 9. Backlog utanför denna cykel

Prioritet Normal:

- Uppdatera aktuell arkitekturdokumentation som fortfarande beskriver
  `off/draft/live/paused`, utan att skriva om historiska migrationer.
- Rensa föråldrade kommentarer och tester som nämner fyralägen eller separat
  bokningspanel.
- Inventera CTA-slots i resterande mallar efter att FreshCut och en kontrollmall
  har bevisat kontraktet.

Prioritet Framtida:

- Import/synk från Bokadirekt, inklusive automatisk koppling av varje importerad
  tjänst till exakt Bokadirekt-URL. Tills en godkänd datakälla finns används
  standardlänk eller manuellt sparad länk per tjänst.
- Separat Realtime-invalidering för samtidiga ändringar av tenantinställningar,
  om ett verkligt fleradministratörsbehov bevisas.
- Central hosting-, domän-, drift- och integrationsöversikt behandlas i en egen
  arbetscykel.
- Hermes/agent-fit-gap behandlas i en egen arbetscykel och får inte expandera
  denna implementation.

## 10. Slutbeslut för planeringscykeln

### Fakta

Rotorsaker och befintliga återanvändningspunkter är identifierade i aktuell kod.
Ingen ny plattform eller bokningsmotor behövs.

### Antagande

Binär modulstatus `off/live` förblir gällande. Detta antagande stöds av aktuell
kod och migration men ska korrigeras om Zivar uttryckligen beslutar att
fyralägesmodellen ska återinföras.

### Rekommendation

Genomför alternativ B i fasordning 0-6. Börja med det gemensamma datakontraktet
och den delade studion; gör inte visuella specialpatchar först.

### Status

**Redo för slutrelease.** Produktimplementationen och databasmigrationen är
verifierade. Sista UI-rättningen ska gå genom exakt-SHA CI och produktionsdeploy.

### Nästa steg

1. Kör exakt-SHA CI för slutcommit.
2. Deploya samma SHA och kör produktionssmoke.
3. Verifiera FreshCut desktop/mobil utan blockerande fast mobilknapp.
