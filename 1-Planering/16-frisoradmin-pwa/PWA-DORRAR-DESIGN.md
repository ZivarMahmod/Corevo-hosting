# PWA-dörrar — designbeslut

Datum: 2026-07-20.

## Problem

`booking.corevo.se` länkar ett adminmanifest och kan installeras som **Corevo Admin**.
`superbooking.corevo.se` saknar manifest i plattformslayouten och blir därför bara
en webbläsargenväg. `minbooking.corevo.se/personal` länkar redan personalmanifestet.

## Låst lösning

- Behåll tre separata appidentiteter eftersom varje host är en separat webborigin:
  - `booking.corevo.se` → **Corevo Admin** → `/admin/bokningar?vy=dag`.
  - `superbooking.corevo.se` → **Corevo Platform** → `/platform`.
  - `minbooking.corevo.se` → **Corevo Personal** → `/personal`.
- Lägg ett eget statiskt platformmanifest under `/api/pwa/platform-manifest` och
  länka det endast från `(platform)/layout.tsx`.
- Återanvänd Corevos befintliga adminikoner. Ingen ny ikonfamilj eller service worker
  behövs för denna installationslucka.
- Lägg samma `appleWebApp`, Apple-touch-icon och viewport-kontrakt på plattformen som
  på övriga backoffice-appar.
- Admin- och personalmanifesten lämnas funktionellt oförändrade.
- Manifest länkas inte globalt och inte från den delade inloggningssidan. Installation
  görs inne i rätt, inloggad portal så storefronts och fel portal aldrig får appidentiteten.

## Verifiering

- Ett kontraktstest bevisar platformmanifestets namn, id, startadress, scope,
  standalone-läge och verkliga PNG-ikoner.
- Samma test bevisar att `(platform)/layout.tsx` länkar manifest och Apple-metadata.
- Befintliga admin-PWA-tester, typecheck, lint och build ska fortsätta vara gröna.
- Efter deployment ska manifestet svara med `application/manifest+json` på
  `superbooking.corevo.se`, och den autentiserade plattformssidan ska annonsera det.

## Avgränsning

Ingen offlinecache, push, installationspopup, databasändring eller gemensam global
manifestrouter byggs. De behövs inte för att stänga den verifierade luckan.
