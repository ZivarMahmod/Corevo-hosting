# Goal 69 — Kundadmin booking foundation före del 03

**Status:** verifierad live 2026-07-16  
**Plan:** `1-Planering/10-kundadmin-bokningsarbetsbord/BOOKING-FOUNDATION-PONYTAIL-PLAN.md`  
**Release:** `v1.35.0` · implementation `7241120`

## Mål

Gör kalender, adminbokning, personalens bokningsbarhet, schema, frånvaro, platser och behörighet till en sammanhängande grund innan `03-redigera-sidan-v2`.

## Låsta beslut

- Återanvänd befintliga `working_hours`, `working_hour_slots`, `time_off`, `audit_log`, `services.location_id` och tillgänglighetskärnan.
- Ingen separat mobilapp, availability-motor, eventtabell, frånvaroärendetabell eller dragdependency.
- Organisationsägare/platschef använder befintlig roll med explicit fail-closed scope.
- Telefon `<768`, surfplatta `768–1199`, desktop `≥1200`; designpaketet är lag.
- Ny personal blir publik först från bekräftade öppettider/schema.
- Publik/admin availability ska ge samma verklighet; admin kan skapa bokning för ny eller befintlig kund.
- Mobil använder explicit Omboka. Desktop får drag som genväg och samma explicita väg.
- Frånvaro stoppar nya tider, visar berörda bokningar och loggar serverägd resolution utan medicinsk fritext.
- Ingen automatisk kundkommunikation eller tyst omplacering i detta goal.

## Leveranser

1. Datadry-run och återställningsbar snapshot för gamla explicita tidsraster.
2. Migration 0076: platsöppettider, schema-proveniens, scope/membership, kund-/tjänstestaket och RLS.
3. Admin-UI för bekräftade öppettider, automatisk personal och readiness.
4. Migration 0077: location-aware befintlig availability-kärna och atomiska adminoperationer.
5. Kalenderflöden, färg, drag/Omboka och responsiv kanon.
6. Frånvaro och hanteringskö.
7. Full platsmatris och säkerhetsverifiering.
8. PWA-verifiering via Android Chrome samt dokumenterad Samsung Internet-begränsning.
9. Full lokal/produktionsverifiering.
10. Migration 0078: RPC-, skrivvägs- och frånvarohärdning.
11. Migration 0079: bestående readiness-invariant för personal.

## Klart när

- Testlistan i `6-Testing/goal-69-kundadmin-booking-foundation-testlista.md` är mekaniskt och manuellt verifierad.
- DB-, RLS-, kontrakts-, unit-, integration-, E2E-, typecheck- och buildgates är gröna.
- `v1.35.0` är deployad och produktionssmokad efter migration 0076–0079.
- Releasetaggen pekar på implementationscommitten, som ingår i `origin/main`.
- Goal ligger i rätt kategori under `2-Byggplan/klart/` efter livebevis.

## Utanför scope

Del 03, del 05 Kundportal, offline/service worker, TWA/APK, auto-SMS/mejl, automatisk omplacering och personal som samtidigt arbetar på flera platser.

## Livebevis

- Supabase: `location_schedule_access_foundation`, `atomic_location_admin_booking_flows`, `booking_foundation_ship_hardening` och `staff_readiness_invariant` registrerade i produktion.
- CI: run `29498486751` godkänd inklusive lint, typecheck, 1 269 tester, bransch-/kontrastvakter och build.
- Deploy: run `29498705127` godkänd via `deploy-prod.mjs`.
- Domänsmoke: booking, superbooking, minbooking, freshcut, florist och zentum är uppe; admin-, tenant-, staff- och superadmin-headers är korrekta.
