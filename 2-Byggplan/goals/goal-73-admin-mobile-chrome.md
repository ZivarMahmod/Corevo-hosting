# goal-73 — Kundadmin mobilchrome och kalendergester

> Startad 2026-07-19 på Zivars uttryckliga prioritering före den manuella
> onboarding-/ägaracceptansen. Designlag:
> `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/Mobil pwa/`.

## Mål

Kundadminens fyra huvudsidor ska använda ett enda begripligt mobilskal som följer
paketet mekaniskt: samma banner, ikon+etikett, stående tvånivå-dock och liggande
vänster-/högerrail. Kalenderns funktioner och dialogfält bevaras.

## Acceptans

- Stående: banner = logga, sidtitel/meta och Hjälp. Underst ligger sidans
  kontextåtgärder över den fasta navigationen `Översikt · Kalender · Kunder · Mer`.
- Alla mobila kontroller använder samma SVG-linjeikoner och minst 44×44 px verklig
  träffyta. Inga unicode-navikoner eller runda FAB-/sökknappar finns kvar.
- Liggande telefon aktiveras endast av
  `@media (orientation: landscape) and (max-height: 520px)`: nav + föregående dag
  i vänsterrail, åtgärder + nästa dag i högerrail. iPad liggande är oförändrad.
- Kalendern byter dag med horisontellt fingersvep över schemat vid 48 px tröskel.
  Månadsvyn stegas inte av misstag.
- Bokningar flyttas med långtryck direkt på kortet. Det separata trepricks-/
  grip-handtaget tas bort; bekräftelse, kollisionsskydd och serveraction bevaras.
- Bokningskort använder höjd/bredd effektivt och prioriterar starttid, sluttid,
  kund och tjänst även i smala kolumner.
- Mobilens dialoger är stora sheets i stående och högerpaneler i liggande, med
  samma befintliga fält, validering och handlingar.
- Listan över ej avslutade besök presenteras som lugn arbetsinformation, förklarar
  att den inte är ett driftfel och håller bokningslänkarna hopfällda tills de behövs.

## Utanför scope

- Ingen ändring av boknings-, status-, betalnings- eller behörighetsregler.
- Ingen ny mobilapp, UA-sniffning eller separat kodbas per orientering.
- Ingen ändring av personal-PWA:n eller iPad-/desktoplayouten utanför delade sheets.

## Verifiering

- Ny `07-admin-mobile-chrome` acceptans + probe (röd före implementation).
- Fokuserade Vitest-/Playwright-kontrakt, full `pnpm test`, typecheck, lint och build.
- Mekanisk viewport-kontroll i 393×852, 852×393 och iPad liggande.
- Oberoende verifierare granskar slutdiff och acceptansutfall.

## Status

- [ ] Implementerad
- [ ] Mekaniskt verifierad
- [ ] Zivar manuellt godkänd
- [ ] Livebevis (först därefter flytt till `klart/05-design/`)
