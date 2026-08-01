# Implementeringsprompt för Claude Design — Corevo kundportal

Du ska förbättra den befintliga lösenordsfria Corevo-kundportalens design utan att ta bort, förenkla eller simulera bort någon befintlig funktionalitet. Utgå från den bifogade HTML-prototypen som visuell och interaktionsmässig riktning, men implementera lösningen med projektets befintliga ramverk, komponentmönster, routing, datalager och PWA-arkitektur.

## 1. Börja med en faktisk kodinventering

Innan du ändrar något:

1. Läs hela projektstrukturen och identifiera frontend-ramverk, byggverktyg, routing, state/data fetching, formulärhantering, styling, ikoner, testsetup och PWA-plugin.
2. Kartlägg samtliga befintliga vyer, routes, komponenter och användarflöden.
3. Spåra verkliga dataflöden för bokningar, kundprofil, notifieringar, autentisering, magic link/engångslänk, betrodd enhet och PIN.
4. Kontrollera `manifest`, service worker, cache-strategier, offline/fallback, install prompt, app-ikoner, theme/background colors och uppdateringsflöde.
5. Sök efter befintliga design tokens, komponenter och hjälpfunktioner innan du skapar nya.
6. Dokumentera kort vilka filer som måste ändras och varför. Gör sedan minsta sammanhängande ändring som uppnår designen.

Ändra inte API-kontrakt, autentiseringslogik, säkerhetsmodell, databasmodell eller bokningsregler om det inte krävs för att rätta ett verifierat fel.

## 2. Produktmål

Portalen är ett vardagsverktyg för salongskunder, inte en marknadsföringssida. Första skärmen ska omedelbart visa kundens nästa relevanta handling:

- nästa bokning med datum, tid, behandling, behandlare och salong,
- möjlighet att visa, omboka eller avboka enligt befintliga regler,
- tydlig väg till ny bokning,
- notifieringar och påminnelser,
- profil och kontaktuppgifter,
- PWA-installation när webbläsaren faktiskt tillåter det,
- status och hantering för betrodd enhet/PIN.

Behåll alla nuvarande tom-, laddnings-, fel-, offline-, inloggnings- och utloggningstillstånd.

## 3. Visuell riktning

Skapa en varm, skandinavisk och diskret premiumkänsla:

- mörk grafit som identitetsbärande färg,
- varm benvit bakgrund,
- dämpad mässing/koppar som sparsam accent,
- mjuka men inte överdrivna hörn,
- tydlig typografisk hierarki,
- serif endast för större rubriker/datumlockups och sans-serif för all funktionell text,
- tunna linjer och återhållsamma skuggor,
- hög kontrast och lugna ytor.

Undvik:

- Wavy-liknande vågformer eller kopierad varumärkesstil,
- lila/blå AI-gradienter,
- stora marknadsföringsheros,
- dekorativa blobs,
- glasmorfism överallt,
- kort inuti kort,
- överdrivna animationer,
- generiska stockbilder,
- att varje sektion får samma visuella vikt.

Det minnesvärda designelementet ska vara nästa-bokningens datumlockup: ett stort serifdatum i dämpad mässing på en grafitmörk yta. Använd det sparsamt och konsekvent.

## 4. Informationsarkitektur och navigation

Primär navigation:

1. **Översikt**
2. **Mina bokningar**
3. **Profil & säkerhet**

På mobil används en fast bottennavigation med tre tydliga mål. På större skärmar används en vänsterspalt med salongsidentitet och samma navigationsmål. Notifieringar ligger som en tydlig ikon i toppfältet med oläst-räknare.

Navigationsvalet ska vara synligt både visuellt och semantiskt (`aria-current="page"`). Bakåtknapp, deep links och befintlig routing ska fortsätta fungera.

## 5. Vyer och tillstånd

### Översikt

- Personlig hälsning och dagens datum.
- Framhävd nästa bokning.
- Primär knapp: visa bokning.
- Sekundär handling: omboka/avboka enligt befintlig behörighet och deadline.
- Genväg till ny bokning.
- Genväg till betrodd enhet/PIN.
- Installationskort för PWA visas endast när relevant.
- Om ingen bokning finns: tydlig tomvy med “Boka en tid”, inte en tom stor kortyta.

### Mina bokningar

- Separera kommande och tidigare bokningar.
- Visa status som bekräftad, ombokad, avbokad eller väntande med både text och färg.
- Varje rad ska vara klickbar och tangentbordsnavigerbar.
- Bevara pagination/infinite loading om det redan finns.
- Datum och tid ska formateras enligt svensk locale och faktisk tidszon.

### Profil & säkerhet

- Profilhuvud med initialer eller befintlig avatar.
- Kontaktuppgifter och notifieringsinställningar.
- Tydlig säkerhetssektion för betrodd enhet/PIN.
- Förklara lösenordsfri inloggning kort och sakligt.
- Visa aldrig PIN i klartext eller logga den.

### Notifieringar

- Mobil: bottom sheet.
- Desktop: en sidopanel eller kompakt dialog som passar befintlig struktur.
- Oläst/läst status ska vara tydlig.
- Behåll befintliga markera-som-läst- och deep-link-beteenden.

### PIN/betrodd enhet

- Använd befintlig säkerhetsimplementation; prototypens tangentbord är endast visuell riktning.
- Stöd systemtangentbord, autofyll och tillgängliga felmeddelanden om projektet använder ett vanligt inputfält.
- PIN ska vara maskerad, aldrig sparas i vanlig localStorage och aldrig exponeras i analytics eller loggar.
- Hantera felaktig PIN, spärr/timeout, glömd PIN, återkallad enhet och offline-läge enligt befintliga regler.

## 6. PWA

Bevara och verifiera:

- giltigt web app manifest,
- korrekta 192/512-ikoner samt maskable icon om projektet har stöd,
- `display`, `start_url`, `scope`, `theme_color` och `background_color`,
- registrering och uppdatering av service worker,
- offline-fallback utan att cacha privat kunddata osäkert,
- faktisk `beforeinstallprompt`-hantering där den stöds,
- instruktion för “Lägg till på hemskärmen” på iOS där native prompt saknas,
- dold installations-CTA när appen redan körs standalone eller inte kan installeras,
- tydlig, icke-störande uppdateringsnotis när en ny version väntar.

Ändra inte cache-policy för autentiserade API-svar utan säkerhetsgranskning. Cachea inte PIN, magic links, access tokens eller känsliga profilsvar i en generell runtime-cache.

## 7. Responsivitet

Utgå mobile-first från cirka 320 px bredd.

- Inget horisontellt scroll.
- Långa svenska behandlingsnamn, salongsnamn och kundnamn ska radbrytas.
- Tryckytor minst 44×44 px.
- Bottennavigation respekterar `safe-area-inset-bottom`.
- Sticky header respekterar `safe-area-inset-top`.
- På cirka 780 px och uppåt byter navigationen till vänsterspalt.
- Innehållet får en läsbar maxbredd och använder två kolumner endast när det förbättrar skanning.

## 8. Tillgänglighet

Sikta på WCAG 2.2 AA:

- semantiska landmärken och rubrikordning,
- synlig fokusmarkering,
- full tangentbordsnavigering,
- korrekt dialogfokus, fokusfälla och återställning av fokus,
- Escape stänger dialoger,
- `aria-live` för bekräftelser och asynkrona fel,
- färg används aldrig som enda statusbärare,
- textkontrast minst 4.5:1,
- stöd för `prefers-reduced-motion`,
- formulär har riktiga labels och fel kopplade via `aria-describedby`.

## 9. Implementation

- Återanvänd befintliga komponenter, tokens och installerat ikonbibliotek.
- Lägg inte till ett nytt UI-bibliotek eller en ny stylinglösning om projektet redan har en.
- Skapa en liten tokenyta för färg, typografi, spacing, radius och elevation i projektets befintliga format.
- Dela endast upp komponenter där projektets befintliga mönster eller faktisk återanvändning motiverar det.
- Använd riktiga API-data och befintliga handlers; inga hårdkodade prototypdata i produktionsvyer.
- Behåll befintlig felhantering och analytics, men kontrollera att känslig data inte loggas.
- Undvik omfattande refaktorering utanför de berörda vyerna.

## 10. Verifiering före leverans

Testa minst:

- inloggning via magic link/engångslänk,
- återkomst på betrodd enhet och PIN,
- felaktig/glömd PIN,
- nästa bokning finns respektive saknas,
- flera kommande och tidigare bokningar,
- visa, omboka och avboka,
- laddning, API-fel, tomdata och offline,
- notifieringar olästa/lästa,
- PWA-installation möjlig, omöjlig och redan installerad,
- service-worker-uppdatering,
- 320, 375, 768, 1024 och 1440 px,
- tangentbord, skärmläsarnamn, fokus och reduced motion.

Kör projektets befintliga test-, lint- och byggkommandon. Lägg endast till små, fokuserade tester för den logik eller de flöden som faktiskt ändras.

## Leveransformat

Leverera:

1. Kort inventering av den befintliga arkitekturen.
2. Lista över ändrade filer med en rad motiv per fil.
3. Implementerad design i befintlig kod.
4. Resultat från build, lint och tester.
5. Eventuella kvarstående risker, särskilt kring autentisering, PIN och PWA-cache.

Använd `corevo-kundportal-prototyp.html` som visuellt facit för hierarki, färg, spacing och responsivt beteende, men låt alltid den befintliga applikationens verkliga funktioner och säkerhetsregler vinna över prototypens demonstrationsdata.
