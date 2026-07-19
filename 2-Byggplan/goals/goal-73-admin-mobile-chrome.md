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

- Stående: banner = logga, sidtitel/meta och Hjälp. Underst ligger sidans
  kontextåtgärder över den fasta navigationen `Översikt · Kalender · Kunder · Mer`.
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
- Bokningskort använder höjd/bredd effektivt och prioriterar starttid, sluttid,
  kund och tjänst även i smala kolumner.
- Mobilens dialoger är stora sheets i stående och högerpaneler i liggande, med
  samma befintliga fält, validering och handlingar.
- Listan över ej avslutade besök presenteras som lugn arbetsinformation, förklarar
  att den inte är ett driftfel och håller bokningslänkarna hopfällda tills de behövs.

## Utanför scope

- Ingen ändring av boknings-, status-, betalnings- eller behörighetsregler.
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
- Oberoende GPT-5.6-sol och lokal Claude/Fable 5 granskar slutdiffen innan push.
- Goal-filen kan markeras implementerad och mekaniskt verifierad efter bevisen,
  men flyttas inte till `klart/05-design/` förrän Zivar godkänt liveversionen.

### Mekaniskt bevis 2026-07-19

- `07-admin-mobile-chrome/probe.js --contract`: 5/5 PASS.
- Full Vitest: 261 testfiler och 2 124 tester PASS.
- `pnpm typecheck`, `pnpm lint` och `pnpm build`: PASS. Lint har sju redan
  befintliga varningar utanför kalenderändringen och inga fel.
- Lokal Claude/Fable 5:s mobilgranskning genomfördes; dess höga och relevanta
  medelhöga fynd åtgärdades.
- Oberoende GPT-5.6-sol omgranskade slutdiffen efter flerfingerfixen: inga
  kvarvarande kritiska, höga eller medelhöga fynd.
- Fysisk iPhone-/Samsung-acceptans och staging-/livebevis återstår och kan inte
  ersättas av de mekaniska kontrollerna.

## Status

- [x] Implementerad
- [x] Mekaniskt verifierad
- [ ] Zivar manuellt godkänd
- [ ] Livebevis (först därefter flytt till `klart/05-design/`)
