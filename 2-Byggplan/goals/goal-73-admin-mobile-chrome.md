# goal-73 — Kundadmin mobilchrome och kalendergester

> Startad 2026-07-19 på Zivars uttryckliga prioritering före den manuella
> onboarding-/ägaracceptansen. Designlag:
> `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/Mobil pwa/`.

## Mål

Kundadminens fyra huvudsidor ska använda ett enda begripligt mobilskal som följer
paketet mekaniskt: samma banner, ikon+etikett, stående tvånivå-dock och liggande
vänster-/högerrail. Kalenderns funktioner och dialogfält bevaras. Goal-73 byggs
vidare som samma aktiva del tills Zivar har godkänt den driftsatta mobilversionen.

## Acceptans

- Stående: banner = logga, sidtitel/meta och Hjälp. Den fasta navigationen är
  `Översikt · Kalender · Sök · Kunder · Mer`. Sök är en handling, aldrig en aktiv
  flik: i Kalender öppnar den befintlig bokningssök; på övriga adminytor öppnar
  den befintlig global sök.
- Kontextåtgärdsraden renderas bara när sidan har en verklig extra åtgärd.
  Kalender visar `Ny bokning · Blockera`, Kunder visar `Ny kund` och Översikt
  har ingen extrarad. Sök dupliceras aldrig i kontextraden.
- Alla mobila kontroller använder samma SVG-linjeikoner och minst 44×44 px verklig
  träffyta. Inga unicode-navikoner eller runda FAB-/sökknappar finns kvar.
- Liggande telefon aktiveras endast av
  `@media (orientation: landscape) and (max-height: 520px)`: nav + föregående dag
  i vänsterrail, åtgärder + nästa dag i högerrail. iPad liggande är oförändrad.
- Mobilens dagvy är ett sammanhängande native scroll-snap-blad med exakt
  föregående, aktuell och nästa dag. Fingret följs kontinuerligt, så en halv
  dragning visar två halva dagar; URL och aktivt datum ändras först när bladet
  landat. Vecka och månad behåller sin befintliga navigering.
- Stående dagvy har alltid synliga föregående-/nästaknappar med måldagsetikett
  och minst 44×44 px träffyta. Liggande använder samma dagsteg i befintliga
  rails. Datumrubriken fortsätter öppna minimånaden.
- Kort tryck öppnar bokningsdrawern direkt; mellanbubblan Ring/Öppna finns inte.
  Ringfunktionen ligger kvar i drawern och tangentbordets Enter/Space öppnar som
  tidigare.
- Stationärt långtryck i 300 ms lyfter bokningen. Rörelse över 10 px före
  långtrycket avbryter dragkandidaten och låter vanlig scroll vinna. Hela kortet
  är dragyta; inget separat trepricks-, grip- eller touch-handtag finns.
- Drag snappar på 15 minuter och kan byta tid/personal inom den aktuella dagen.
  Annat datum flyttas via `Öppna → Flytta`. Originalkortet ligger kvar som
  platshållare och ghosten behåller fingrets exakta greppunkt.
- Ett giltigt släpp skapar bara den befintliga Från→Till-bekräftelsen. Ingen
  servermutation sker förrän användaren trycker `Flytta`; befintligt
  kollisions-, behörighets-, stale- och notifieringsskydd bevaras.
- Dagvyn öppnar och landar alltid vid dagens första schematid. Dagbyte får inte
  återställa ett gammalt vertikalt klockslag eller göra ett fördröjt hopp efter
  att swipe-rörelsen är färdig. Nu-linjen och tidsaxeln finns kvar.
- Ytan utanför en persons arbetspass är samma lugna pappersyta som kalendern,
  utan diagonal räffling. Fri yta får inte färgmarkeras av ett första touch-/
  swipe-försök; markering sker först när användaren har valt en faktisk åtgärd.
- Bokningskort använder höjd/bredd effektivt och prioriterar starttid, sluttid,
  kund och tjänst även i smala kolumner.
- Mobilens dialoger är stora sheets i stående och högerpaneler i liggande, med
  samma befintliga fält, validering och handlingar.
- Passerade bokningar skapar ingen klocka, kalenderkö eller varningsdialog.
  `Genomförd` och `Uteblev` finns kvar som frivilliga statusval inne i bokningen;
  bokningssystemet gissar eller tvångsmarkerar aldrig ett utfall.
- Mobilens sökfält använder tangentbordets Sök/Enter för samma sökning som
  sökknappen. När en sökyta öppnas från en knapp autofokuseras dess sökfält i
  samma tryckgest så mobilens tangentbord visas direkt. Kalenderträffarna har
  egen scroll och räknas mot `visualViewport`, så rubrik, fält och hela träffar
  inte klipps av iOS-/Android-tangentbordet.
- `Ny bokning` ärver kalenderns valda datum, även efter swipe. Drawern visar ett
  native datumfält för framtida datum och räknar om verkliga lediga tider när
  datumet ändras. Inställningssidor samt dialoger håller sig inom viewporten med
  tillräcklig bottenmarginal för den fasta dockan.
- Ingen scrollbarindikator får synas i mobilens viewport eller interna
  scrollbehållare. WebKit-spår och tumme är 0 px/transparenta och
  `scrollbar-width` är avstängt med högre prioritet än lokala `thin`-regler;
  finger-, hjul-, tangentbords- och programsrollning fungerar oförändrat.

## Utanför scope

- Ingen ändring av boknings-, status-, betalnings- eller behörighetsregler;
  ändringen gäller bara när och hur frivilliga statusval presenteras.
- Ingen ny mobilapp, UA-sniffning eller separat kodbas per orientering.
- Ingen egen fysikmotor, vibration, ny dependency, databasändring, cross-day-drag
  eller automatisk dagväxling vid dragets kant.
- Ingen ändring av personal-PWA:n eller iPad-/desktoplayouten utanför delade sheets.

## Godkända tillägg 2026-07-20

Zivar lade uttryckligen till den befintliga adminens personal-/schemaytor i samma
liveacceptans. Ingen parallell personalmodell eller migration införs:

- `/admin/personal/[id]` är den enda individuella redigeringsytan för
  bokningsbarhet, tjänster med kanonisk längd, arbetspass, bokbara starttider och
  personens frånvaro. Identitet, konto och farozon ligger efter driftsektionerna.
- `/admin/scheman` äger platsens öppettider och teamets veckoöversikt. En
  personalrad leder till rätt personkort; platsbyte rensar ett gammalt personalval.
- En ägare kan säkert koppla sitt befintliga konto till en ledig personalrad via
  `staff.profile_id`. Självservice-länkar visas bara när en aktiv personalkoppling
  verkligen finns.
- Varje bokningsflytt kräver ett uttryckligt Ja/Nej till kundmeddelande. Nej skrivs
  som ett auditerbart `actor_opted_out` i befintlig notifieringsoutbox.
- Personkortets schemalås tar ingen tenantglobal återställningskopia. Återställning
  återinförs först när backupkontraktet kan vara personal-scopat.

## Verifiering

- `07-admin-mobile-chrome` acceptans + probe låser tredagarsblad, direktöppning,
  helt kort som dragyta och den kanoniska 520 px-landskapströskeln.
- Vitest låser dagstripletter över månads-/års-/skottårsskifte,
  Europe/Stockholms 23-/25-timmarsdygn, månadsklampning, 300 ms/10 px-intent,
  bevarad greppunkt och autoscrollens nollzon/riktning/maxhastighet.
- Fokuserade testkörningar följs av full `pnpm test`, typecheck, lint och build.
- Mekanisk viewport-kontroll omfattar 393×852, 852×393, Android 360 px,
  höjderna 500/501/520 px och iPad liggande.
- Källkontrakt låser den femdelade navigationen, sökens ruttberoende befintliga
  event och att Översikt saknar kontextrad. Ett globalt CSS-kontrakt låser både
  dold scrollbar-tumme/spår och bevarad scrollfunktion.
- Källkontrakt låser native autofocus i båda sökytorna samt att kalenderdatumet
  följer med till `Ny bokning`, kan bytas och styr samma befintliga slotladdning.
- Oberoende GPT-5.6-sol och lokal Claude/Fable 5 granskar slutdiffen innan push.
- Goal-filen kan markeras implementerad och mekaniskt verifierad efter bevisen,
  men flyttas inte till `klart/05-design/` förrän Zivar godkänt liveversionen.

### Mekaniskt bevis 2026-07-19

- `07-admin-mobile-chrome/probe.js --contract`: 5/5 PASS.
- Full Vitest: 261 testfiler och 2 128 tester PASS efter mobilpolishen.
- `pnpm typecheck`, `pnpm lint` och `pnpm build`: PASS. Lint har sju redan
  befintliga varningar utanför kalenderändringen och inga fel.
- Lokal Claude/Fable 5:s slutgranskning fann inga kritiska eller höga fel. Dess
  medelfynd var de uttryckligen beställda beteendena: schemastart, dagens egen
  tidsaxel och ingen touchmarkering innan en riktig åtgärd valts.
- Oberoende GPT-5.6-sol fann en dubbel sökfråga när tangentbordets Sök hann före
  debouncen. Väntande debounce avbryts nu; riktat test och hela verifieringen
  kördes om grönt. Inga andra konkreta regressioner rapporterades.
- Fysisk iPhone-/Samsung-acceptans och staging-/livebevis återstår och kan inte
  ersättas av de mekaniska kontrollerna.

### Mekaniskt tilläggsbevis 2026-07-20 — bottennav och scrollbar

- TDD-kontrakten föll först på den gamla dubbla sökraden/fyrkolumnsnaven och den
  överstyrbara scrollbarregeln. Efter implementation: 19/19 riktade mobiltest PASS.
- Full Vitest efter slutgranskning: 262 testfiler och 2 131 tester PASS.
- `pnpm typecheck`, `pnpm lint` och `pnpm build`: PASS. Lint har fortsatt sju
  befintliga varningar i orörda storefrontfiler och inga fel.
- Lokal Claude/Fable 5 verifierade sökrutt, kontextrader och bevarad scroll och
  gav PASS. Dess medelfynd om klippt vänsterrail på låg liggande telefon
  åtgärdades med finger-scrollbar rail utan synlig indikator och låstes i test.
- Två separata read-only-försök med GPT-5.6-sol nådde vardera sin
  treminutersgräns utan svar eller fynd. Verktygsfelet blockerar därför inte den
  gröna Fable-, test-, typ-, lint-, build- och kommande CI-grinden.
- Den fasta mobilnaven är nu `Översikt · Kalender · Sök · Kunder · Mer`.
  Kalender-Sök använder befintligt kalenderevent; övriga adminytor använder
  befintlig global sök. Ingen separat sökrad ligger längre ovanför navet.
- Zivars fysiska Samsung-/iPhone-test återstår.

### Mekaniskt tilläggsbevis 2026-07-20 — sökfokus och bokningsdatum

- TDD började med två röda regressioner: modalens generella mount-fokus stal
  fokus från det autofokuserade sökfältet, och datumfältet accepterade tomt/
  passerat värde. Båda är rättade och låsta i test.
- Mobil Kalender-Sök samt den delade kommandosökningen använder native
  autofocus under öppningstrycket. Modalens fokusfälla bevarar fokus om ett
  element redan är fokuserat inne i dialogen.
- `Ny bokning` ärver kalenderns publicerade URL-datum. Ett native datumfält kan
  därefter välja ett framtida datum och samma befintliga slotladdning räknar om
  lediga tider utan ny server- eller behörighetsväg.
- Riktad regression: 4 testfiler och 29 tester PASS. Full Vitest: 262 testfiler
  och 2 134 tester PASS.
- `pnpm typecheck`, samtliga fyra kontraktsprober och `pnpm build`: PASS.
  `pnpm lint`: 0 fel och sju befintliga varningar i orörda filer.
- Lokal Claude/Fable 5 fann fokusstölden och otillräcklig datumguard i första
  granskningen; båda fynden åtgärdades innan full verifiering kördes om. Den
  smala slutgranskningen verifierade fokusfällan, datumklampen och slot-raceskyddet
  och gav PASS utan blockerande, höga eller medelhöga fynd.
- GPT-5.6-sol:s read-only-slutgranskning nådde åter sin treminutersgräns utan
  svar eller fynd; verktygsfelet blockerar inte den gröna Fable-, test-, typ-,
  lint-, build- och kommande CI-grinden.
- Zivars fysiska tangentbords- och framtidsbokningstest återstår på live.

### Mekaniskt tilläggsbevis 2026-07-20 — tangentbord och personkort

- Kalender-Sök använder modal-lokala `visualViewport`-variabler och en statisk,
  självscrollande träfflista. Modaltest verifierar resize + offset och bevarat
  inputfokus; källkontrakt verifierar att ingen absolut dropdown återkommer.
- Personkortet återanvänder `StaffBookability`, `WorkingHoursEditor`,
  `SlotManager`, `ScheduleLock` och `TimeOffManager`; Scheman renderar bara
  `LocationOpeningHours` + `ScheduleWeekBoard`.
- Riktade kalender-sök-/personal-/behörighets-/plats-/frånvarotester:
  66/66 PASS.
- Web TypeScript, lint och produktionsbuild: PASS. Lint har sju befintliga
  varningar utanför ändringen och inga fel.
- Full Vitest hade 2 146 PASS. Två fel kommer från Zivars bevarade, ocommittade
  onboardingarbete; ett SidaStudio-importtest nådde 5 s-gränsen under parallell
  fullkörning men passerade isolerat 20/20 på 2,14 s.
- Oberoende GPT-5.6-sol hittade platsbytes-404, tenantglobal schemabackup och
  hårdkodat branschord. Slutgranskningen hittade även att en platschef kunde
  förlora sin individuella schemaredigering. Samtliga rättades test-först med
  separata grindar för schema, personaldrift och ägaradministration. Lokal
  Claude/Fable och Claude/Sonnet verifierade sök-/personflödet och den
  staff-scopade frånvaron.

## Status

- [x] Implementerad
- [x] Mekaniskt verifierad
- [ ] Zivar manuellt godkänd
- [ ] Livebevis (först därefter flytt till `klart/05-design/`)
