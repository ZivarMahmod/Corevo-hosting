# Audit — 12 Corevo-mallar och likriktat presentkort

**Datum:** 2026-07-13
**Typ:** read-only kod-/arkitekturaudit, ingen produktionskod ändrad
**Kanon granskat först:** repots spårade `handoff/HANDOFF.md` + samtliga 12 `.dc.html` i `handoff/`
**Kontroll:** den bifogade zippen är innehållsidentisk efter normalisering av CRLF/LF
**Kod granskat:** `main` @ `e712d62`, senaste tagg `v1.30.1`

## Slutsats

Det är inte i första hand mallvalet som gör presentkortssidorna lika. Den direkta orsaken är att presentkortsmodulen har haft **en gemensam presentationskomponent för alla mallar**.

- I den senast taggade versionen `v1.30.1` renderar `/presentkort` alltid `PresentkortSection`. Mallnyckeln läses inte alls.
- På nuvarande `main` frågar live-routen efter `themeModuleViews(settings.theme).presentkort`, men bara **Ateljé Vinter** har registrerat en sådan vy.
- Övriga **11 av 12** kanoniska mallar faller tyst tillbaka till samma `PresentkortSection`.
- Preview-routen `salong-preview/[slug]/presentkort` använder fortfarande `PresentkortSection` direkt för **alla 12**, även Ateljé Vinter.

Detta förklarar exakt observationen: färger/typsnitt kan skifta via tokens, men anatomi, grid, kort, beloppsval och CTA förblir samma.

## Bevis 1 — kanon har 12 olika presentkortslayouter

Alla 12 manifest deklarerar `presentkort → module: "presentkort", route: "/presentkort"`. Varje HTML-fil har dessutom ett eget `showPresentkort`-block. Blocken är inte varianter av samma layout; de har 12 olika strukturfingeravtryck.

| Mallnyckel | Kanonisk presentkortsform, kort sammanfattad |
|---|---|
| `ateljevinter` | Gåvobrev/verk, maxbredd 560, svart linje, rak minimal form |
| `aurora` | Tvåkolumn, romantiskt kort, korall/rosa, rund form |
| `blomstertorget` | Tidnings-/värdebevis, 3 px svart ram, röd CTA |
| `calytrix` | Tvåkolumn e-handel, plommon/vitt, även eget beloppsinput |
| `eloria` | Mörk klassisk gåva, guldlinje, sigill-/bomullspapperskänsla |
| `kalla` | Tvåkolumn hårspa, teal, mjuka 6–8 px radier |
| `lunaria` | Art Déco, marin/guld, tvåkolumn |
| `onyx` | Mörkt gift card, guld, egen fyrkolumns valörrad |
| `siluett` | Modemagasin, svart/lila, tvåkolumn |
| `sivsav` | Skandinavisk, salvia, 24 px kort + pill-knappar |
| `snitt` | Svart studio, neongul, grafisk tvåkolumn |
| `solsalt` | Medelhav, blå, 24 px kort + pill-knappar |

De 12 blocken är 1 846–2 788 tecken långa, har olika taggantal, olika copy och unika SHA-fingeravtryck. Det finns alltså inget stöd i kanon för en gemensam presentkortslayout.

## Bevis 2 — deployad version var hårdkodad till en vy

I `v1.30.1` består slutet av `app/(public)/presentkort/page.tsx` av:

```tsx
return <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={paused} />
```

Ingen `settings.theme`, inget registry-uppslag och ingen mallkomponent används. Alla tenants går därför genom exakt samma JSX.

Tre commits efter `v1.30.1` har börjat rätta Ateljé Vinter:

- `3d8e1f4` — Ateljés offertform
- `5187190` — Ateljés gåvobrev + seminarier
- `e712d62` — Ateljés chrome

De ligger efter senaste tagg (`v1.30.1-3-ge712d62`). De är därmed inte bevisade live genom projektets taggstyrda deployflöde.

## Bevis 3 — dagens fallback gör 11 av 12 lika

Live-routen på `main`:

- `app/(public)/presentkort/page.tsx:27` hämtar `themeModuleViews(settings.theme).presentkort`.
- Om sloten saknas går den på rad 34 till delade `PresentkortSection`.

Registrerad status på `main`:

| Mall | Egen `moduleViews.presentkort` |
|---|---:|
| Ateljé Vinter | Ja |
| Aurora | Nej |
| Blomstertorget | Nej |
| Calytrix | Nej |
| Eloria | Nej |
| Källa | Nej |
| Lunaria | Nej |
| Onyx | Nej |
| Siluett | Nej |
| Siv & Säv | Nej |
| Snitt | Nej |
| Sol & Salt | Nej |

Preview-tvillingen `app/salong-preview/[slug]/presentkort/page.tsx:32` renderar `PresentkortSection` direkt. Den frågar inte registryt alls. Resultatet är att preview och live kan visa olika sak för Ateljé Vinter och samma generiska sak för resten.

## Varför Claude har kunnat missa detta

### P0 — kontraktet tillåter ett resultat som bryter mot kanon

`ThemeModuleViews.presentkort` är optional (`layouts/florist/types.ts:296`). Kontraktets uttalade beteende är att en utelämnad vy går till den delade fallbacken. Det är rimligt för äldre mallar utan en designad sida, men fel för de här 12 eftersom varje manifest uttryckligen innehåller en egen presentkortssida.

Kanon säger i praktiken **obligatorisk per-mall-vy**. TypeScript-kontraktet säger **valfri vy + tyst fallback**. Koden vinner, därför likriktas sidorna.

### P0 — testerna kontrollerar funktion/navigering, inte form

`florist/modulvyer.test.tsx:49–53` kräver endast egen `shop` och `blogg` för varje floristmall. Presentkort ingår inte.

`florist-suite.test.tsx:131` kräver att en live presentkortsmodul är **nåbar via länk**. Testet kräver inte en `presentkort`-slot och jämför inte sidans form mot `.dc.html`.

Alltså kan hela testsviten vara grön samtidigt som 11 eller 12 presentkortssidor använder samma markup.

### P1 — handoffen är spårad, men ingen mekanisk acceptansgate kör den

Samtliga 12 `.dc.html` och `handoff/HANDOFF.md` är spårade i Git sedan `f6979e6`. Auditens sökning hittade däremot ingen `<mall>.accept.spec.ts` och ingen `probe.js` som kör implementationerna mot dessa spårade original. Goal-64 beskriver pixel-probe som krav, men den gaten finns inte kopplad till `handoff/`.

När facit inte är en körbar gate blir "registrerad + renderar + länken fungerar" lätt felaktigt tolkat som klart.

### P1 — live och preview har två separata renderingsvägar

Live-routen har påbörjat registry-uppslag. Preview-routen har inte det. Samma sida kan därför divergera beroende på om Zivar ser kundkortets preview eller riktig kunddomän.

Det här är samma klass av fel som goal-64 själv varnade för: preview-tvillingen glöms.

### P1 — dokumentstatusen motsäger koden

`goal-64-mallsviten-ersatts-med-claude-design.md` säger fortfarande "PLANERAD — inväntar zip, ingen kod rörd", medan historiken visar att sviten byggts och ersatts. En agent som litar på statusfältet får fel nuläge; en agent som bara litar på commits kan i stället missa att acceptansgaten aldrig körts.

## Mallvalets styrkedja

### Det som fungerar

- Alla 12 kanoniska nycklar finns i `STOREFRONT_THEMES`.
- Alla 12 har registrerade hem-layouts.
- Kanoniska paletter (8/8) och typsnitt (2/2) återfinns i respektive implementation.
- Befintlig kunds mallbyte valideras server-side i `lib/platform/actions/theme.ts:21–22` och sparar `tenant_settings.settings.theme` utan att skriva över övriga settings.
- Onboarding och kundkort använder samma `ThemeGallery`.

Det finns därför inget belägg för att giltiga val som `snitt`, `siluett` eller `ateljevinter` generellt byts till Leander på live-sidan.

### Två verkliga fallbackrisker

1. Vid skapande av kund gör `pickTheme()` i `lib/platform/actions/tenants.ts:39–43` ett okänt/tomt värde till `DEFAULT_STOREFRONT_THEME` (`leander`) utan fel. Befintligt kundbyte avvisar däremot okänd mall. Den inkonsekvensen kan maskera fel i onboardingdata.
2. Onboarding-preview gör samma sak klient-side i `StorefrontPreview.tsx:41–44`: okänd nyckel visas som Leander i stället för att visa ett tydligt konfigurationsfel.

De fallbackerna kan skapa Leander-kloner vid trasig/stale mallnyckel, men de förklarar inte presentkortslikriktningen för giltiga 12 nycklar. Där är den gemensamma modulpresentationen den direkta orsaken.

## Mallgalleriet innehåller inte bara de 12

Nuvarande katalog erbjuder **19 mallar för en ny kund**, inte 12:

- de 12 kanoniska mallarna
- fem legacy: `salvia`, `leander`, `zigge`, `linnea`, `edit`
- `flora`
- `zentum`

`freshcut` ligger separat som kundegen och visas inte för nya kunder. Om produktbeslutet är att valbara mallar ska vara exakt handoffens 12 bryter `THEME_PALETTES`/`SELECTABLE_THEMES` fortfarande mot det beslutet.

## Rotorsak, kondenserad

```text
Vald mall → settings.theme (fungerar för giltiga nycklar)
                       ↓
                 /presentkort
                       ↓
v1.30.1: alltid PresentkortSection
main:    theme.presentkort? → saknas för 11/12 → PresentkortSection
preview: alltid PresentkortSection
```

Modulens funktion och data ska vara gemensam. Modulens **presentation får inte vara gemensam** när kanon levererar 12 olika presentationer.

## Minsta korrekta ombyggnad

1. Gör en namngiven `COREVO_12_KEYS`-svit. För dessa nycklar ska `presentkort` vara obligatorisk, inte optional.
2. Behåll delad funktion: `loadPresentkortData`, configtolkning, paused-state och `useCart().addLine`.
3. Transplantera exakt markup/copy/px/hex/font från varje fils `showPresentkort`-block till 12 presentationskomponenter. Ateljé Vinter är redan pilot; 11 återstår.
4. Låt live och preview använda samma resolver. Ingen separat presentkortslogik i preview.
5. Lägg en liten blockerande testmatris:
   - varje `COREVO_12_KEYS` har `moduleViews.presentkort`
   - alla 12 renderar utan throw med samma moduldata
   - 12 renderingsfingeravtryck är unika
   - manifestets nyckelvärden och per-mall probes ger 0 FAIL på desktop + 375 px
6. Om bara dessa 12 ska erbjudas: bygg `SELECTABLE_THEMES` från `COREVO_12_KEYS`; behåll kundlåsta mallar renderbara men inte valbara.
7. Ändra onboardingens okända mall från tyst Leander-fallback till valideringsfel. Behåll defensiv read-fallback för gamla DB-rader, men logga den.
8. Tagga/deploya först när samma acceptans körts mot både kund-preview och riktig storefront.

## Beslut som behöver låsas innan implementation

Ett enda produktbeslut återstår: ska nya kunder se **exakt de 12** från `handoff/`, eller ska de sju extra generella/legacy-mallarna finnas kvar? Det påverkar bara urvalet i galleriet, inte rotorsaksfixen för presentkort.

All övrig riktning följer redan kanon: 12 mallar, 12 egna designs, en gemensam motor och gemensam affärslogik.

## Åtgärdat efter auditen — 2026-07-13

- De 11 saknade presentkortsvyerna är transplanterade från respektive `handoff/*.dc.html` och registrerade i mallkontraktet. Tillsammans med Ateljé Vinter har alla 12 nu varsin komponent.
- Live och `salong-preview/[slug]/presentkort` använder samma `themeModuleViews(theme).presentkort`-slot och samma dataladdare.
- Kundskapande, mallbyte och branschförval accepterar nu exakt handoffens 12 mallnycklar. Legacy-/kundegna teman ligger kvar som renderbara för befintliga kunder, men erbjuds inte som nya val.
- Okänd eller tom mallnyckel vid kundskapande ger valideringsfel i stället för tyst Leander-fallback.
- Blockerande test kräver exakt 12 valbara mallar, 12 ifyllda presentkortsslots, 12 unika komponentreferenser och en unik handoff-signatur per renderad vy.
- Verifiering: TypeScript `--noEmit` grön; 183 berörda Vitest-test gröna. Mekanisk pixel-/browserprobe saknas fortfarande i repot och måste därför köras som separat visuell acceptans innan deploy kan kallas pixelidentisk.
