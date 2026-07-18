# ROADMAP — Corevo

Detta är projektets enda aktuella byggordning. Git-historiken bär äldre planer och
avslutade goals; skapa inte nya parallella roadmap-filer.

## Stabil grund

- Multi-tenant och multi-bransch med modulstyrning per tenant.
- Publik storefront, bokning, kundadmin, personalyta och plattformsadmin.
- Boknings-/schemagrund live genom migration 0079.
- Redigera sidan v2 med revisioner/utkast genom migration 0080.
- Ägaradmin mobil-PWA samt kalender Mobil v2.

## Byggordning

1. **Goal-71 acceptansstängning** — 04 Inställningar v2 och 06 Personaladmin
   mobil-PWA är driftsatta. Ingen ny koddel återstår, men Zivars autentiserade
   manuella acceptans krävs före flytt till `klart/`. `minbooking.corevo.se`
   behålls tills Zivar uttryckligen stänger dörren.
2. **Goal-72 Superadmin v2** — aktiv koddel. Kör S1–S6 i
   `2-Byggplan/goals/goal-72-sessionsplan.md`; därefter S7 partnerrollen när dess
   tre öppna produktbeslut är låsta.
3. **Senaste admin-chrome-paketet** — `Dagens genomgångar/Mobil pwa/` är inkommet
   underlag men saknar goal-73. Det blir en egen byggdel efter goal-72, inte ett
   parallellt svep.
4. **05 Kundportal** — överhoppad i denna byggomgång; paketet ligger kvar orört.
5. **Lanseringsgrindar** — betalning, juridik, secrets, domänsmoke och driftbevis.

Designpaketen ligger i `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/`.
Numrerade paket byggs i ordning; verifierat och deployat paket flyttas till `klar/`.

## Regler för varje del

- Läs hela designpaketet och relevanta kodmönster först.
- Skapa högst ett aktivt goal i `2-Byggplan/goals/`.
- Skriv regression/acceptans före beteendeändring när en testbar seam finns.
- Verifiera fokuserade tester, full testsvit, typecheck, lint och build.
- Behåll Corevo generellt: modul- och branschord ska komma från tenantens konfiguration.
- Flytta goal till `2-Byggplan/klart/` först efter verkligt livebevis.

## Nästa startpunkt

`2-Byggplan/goals/goal-72-sessionsplan.md` — S1.
