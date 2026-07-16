# Testlista — Goal 69 kundadmin booking foundation

## Databas och migration

- [x] Dry-run klassar fullständigt genererade `working_hour_slots`, bevarar oregelbundna specialstarter och lämnar tvetydiga dagar orörda.
- [x] Snapshot kan återställa konverterade rader.
- [x] 0076–0079 kan köras idempotent på det befintliga schemat utan dataförlust.
- [x] 0078 stänger breda läs-/skrivvägar och 0079 bevarar personal-readiness efter onboarding och senare resursändringar.

## Tillgänglighet och personal

- [x] Storefront och admin ger samma giltiga tider från öppettid ∩ arbetstid − closure − time_off − bokning − buffert.
- [x] Admin begränsas inte av publika specialstarter; storefront respekterar dem.
- [x] Ny personal på bekräftad plats är bokningsbar med rätt tjänster utan manuella tidsrutor.
- [x] Ny personal på obekräftad plats förblir ej publik och readiness visar exakt åtgärd.
- [x] Tjänst från annan plats kan inte kopplas eller bokas via UI, RPC eller direkt tabellväg.

## Ny bokning och flytt

- [x] Plusknapp och tom kalendercell öppnar samma flöde; cell förifyller person/datum/tid.
- [x] Befintlig kund kan väljas och ny kund skapas atomiskt med första bokningen.
- [x] Konflikt, stängning, time_off, arbetstid, längd och buffert stoppar ogiltig bokning.
- [x] Desktopdrag visar giltigt/ogiltigt mål, kräver bekräftelse och lämnar originalet orört vid stale/conflict.
- [x] Explicit Omboka fungerar på telefon, desktop och tangentbord via samma DB-funktion.
- [x] Flytt till annan plats nekas.

## Frånvaro

- [x] Rast, ledighet, sjukfrånvaro och annan blockering är strukturerade typer.
- [x] Publik väg får aldrig frånvaroorsak eller intern metadata.
- [x] Frånvaro stoppar nya tider och visar redan överlappande aktiva bokningar.
- [x] Kontakta, Omboka, Avboka och Markera hanterad uppdaterar kön och ger serverägd audit med `time_off_id` + `booking_id`.
- [x] Ingen automatisk omplacering eller kundnotis sker.

## Plats och behörighet

- [x] Organisationsägare med `access_scope=organization` kan byta mellan tillåtna platser.
- [x] Platsadmin med `access_scope=locations` ser endast medlemsplatser.
- [x] Platsadmin utan medlemskap nekas allt; blir aldrig ägare.
- [x] Kors-tenant medlemsrad, self-grant och ogiltig primär plats nekas.
- [x] Platsadmin kan inte nå ägarskap, betalning eller konto/säkerhet via UI, URL, tabell eller RPC.
- [x] Platsadmin ser bara kunder med bokning på tillåten plats och endast platsfencade anteckningar.
- [x] Aktuell plats läses från DB vid känslig operation; borttagen access slår igenom utan ny JWT.

## Responsiv UI och tillgänglighet

- [x] 390/767 px använder mobilkanon; 768/1024/1199 px surfplatteläge; 1200/1440 px desktop.
- [x] Alla personalkolumner är nåbara utan att tidsskala eller aktiv plats försvinner.
- [x] Dialog/bottom sheet har fokusfälla, Escape, fokusåtergång och statusannonsering.
- [x] Alla kontroller har synlig fokus, skärmläsarnamn och minst 44×44 px touchyta.
- [x] Personal identifieras med namn/status, inte enbart färg; sparad färg visas konsekvent och fallback märks Automatisk.
- [x] 200 % zoom och reduced motion fungerar; pinch byter inte layoutläge.

## PWA och release

- [x] Manifest, HTTPS, start_url, scope, id och ikoner är giltiga.
- [x] Android Chrome på riktig enhet: installera, starta, logga in, öppna dagens kalender.
- [x] Samsung Internet-genererad WebAPK dokumenteras separat; ingen Corevo-APK utlovas.
- [x] Unit, DB/RLS, lint, typecheck, build och relevanta E2E går grönt.
- [x] `v1.35.0` produktionssmoke passerar efter att migration 0076–0079 och samtliga lokala gates är gröna.
