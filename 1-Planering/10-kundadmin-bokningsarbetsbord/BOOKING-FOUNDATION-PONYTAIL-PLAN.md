# Corevo — reviderad plan före kod, Ponytail-pass

## Mål

Färdigställ kalender-, personal-, schema-, frånvaro-, plats- och behörighetsgrunden innan `03-redigera-sidan-02`, utan att bygga parallella modeller till sådant som redan fungerar.

## Bekräftat nuläge

- Mobil har redan ett fungerande explicit flöde: bokning → öppna → omboka → välj personal/datum/tid → bekräfta.
- Desktopens native HTML5-drag fungerar inte tillförlitligt.
- `staff.color` finns och valideras; FreshCuts färger är fortfarande `NULL`. Kalendern använder deterministisk fallback, medan vissa andra ytor fortfarande använder hårdkodad grön färg.
- `create_staff_with_defaults` skapar redan aktiv personal, kopplar aktiva tjänster och skapar vardagsschema 09–17 atomiskt.
- Publik bokning räknar redan fram tider dynamiskt från `working_hours`, valfria `working_hour_slots`, tjänstelängd, buffert, bokningar och `time_off`.
- `time_off` används redan för rast, frånvaro och blockering.
- `audit_log` är redan append-only.
- Multi-location finns delvis: `locations`, `location_id`, platsväljare och platsfencad bokning finns. Platsväljaren är dock ett filter, inte en full behörighetsgräns.
- Android-varningen kommer från Samsung Internet-genererad WebAPK/Play Protect. Corevo har ingen APK/TWA. Manifest, HTTPS och ikoner är inte grundorsaken.

## Ponytail-beslut

Bygg inte:

- ingen ny `bookable_online`-kolumn; bokningsbarhet härleds från befintliga sanningar,
- ingen `booking_events`; använd befintlig `audit_log`,
- ingen `absence_cases`; använd `time_off` plus berörd-bokningsfråga,
- ingen `service_locations`; använd befintlig `services.location_id` där `NULL` betyder organisationsgemensam,
- ingen ny global roll; använd befintliga roller plus ett explicit organisations-/platsscope och platsmedlemskap,
- inget dragbibliotek, ingen service worker och ingen Android-wrapper,
- ingen optimistisk kalenderflytt som kräver rollback; bekräfta först, skriv sedan atomiskt.

## Domänregler

### Tillgänglighet

En tid är bokningsbar när:

`platsens öppettider ∩ personalens arbetstid − platsstängning − time_off − bokningar − buffert`.

- Starttider räknas dynamiskt.
- `working_hour_slots` behålls endast för verkliga undantag med explicit startlista.
- Normal UI visar därför inte hundratals lagrade rutor eller "0 tider". Den visar grundschema och eventuella specialstarter.
- Bokningsintervall: tjänstvärde → personalvärde → platsens standard → 15 minuter.
- Befintlig `buffer_min` fortsätter betyda buffert efter bokning. Ingen ny före-buffert införs utan verkligt behov.
- Minsta framförhållning och bokningshorisont ligger på platsen.

### Personal

Personal är bokningsbar när personen är aktiv, tillhör vald plats, har minst en aktiv tjänst för platsen och har arbetstid där. UI visar exakt vilket villkor som saknas.

Ny personal skapas atomiskt med vald plats, tjänster för platsen och platsens bekräftade öppettider som första arbetsschema. Då kan personen publiceras bokningsbar direkt. Om platsens öppettider bara är importerade eller saknas skapas ett utkast med vardagar 09–17, men personen förblir ej publik bokningsbar tills ägaren bekräftat platsens öppettider och personens schema. Readiness visar den enda blockerande åtgärden.

`staff.color` är gemensam inom organisationen så samma person alltid har samma färg. Sparad färg vinner; fallback märks med texten "Automatisk" och inte enbart med färg.

### Öppettider, schema och avvikelser

- Platsens öppettider: när verksamheten kan ta bokningar.
- Personalens `working_hours`: när personen arbetar.
- `time_off`: rast, ledighet, sjukdom och annan personalblockering.
- `location_closures`: hela platsens tillfälliga stängning.
- Tjänstens längd och befintliga buffert styr passets reserverade intervall.

### Frånvaro

Snabbflöde från kalender/personal:

1. Välj person, period och anledning.
2. Förhandsvisa överlappande aktiva bokningar.
3. Bekräfta `time_off`; nya bokningar stoppas direkt.
4. Visa en arbetskö med tom-, laddnings-, fel- och delvis hanterat läge. Per bokning finns Kontakta, Omboka, Avboka och Markera hanterad.
5. En aktiv överlappande bokning är öppen tills den flyttats/avbokats eller ett senare `absence.booking_handled`-event finns för samma `time_off_id` och `booking_id`.
6. `time_off.kind` skiljer rast, ledighet, sjukfrånvaro och annan blockering. Orsak är en begränsad kategori; medicinska fritextdetaljer samlas inte in.
7. Ingen tyst automatisk omplacering och inga automatiska SMS/mejl i detta steg. Visa befintliga kontaktvägar och logga vad administratören gjorde.

Auditkontraktet är serverägt: DB:n härleder tenant, aktör och tid. Klienten får endast skicka validerad `resolution` och en kort längdbegränsad anteckning. Direkt bred läsning av `audit_log` öppnas inte; UI använder en minimal platsfencad projektion. Om frånvaron ändras räknas kön om. Borttagning tillåts först efter bekräftelse och loggas, men gamla auditrader behåller spårbarheten.

### Bokningsflytt

- Desktop: pointer-baserad dragpreview med tydlig giltig/ogiltig målcell; släpp utanför mål avbryter och släpp på mål öppnar bekräftelse.
- Mobil: explicit Omboka-flöde; ingen touch-drag som huvudväg.
- Samma explicita Omboka-åtgärd finns också på desktop och fungerar med tangentbord; drag är en genväg, aldrig enda vägen.
- Bekräftelsen visar gammal/ny personal, datum och tid. Sparning låser kontrollerna; stale/conflict behåller bokningen på ursprungsplatsen och förklarar varför; success flyttar fokus till den uppdaterade bokningen.
- Samma serveråtgärd används av alla vägar.
- En atomisk DB-funktion låser bokningen, kontrollerar aktuell status och förväntad gammal start/personal, rätt plats, tjänst, arbetstid, öppettid, frånvaro, stängning, buffert och kollision innan uppdatering.
- Flytt mellan platser blockeras.
- Gammalt och nytt läge, aktör, tidpunkt, anledning och kundkontaktstatus skrivs till `audit_log`.
- `move_admin_booking` får endast köras av explicit organisationsägare eller platsbegränsad admin inom bokningens plats. Vanlig personal får ingen adminflytt i detta arbetssteg.

### Ny adminbokning

Plusknapp eller tom kalendercell öppnar samma flöde: välj befintlig kund eller skapa ny, välj platsbunden tjänst, personal, datum och en tid från den gemensamma tillgänglighetsmotorn, granska och spara atomiskt. Kalendercell förifyller personal/datum/tid. Flödet har tydliga tom-, laddnings-, validerings-, konflikt-, fel- och successlägen; Avbryt återgår utan skrivning och success öppnar den skapade bokningen i kalendern.

### Plats och behörighet

- Organisationsägare: befintlig `salon_admin` med explicit `access_scope='organization'`.
- Platschef: samma befintliga roll med `access_scope='locations'` och rader i `user_location_access`; får endast se dessa platser. Noll medlemskap betyder noll åtkomst, aldrig uppgradering till ägare.
- Personal: befintlig personalroll och nuvarande egenvy.
- `users.primary_location_id` lagrar varje ägares/chefs standardplats.
- En serverhelper validerar begärd `plats` mot aktuella DB-rader, inte enbart JWT. Fallback är giltig begärd plats → giltig primär plats → neka. Aldrig "Alla" och aldrig behörighetsuppgradering.
- "Alla platser" används endast för ägarens säkra aggregat. Kalender, schema och mutationer kräver exakt en plats.
- RLS och SECURITY DEFINER-funktioner använder samma platsåtkomst; frontend är inte säkerhetsgränsen.
- Platsväljaren ligger permanent i toppbannern på surfplatta/desktop och i den beslutade mobilstrukturen på telefon. Aktiv plats visas alltid. Sidor som kräver en plats går automatiskt till primär giltig plats; byte med osparade ändringar kräver bekräftelse.
- Organisationsägare ensam får hantera betalning, konto/säkerhet, ägarskap och platsmedlemskap. Alla befintliga `role_level() >= 6`, `require_tenant_owner()` och ägar-RPC:er inventeras så platschef inte ärver dessa rättigheter.
- Kundidentitet är organisationsgemensam för att undvika dubbletter. Platschef ser bara kunder som har minst en bokning på tillåten plats; ny kund skapas atomiskt med första bokningen. `customer_notes` blir platsfencad. Organisationsägare ser hela kundhistoriken.
- Tjänst med `services.location_id=NULL` är organisationsgemensam; annars hör den till exakt en plats. Koppling, katalog, readiness och alla boknings-RPC:er verkställer samma regel i databasen.

### Responsiv matris

- Telefon `≤767px`: mobilkanon med handvänliga bottenåtgärder och explicit Omboka.
- Surfplatta `768–1199px`: toppnavigation, kompakta kontroller och horisontellt hanterbar kalender; ingen kopia av telefonens bottenlayout.
- Desktop `≥1200px`: full toppnavigation och pointer-drag plus explicit Omboka.
- Fem personalkolumner behåller namn/färg/arbetsstatus; vid otillräcklig bredd scrollas kalenderområdet horisontellt utan att tidsskalan eller aktiv plats försvinner.

## Minsta databasförändring

### Före migration — datadry-run

- Snapshot av `working_hour_slots` för återställning.
- Jämför varje personal/veckodag med dynamiskt raster från `working_hours` och upplöst intervall.
- Exakta fullraster klassas som gammalt genererat data och kan konverteras; oregelbundna listor bevaras som specialstarter. Tvetydiga dagar rapporteras, inte gissas.
- Rapportera befintliga personal–tjänst-kopplingar som korsar platsgränsen.

### Migration 0076 — plats- och schemagrund, additiv

- `location_opening_hours(location_id, weekday, start_time, end_time, source, confirmed_at, confirmed_by)` med unikhet/överlappsskydd. Nattpass representeras som två dagssegment.
- `location_closures(location_id, start_ts, end_ts, reason)`.
- På `locations`: `slot_step_min`, `min_notice_min`, `max_advance_days`.
- På `users`: `primary_location_id`, `access_scope` (`organization|locations`).
- `user_location_access(tenant_id, user_id, location_id)` med samma-tenant-invariant, unikhet, förbud mot self-grant och skrivning endast för organisationsägare.
- Smal `set_my_primary_location(uuid)`; direkt update av kolumnen förblir återkallad.
- `time_off.kind` och platsfencad `customer_notes.location_id`.
- Backfill platsöppettider från befintlig union av personalens arbetstider; tomma platser får vardagar 09–17 och markeras i UI för bekräftelse.
- Uppdatera `create_staff_with_defaults` att ärva vald plats och bara koppla aktiva tjänster där `services.location_id` är vald plats eller `NULL`.
- Lägg privata helpers för explicit ägarscope/platsåtkomst, platsfencad kundsynlighet, tjänstekoppling och nödvändiga index/RLS.
- Inventera och dela befintliga ägarvakter så organisationsägare och platsadmin inte blandas.

### Migration 0077 — bokningsoperationer, additiv

- Utöka befintlig privata tillgänglighetskärna med platsöppettider, stängningar och platsregler; skapa ingen parallell motor.
- Location-aware publik availability med hårda gränser för aktiv tenant/plats/resurser, datumspann och antal personal-ID:n; returnera endast bokningsbara tider, aldrig frånvaroorsak eller intern metadata.
- Ersätt den gamla anon-signaturen omedelbart med en bakåtkompatibel, platsvaliderande och intervallbegränsad wrapper under övergången.
- Atomiska `create_admin_booking`, `move_admin_booking`, frånvaro/hanteringsåtgärder och serverägd audit.
- Uppdatera alla publika/adminbokningsvägar och staff-service-staket med samma plats- och tillgänglighetsregler.

### Migration 0078 — leveranshärdning

- Begränsa busy-/availability-RPC:er med tenant-, plats-, datum- och storleksstaket.
- Lås öppettider, kundens auth-bindning och time-off till smala serverägda skrivvägar.
- Gör frånvarokön komplett och ombokning + resolution atomisk.
- Verkställ readiness vid aktivering och synka kopplade personalkonton.

### Migration 0079 — bestående readiness-invariant

- Skapa ny personal som inaktivt utkast, lägg till tjänster och arbetstider och aktivera först när slutläget är giltigt.
- Kontrollera även slutläget efter ändring av tjänstekopplingar, arbetstider och tjänsters aktiva/platsbundna status.
- Tillåt fortfarande legitima transaktioner som ersätter resurser genom uppskjutna slutlägeskontroller.

## Implementationsordning

1. Skapa `codex/kundadmin-booking-foundation`, skriv goal/plan/testlista på projektets rätta platser och kör datadry-run. Kontrollpunkt: nulägesrapport och återställningsbar snapshot.
2. Migration 0076 och DB/RLS-tester: öppettider, provenance, closures, scope, kund-/tjänstestaket och säker primär plats. Kontrollpunkt: restricted utan medlemskap nekar allt.
3. Adminmodellen: platsens öppettider/regler, bekräftad automatisk ny personal, readiness och förenklad schema-UI. Kontrollpunkt: ny personal blir bokningsbar utan manuella rutor men aldrig från obekräftat defaultschema.
4. Migration 0077 och kontrakttester: samma tillgänglighetskärna, skyddad publik wrapper, atomisk ny bokning/flytt/frånvaro och audit. Kontrollpunkt: storefront/admin-paritet och gamla klientanrop är säkert fencade.
5. Kalender: exakt kanon för telefon, separat surfplatta/desktop-layout, komplett Ny bokning, sparad personalfärg, desktop pointer-drag och explicit Omboka. Kontrollpunkt: verkliga create/move-flöden, konflikt- och felstatus.
6. Frånvaro: snabbflöde, konfliktpreview och hanteringskö via `time_off` + minimal auditprojektion. Kontrollpunkt: blockerad availability, integritet och spårbar resolution.
7. Platskontext: ägare/platschef, aktiv plats, kund-/tjänstematriser och full RLS/RPC-verifiering. Kontrollpunkt: försök via UI, URL, direkt tabell och RPC mot annan plats nekas.
8. PWA: verifiera manifest/HTTPS och installera från Android Chrome på riktig enhet; starta installerad app, logga in och öppna kalendern. Dokumentera separat att Samsung Internet-genererad WebAPK kan ge Play Protect-varning och inte är Corevos APK.
9. Full verifiering: unit, DB, RLS, lint, typecheck, build, readonly E2E, a11y och riktiga telefon/surfplatta/desktopflöden. Uppdatera mot `origin/main`, slutgranska och integrera verifierad branch till `main` före tagg.
10. Kör 0078–0079 efter lokala runtimebevis, pusha `main`, tagga/deploya `v1.35.0`, verifiera att tagg och `origin/main` pekar på samma commit och kör produktionssmoke. Stäng brancher först efter verifiering.

Wavy-länkcommitten integreras endast om diffen är unik och relevant. Endast verifierade ancestor-grenar stängs; avvikande gammal projektgranskningsgren bevaras.

## Acceptans

- Telefon, surfplatta och desktop följer kanonens separata layoutregler; telefonens handvänliga bottenstruktur flyttas inte automatiskt till iPad/desktop.
- Inloggad admin kan skapa bokning för befintlig eller ny kund och ser den direkt i kalendern.
- Desktop drag, tangentbordsåtkomlig Omboka och mobil Omboka använder samma säkra skrivväg; ogiltiga/stale mål lämnar originalet orört.
- Sparad personalfärg visas konsekvent.
- Ny personal får bokningsbara tider utan manuellt genererade rutor när öppettider/schema är bekräftade; readiness visar exakt blockerande lucka.
- Storefront och admin beräknar samma tillgänglighet.
- Frånvaro blockerar nya tider, skyddar känsliga skäl och ger en spårbar hanteringskö för redan berörda bokningar.
- Platsöppettider och personaltider är separata och båda verkställs.
- Ägare kan byta plats; platschef utan medlemskap nekas och kan inte läsa/mutera annan plats via UI, URL, RPC eller direkt tabellanrop.
- Organisationsägarskap, betalning och konto/säkerhet kan inte nås av platschef trots samma grundroll.
- Platsspecifika tjänster, kundsynlighet och kundanteckningar följer den dokumenterade platsmatrisen.
- PWA installeras och körs via Android Chrome på riktig enhet; Samsung Internet-begränsningen dokumenteras utan falskt löfte.
- Dialoger har Escape, fokusfälla/återgång och statusannonsering; alla åtgärder har synlig fokus, skärmläsarnamn, minst 44×44 px touchyta och färgoberoende identitet.
- Befintliga bokningar/kunder bevaras; 0076–0077 bygger grunden och 0078–0079 härdar den utan destruktiv datamigrering.
- Alla tester, lint, typecheck och build passerar; produktionen verifieras efter releasen.

## Utanför scope

- Kundportal del 05, `03-redigera-sidan-02`, offline/service worker, TWA/APK, automatiska kundmeddelanden, automatisk omplacering och delad personal över flera platser samtidigt.
