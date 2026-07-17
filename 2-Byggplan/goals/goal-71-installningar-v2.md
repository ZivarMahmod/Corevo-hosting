# Goal 71 — Inställningar v2 + Frisöradmin PWA

**Skapad:** 2026-07-17
**Status:** pågår
**Kanon:** designpaket `04-installningar-v2/` och `06-frisoradmin-mobil-pwa/`
**Plan:** `1-Planering/15-installningar-v2/IMPLEMENTATIONSPLAN.md` + `1-Planering/16-frisoradmin-pwa/IMPLEMENTATIONSPLAN.md`

## Mål

Bygg designpaketets inställningsnav som exakt, tenantbunden samlingsyta över de
befintliga adminfunktionerna. Sök, varningsstatus, bokningslägen och roller ska visa
verklig data. Ingen kategori får bli en död kopia av data som redan ägs av en annan yta.
Koppla därefter behörigheten till den separata mobil-PWA:n för personal. Personalens
primära dörr blir `booking.corevo.se`, men `minbooking.corevo.se` ska fortsätta
fungera parallellt tills Zivar uttryckligen beslutar att ta bort den.

## Hårda acceptanskrav

- Paketets HTML och NOTES är visuell och funktionell lag.
- Desktop: 308 px kategorinav och högst 760 px innehållsyta med paketets exakta tokens.
- Mobil: kategorilista först, vald kategori som egen vy med tillbaka-kontroll.
- Sökindexet innehåller paketets synonymer och länkar till den verkliga ägande ytan.
- Statusprickar visas endast för verkliga varningar; chips får inte överdriva systemstatus.
- Bokningsläget På/Pausad/Av läser och skriver den befintliga modul-livscykeln.
- Befintliga sidor och funktioner bevaras; dubbelboende data får korshänvisning.
- Roller och individuella tillägg är tenantbundna, personliga och serverkontrollerade.
- Ägare behåller full åtkomst. Personal får aldrig behörighet genom dold UI-logik ensam.
- Mekaniskt `0 FAIL` i `04-installningar-v2.accept.spec.ts` och `probe.js`.
- Test, typecheck, lint, build, oberoende review och prod-smoke är gröna.
- Frisöradmin följer paket 06 mekaniskt: kalender, bokningssheet, profil och bottennav.
- Staff landar på `/personal` efter inloggning på booking-värden.
- Booking och minbooking serverar båda `/personal`; värdcookies delas inte, så flera
  inloggade flikar kan vara öppna samtidigt.
- Kundportalpaket 05 byggs inte och dess underlag lämnas orört.

## Säkerhet och data

- Ny behörighetsdata använder `tenant_id`, `staff_id` och `profile_id`-kopplingen som redan finns.
- RLS använder `private.tenant_id()` och kontrollerar aktivt personalkonto fail-closed.
- Owner-write och own-read får explicita grants; ingen `anon`-åtkomst.
- Muterande server actions gör samma namngivna områdeskontroll som sid-DAL:en.
- Ingen parallell personmodell, inga delade inloggningar och inga secrets i Git.

## Klar-definition

Goal är klar först efter verifiering och driftsättning. Då flyttas dokumentet till
`2-Byggplan/klart/02-ytor/salong-admin/` och designpaketet till
`4-Dokument-Underlag/01-acceptans/Dagens genomgångar/klar/04-installningar-v2/`.
