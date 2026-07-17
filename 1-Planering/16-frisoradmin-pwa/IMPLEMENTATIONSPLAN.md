# Implementationsplan — Frisöradmin mobil PWA

## Beslut

- Kanon är hela `06-frisoradmin-mobil-pwa/Frisöradmin Mobil PWA.dc.html`.
- Personalens primära produktdörr är `booking.corevo.se/login` och landningen är `/personal`.
- `minbooking.corevo.se` behålls som legacy-dörr och visar samma `/personal`-kod.
- Cookies förblir host-only. Det gör att Zivar kan ha booking, minbooking och övriga
  adminytor öppna parallellt utan att sessionerna skriver över varandra.
- Ingen redirect eller fil tas bort från minbooking innan ett separat beslut.
- Paket 05 Kundportal körs inte.

## Byggordning

1. Lås host- och landningskontrakt med tester.
2. Bygg egen mörk PWA-shell utan kundadminens desktop-sidebar.
3. Mata kalendern med verkliga bokningar och personens verkliga tenant/staff-koppling.
4. Läs `can_view_all_calendars` från Goal 71:s tenantbundna behörighetsrad.
5. Bygg profil med verkligt konto, arbetspass och befintliga frånvaro-/kontolänkar.
6. Lägg acceptansspec/probe och kör hela test-, typecheck-, lint- och buildkedjan.
7. Zivar kör och godkänner testlistan för 04 och 06.
8. Driftsätt migration före webb och smoke-testa båda värdarna.

## Säkerhetsgräns

- Tenant kommer alltid från verifierad session/private.tenant_id(), aldrig query-param.
- Utan explicit `can_view_all_calendars` laddas bara egna `staff_id`.
- Legacy-värden ger ingen extra roll eller behörighet; den är bara en extra dörr till
  samma serverkontrollerade yta.
