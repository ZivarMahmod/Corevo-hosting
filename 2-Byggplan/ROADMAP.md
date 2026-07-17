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

1. **04 Inställningar v2** — nästa aktiva byggdel.
2. **05 Kundportal** — egen desktop-/mobilyta med funktionsparitet.
3. **06 Personaladmin mobil-PWA** — separat personalspår; aldrig grund för hela produkten.
4. **Lanseringsgrindar** — betalning, juridik, secrets, domänsmoke och driftbevis.

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

`4-Dokument-Underlag/01-acceptans/Dagens genomgångar/04-installningar-v2/`
