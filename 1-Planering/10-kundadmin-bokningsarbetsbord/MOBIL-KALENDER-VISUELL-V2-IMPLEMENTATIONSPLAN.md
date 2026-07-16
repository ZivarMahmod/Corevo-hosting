# Kundadmin kalender mobil v2 — visuell implementation

> **För agentiskt arbete:** använd testdriven implementation och kör uppgifterna i ordning. Underlaget `Kundadmin Kalender Mobil v2.dc.html` är visuellt facit; inga egna designval får införas.

**Mål:** Göra kundadminens kalender under 768 CSS-px mekaniskt lik den godkända ljusa Mobil v2-prototypen, samtidigt som alla befintliga boknings-, sök-, avboknings-, hjälp- och blockeringsflöden förblir åtkomliga och oförändrade.

**Arkitektur:** Samma `CalendarBoard`, `Topnav` och drawers används på alla bredder. Endast mobilens placering och presentation ändras med CSS-brytpunkt vid 767px; inga user-agent-kontroller eller separata mobilrutter införs. Kalenderns befintliga funktioner återanvänds med små presentationsvarianter i `CalendarSearch` och `CalendarHelp`.

**Teknik:** Next.js, React, TypeScript, CSS Modules, Vitest, befintliga portalmodals och in-app browser på `localhost:3111`.

## Globala krav

- Designfacit: `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/klar/01-agaradmin-mobil-pwa/Kundadmin Kalender Mobil v2.dc.html`.
- Mobil = `<768px`; iPad = `768–1199px`; desktop = `>=1200px`.
- Ingen user-agent-sniffning, inget `user-scalable=no` och inga `touch-action`-hack.
- Alla personalkolumner ska rymmas samtidigt i dagvyn; rubriken är enda personalvalet och samma rubrik återgår till alla.
- Desktop och iPad får inte ändra struktur eller beteende.
- Minsta touchmål är 44x44px och fokusmarkeringar ska vara synliga.
- Ny bokning, tom-tid-klick, ombokning, avbokning/återställning, blockering, kalender­sökning och hjälp ska förbli nåbara.

---

### Uppgift 1: Lås mobilens visuella kontrakt

**Filer:**
- Ändra: `5-Kod/apps/web/components/admin/calendar-mobile-v2.contract.test.ts`
- Ändra: `5-Kod/apps/web/components/portal/admin-mobile.contract.test.ts`

**Kontrakt:**
- `CalendarBoard` innehåller `mobileCalendarHeaderHelp` och `mobileCalendarSearchAction`.
- Den permanenta `mobileCalendarUtilities`-raden finns inte längre.
- `CalendarHelp` kan bära länken till avbokningsloggen i mobilens hjälp-sheet.
- Kalenderarbetsbordets mobilnav visar textetiketter med aktiv punkt, visar `via Corevo`, döljer toppens dubbla sök/konto-knappar och placerar sök + plus tillsammans i mitten.

- [x] Skriv de nya kontraktsassertionerna innan produktionskod ändras.
- [x] Kör `pnpm vitest run components/admin/calendar-mobile-v2.contract.test.ts components/portal/admin-mobile.contract.test.ts` från `5-Kod/apps/web`.
- [x] Bekräfta att testet faller därför att de nya klass-/variantkontrakten saknas.

### Uppgift 2: Ge befintlig sök och hjälp rätt mobila presentation

**Filer:**
- Ändra: `5-Kod/apps/web/components/admin/CalendarSearch.tsx`
- Ändra: `5-Kod/apps/web/components/admin/CalendarHelp.tsx`
- Ändra: `5-Kod/apps/web/components/admin/calendar.module.css`
- Test: `5-Kod/apps/web/components/admin/calendar-mobile-v2.contract.test.ts`

**Gränssnitt:**
- `CalendarSearch({ tz, mobileSheet? })`: `mobileSheet=true` visar en 44px cirkulär sökknapp som öppnar samma riktiga sökfält/resultat i en bottom sheet.
- `CalendarHelp({ label?, mobileHeader?, children? })`: `mobileHeader=true` visar prototypens `?`-knapp; `children` används för den befintliga avbokningsloggen så funktionen inte försvinner när verktygsraden tas bort.

- [x] Skriv kontraktstest för `mobileSheet`, `mobileHeader` och hjälp-sheetens barninnehåll.
- [x] Kör testet och bekräfta rätt RED-fel.
- [x] Implementera endast presentationsvarianterna; återanvänd `searchBookings`, `loadCancelled` och befintliga `Modal`.
- [x] Kör kontraktstestet tills det blir grönt.

### Uppgift 3: Bygg Kalender Mobil v2-layouten

**Filer:**
- Ändra: `5-Kod/apps/web/components/admin/CalendarBoard.tsx`
- Ändra: `5-Kod/apps/web/components/admin/calendar.module.css`
- Test: `5-Kod/apps/web/components/admin/calendar-mobile-v2.contract.test.ts`

**Resultat:**
- Personalkolumnerna börjar direkt under 52px-toppen och kalendergriden får den frigjorda höjden.
- Datum, status, Idag, föregående/nästa, Dag/Vecka/Månad och Blockera ligger i den kompakta bottendocken.
- Den tidigare permanenta raden `Sök kund / Avbokade / Hjälp` tas bort.
- Sök blir cirkulär handling bredvid plusknappen i bottennavets mitt.
- `?` ligger i mobilens topp till höger och öppnar hjälp; avbokningsloggen är nåbar därifrån.
- Mobilens datumväljare fortsätter använda riktig URL-navigation och befintlig dag-/vecko-/månadlogik.

- [x] Kör kontraktstestet och bekräfta RED för den nya layouten.
- [x] Flytta komponenterna i JSX utan att ändra server actions eller bokningsdata.
- [x] Justera mobil-CSS till prototypens mått: axel 30px, rubrik 8/7px, dock 50px + 42px och 44px handlingar.
- [x] Kör kontraktstestet tills det blir grönt.

### Uppgift 4: Matcha mobilskalet utan att påverka andra sidor

**Filer:**
- Ändra: `5-Kod/apps/web/components/portal/Topnav.module.css`
- Vid behov ändra: `5-Kod/apps/web/components/portal/Topnav.tsx`
- Test: `5-Kod/apps/web/components/portal/admin-mobile.contract.test.ts`

**Resultat:**
- På kalenderarbetsbordet visas logomärke, företagsnamn och `via Corevo` i toppraden; de dubbla sök-/kontoikonerna döljs eftersom sök ligger i bottendocken och konto finns i Mer.
- Bottennavets fyra destinationer är textetiketter med en 4px aktiv punkt, utan extra symbolrad.
- Kalenderns mittplats rymmer sök och grön plusknapp sida vid sida, båda 44px.
- Övriga adminrutter behåller sina befintliga kontroller om de inte använder kalenderarbetsbordets klass.

- [x] Skriv kontrakt som avgränsar reglerna med `:has(.main > .workbench)`.
- [x] Kör testet och bekräfta RED.
- [x] Implementera de avgränsade CSS-reglerna och endast nödvändig markup.
- [x] Kör testet tills det blir grönt.

### Uppgift 5: Regression och visuell acceptans

**Filer:**
- Uppdatera vid behov: `6-Testing/kundadmin-kalender-testlista.md`

- [x] Kör de två fokuserade kontraktstesterna.
- [x] Kör `pnpm typecheck` från `5-Kod`.
- [x] Kör `pnpm lint` från `5-Kod` och notera endast redan kända, orelaterade varningar.
- [x] Kör `pnpm test` från `5-Kod`.
- [ ] Öppna `http://localhost:3111/admin/bokningar` i 390px och verifiera mot Mobil v2: topp, fem kolumner, kalenderhöjd, dock, sök, plus, hjälp och personalfokus.
- [ ] Verifiera interaktivt: tom tid -> ny bokning, plus -> ny bokning, sök -> träff, blockera -> sheet, bokningskort -> drawer, personnamn -> fokus -> alla, avbokade -> logg.
- [ ] Kontrollera 1024px och 1440px för att desktop/iPad inte har ändrats.
- [ ] Ta skärmbilder vid 390px och 1440px som verifieringsbevis.

## Självgranskning

- Hela Mobil v2-deltat täcks av uppgift 1–4.
- Inga nya datamodeller, migrationer, actions eller mobilrutter ingår.
- Funktioner tas inte bort; sök, hjälp och avbokningslogg byter bara placering.
- Desktop/iPad är uttryckligen avgränsade från de nya kalenderreglerna.
