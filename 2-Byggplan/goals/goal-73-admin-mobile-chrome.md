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
  sökknappen, och inställningssidor samt dialoger håller sig inom viewporten med
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

## Status

- [x] Implementerad
- [x] Mekaniskt verifierad
- [ ] Zivar manuellt godkänd
- [ ] Livebevis (först därefter flytt till `klart/05-design/`)
