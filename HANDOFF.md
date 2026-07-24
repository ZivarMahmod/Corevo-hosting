# HANDOFF — Corevo

Senast uppdaterad: 2026-07-24.

## Läsordning

1. `AGENTS.md` — arbetssätt och hårda regler.
2. `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md` — produktkanon.
3. `2-Byggplan/ROADMAP.md` — den enda aktuella byggordningen.
4. Relevant paket i `4-Dokument-Underlag/01-acceptans/` — designlag för aktuell del.

## Produkten

Corevo är en generell multi-bransch-plattform. En motor, databas och kodbas bygger
publika sidor och riktiga moduler för valfria branscher. FreshCut/frisör är en
tenant och ett testfall, aldrig produktdefinitionen.

## Nuläge

- Den samlade localhostacceptansen för de aktuella Goal 74–80-delarna är körd:
  `350` testfiler och `2737` tester passerar tillsammans. Goal 74–80 är lokalt
  låsta i samma arbetsyta. Produktionsmigration, domän/HTTPS, kvarvarande
  extern e-postleverans och deploy är fortsatt releasegrindar och ska göras
  tillsammans med Zivar. Protokoll:
  `6-Testing/samlad-localhostacceptans-goal-74-80.md`. Produktion är orörd.
- Goal 80 är verifierat klart lokalt på
  `codex/launch-inventory-customer-design`. Superadminens valda kundkort är nu
  en egen fullbreddsyta enligt 1320px-kanon i stället för att pressas bredvid
  masterlistan. Kundflikarna radbryts och Sida-studion följer exakt 400/480-
  delningen, sticky 78px och 420px-minimihöjden. Previewn växlar mellan en
  verklig skalad 1360px-desktop och en centrerad 390px-mobil. Browseracceptans
  vid 1280px, 111 plattformstester, typkontroll, lint utan fel, preview-build
  och Fable 5-review (`NO P0/P1`) är gröna. Den tillfälliga previewoperatören
  är borttagen; produktion är orörd.
- Goal 79 är verifierat klart lokalt på
  `codex/launch-inventory-customer-design`: FreshCuts kundlåsta webb använder
  den godkända 2026-designen, lokala originalbilder, verklig tenant-/servicedata
  och säkert externt Bokadirekt-flöde när Corevo-bokning är avstängd. Desktop,
  mobil, 211 riktade tester, typkontroll, lint, preview-build och oberoende
  Fable-granskning är gröna. Förhandsdata finns endast på Supabase-branchen
  `localhost-acceptance`; inget är deployat till produktion.
- Produktionens boknings-, schema- och personalgrund är live. Inställningar v2 och
  Frisöradmin PWA driftsattes 2026-07-17. Produktionsdatabasen är numeriskt
  avstämd och runtime-verifierad genom migration `0119`; checkpoint och bevis
  finns i `5-Kod/docs/ops/database-migration-drift.md`.
- Superadmin v2 och partnerrollen är live på Worker-version
  `5613f4bb-a4ed-4665-bb6a-b5175ce7cae3` från `main`-SHA `88d59b5`
  (deploy-run `29662607124`). Partnern är DB-isolerad till sina tenants; root
  skapar/inbjuder partnerägaren och styr ett valfritt licenspris per partner.
  Öppen månad räknas om vid pris-/kundändring, stängda månader är immutabla,
  aktiv någon gång ger hel månad och aktiv A→B-flytt debiterar båda.
- Grundens verkliga delar omfattar platsbehörighet/RLS, öppettider, schema,
  personal-readiness, frånvaro, atomisk adminbokning, ombokning och statusbyte.
- Ägaradminens mobil-PWA, översikt och kalender Mobil v2 finns i kod och produktion.
- Redigera sidan v2 är integrerad på `main`. Revisioner/utkast stöds av migration
  0080. Regressionerna för fullhöjds-mobilpreview och komplett Corevo-signatur är
  testade i den aktuella arbetsrundan.
- Inställningar v2 använder de befintliga ägande ytorna och ny tenantbunden
  personalbehörighet. Personalens primära dörr är `booking.corevo.se/personal`;
  `minbooking.corevo.se/personal` är avsiktligt kvar parallellt med värdseparerad
  session. Kundportalpaket 05 är inte byggt eller ändrat.
- Paket 04 är tekniskt komplett på den odriftsatta slutgenomgångsgrenen. Enligt
  `04-installningar-v2/INSTALLNINGAR-V2-NOTES.md` ska bara tre kategorier vara
  fullbyggda mönsterexempel; Personal och Schema behåller avsiktligt sina verkliga
  befintliga funktioner i det nya skalet. Deras framtida individuella omdesign är
  ett separat designpaket och ska inte beskrivas som en 04-lucka.
- Första kundens relationspaket ligger samlat på `main`: säker gäst→kund-claim,
  kund-/personalrelation, sann bokningsstatus, durable notifieringsoutbox,
  notifieringscron, driftgrindar och fail-closed handel. Det historiska
  46elks-spåret ligger fortsatt bakom tre grindar med `SMS_DELIVERY_MODE=off`;
  Giadas separata SIM-transport aktiverades först efter Zivars godkända canary.
- Zivar har låst den långsiktiga SMS-riktningen: Corevo ska äga gateway och kod,
  utan CPaaS-återförsäljare, och ansluta direkt till en operatörs A2P/Bulk-SMSC
  via direkt REST först när kraven klaras, annars SMPP på ett bevisat behov.
  Samma avtalsförfrågan ska gå till Telia, Tele2/Comviq, Telenor/Vimla och
  Tre/Hi3G/Hallon; Telia är första tekniska kandidat men inte förvald vinnare.
  Comviq-SIM/Huawei kan
  bara ge nummerbaserad avsändare och kan inte lösas med ett bättre modem.
  Operatörsbeställning, SMPP-arkitektur, Sender ID-policy, PIN före bokning,
  magic-link/PWA-flöde och Claude-handoff finns i
  `1-Planering/18-sms-direktoperator/`. `notifications_outbox` förblir enda kö;
  ingen parallell `sms_jobs` får byggas. Direkt A2P/Sender ID är inte aktiverat;
  det nu aktiva SIM-spåret använder nummerbaserad avsändare.
- Giadas lokala SMS-gateway är driftsatt 2026-07-21 från
  `ZivarMahmod/corevo-sms` `master`-SHA `8f136e7`. API och modem-worker är aktiva;
  den gamla Supabase-pollern är maskerad. Read-only deploy-nyckel, fast-forward-
  uppdatering var femte minut med test/rollback, hälsokontroll varje minut, daglig
  SQLite-backup och Huawei-route/DNS-skydd är installerade. Claude Code finns på
  Giada för manuell SSH-användning men körs inte som daemon. Produktions-Workern
  är kopplad till gatewayen med en separat, hashad API-identitet.
  RM550V-stöd, fail-closed sändgrind, strikt NetworkManager-isolering och
  SMS-only radioaktivering är installerade och verifierade med 77 gröna tester
  på både Windows och Giada/Linux. RM550V-GL är registrerad på Tele2 med LTE/5G,
  stark signal och SMS-stöd; ingen databärare finns, WWAN är `unmanaged` och
  internet går via kabel-LAN `eno1`. Ett maskerat canary-SMS accepterades av
  mobilnätet och bekräftades mottaget av Zivar. `COREVO_LIVE_SEND_ENABLED=true`;
  publik health visar modemet online och kön är tom.
- Personalpanelen är härdad: oförändrade formulär ger inget falskt fel,
  kalenderfärg skickas explicit och historisk personal kan inte erbjudas permanent
  radering. Personkortet äger nu personens bokningsbarhet, tjänster, arbetspass,
  bokbara starter och frånvaro; Scheman är platsens öppettider + teamöversikt och
  länkar vidare till personkortet. Ägarkonto kan länkas via kanoniska
  `staff.profile_id`; döda självservice-länkar döljs utan aktiv personalkoppling.
- Goal-73 för kundadminens mobilchrome och kalendergester är implementerad och
  mekaniskt verifierad men väntar på Zivars fysiska liveacceptans.
  Mobilkalendern använder hela bokningskortet för långtryck och drag; inget separat
  touch-handtag finns. Kalendern visar måltid/resurs och kräver bekräftelse innan
  skrivning. Dagvyn landar vid schemats start utan fördröjda vertikala hopp och
  använder en lugn, oräfflad pappersyta. Passerade bokningar skapar ingen klocka
  eller avslutskö; Genomförd/Uteblev är frivilliga val inne i bokningen. Goal-73
  innehåller även keyboard-safe kalenderträffar och explicit Ja/Nej till
  kundmeddelande vid flytt. Goal-73 arkiveras inte förrän Zivar godkänt den live.
- Goal-74:s grundleverans är driftsatt från `main`-SHA
  `645ae7b` (deploy-run `29840569825`, Worker
  `0d440c6f-fbfa-433a-b8f5-c5f39f72d3da`): challenge + hold + anonym
  PIN-outbox samt PIN-verifierad bokning + bekräftelse-outbox är atomiska och
  migrationerna `0118–0119` är produktionsverifierade. Fysisk SIM-canary,
  själv-SIM-loopback och en full Demo-kedja till skapad bokning godkändes
  2026-07-22; testbokningen avbokades direkt efter beviset.
  Tilläggsrevisionen är lokalt låst på
  `codex/launch-inventory-customer-design`: publik boknings-PIN är fyra siffror
  med tre försök och tenantens kundadmin/superadminkort väljer endast SMS, SMS
  med mejlreserv eller endast mejl. SMS skapar inte längre en oanvänd
  konto-claim och alla durabla bokningslänkar använder den kanoniska
  `<slug>.boka.corevo.se`-hosten. Full web 350 testfiler/2 737 tester,
  typecheck, lint utan fel och produktionsbuild är gröna. Migration
  `0125_booking_pin_three_attempts.sql` och dess grants/hostkontrakt är
  runtimeverifierade på `localhost-acceptance`. En riktig e-postfallback-canary,
  produktionsmigration och browserkontroll av kanalvalen återstår i den samlade
  releasefasen; de blockerar inte nästa lokala goal. Goal-74 är därför arkiverad
  som lokalt verifierad under `2-Byggplan/klart/02-ytor/bokningsmotor/`.
  Design/exekveringsplan finns i `1-Planering/18-sms-direktoperator/`; aktivering
  och manuellt prov finns i `5-Kod/docs/ops/pin-booking-activation.md` och
  `6-Testing/goal-74-pin-bokning-testlista.md`.
- Goal-75 är lokalt låst på `codex/launch-inventory-customer-design`.
  Magic-länk och portalsession, bokningsöversikt/historik/detalj, säker
  avbokning, kalender, Boka igen, profil/kontaktbyte, recovery,
  säkerhet/enheter och neutral PWA är byggda i premiumskalet. En enkel Corevo
  C-ikon har ersatts av den fastställda Kopparfolie-ikonen; manifest, Apple-
  touch-ikon, portalhostens firewall och redirect-säkert PWA-scope är verifierade.
  Kundsynlig copy beskriver inte den interna inloggningsmetoden.
  Localhostacceptans mot den isolerade Supabase-previewbranchen
  `localhost-acceptance` gick igenom på desktop och mobil. Den fångade en
  PostgreSQL-regexgräns i portalsnapshoten; `0120` är rättad och
  `0128_customer_portal_postgres_regex_fix.sql` reparerar redan
  migrerade preview-/stagingdatabaser. Portalens 56 testfiler/413 tester,
  Goal-75-proben 5/5, typecheck, lint utan fel och produktionsbuild är gröna.
  Ingen produktionsdeploy är gjord; Goal-75 ligger kvar i `goals/` tills den
  gemensamma migrations-/host-/HTTPS-releasen är genomförd.
- Goal-76 är lokalt låst på samma branch. Nya kunder skapas nu alltid **Under
  konfiguration**; en DB-ägd, modulstyrd readinessgrind är ensam väg till
  `active`. Kundkortet visar exakta blockerare och standardadressen är
  `<slug>.boka.corevo.se` via wildcard, utan ny Cloudflare-domän per kund.
  Migration `0127_tenant_launch_readiness.sql` är applicerad och
  runtimeverifierad på `localhost-acceptance`: publicering, idempotens, nekad
  för tidig publicering och nekad direkt statusbypass är gröna med rollback.
  Seedad superadmin är rättad till global identitet. Full websvit 344
  testfiler/2 716 tester, typecheck, lint och produktionsbuild är gröna;
  seedregressionen är 6/6 grön. Gemensam skrivande localhostbrowseracceptans är
  parkerad eftersom den redan körande port 3000 pekar på produktionens
  `.env.production`; den ska startas mot preview ihop med Goal-74/75.
- Goal-77 är lokalt verifierad på samma branch. Mallbyte kräver nu ett explicit
  val mellan **Behåll nuvarande innehåll** och **Använd mallens innehåll**;
  preview och publicerat resultat delar samma copy-kontrakt. Ett opublicerat
  utkast blockerar mallbyte och en återställd revision från en annan mall kan
  inte publiceras över den nya mallen. `83/83` angränsande tester, typecheck,
  riktad lint och lokal browseracceptans med två verkliga mallbyten är gröna mot
  `localhost-acceptance`. Produktion är orörd.
- Goal-78 är lokalt låst på samma branch. En explicit `booking=off`-rad betyder
  nu webbplatsläge och en valfri extern HTTPS-länk ersätter alla delade
  boknings-CTA:er; saknad rad behåller den äldre säkra Corevo-standarden och
  `booking=live` vinner alltid. Kundadmin och superadmin kan spara länken och
  onboarding erbjuder Live/Pausad/Av. Den smala publika modulstatusfunktionen i
  `0129_public_module_state_read.sql` är applicerad enbart på
  `localhost-acceptance`. Browseracceptansen verifierade åtta externa CTA:er,
  säker ny flik, nekad HTTP-länk, stängd `/boka`, inert `draft`, intern
  Corevo-hantering för `paused` samt återgång till Corevos femstegsdialog.
  Extern länk används endast vid explicit `off`, aldrig vid okänt tillstånd
  eller läsfel. 24/24 riktade tester, typecheck och lint är gröna.
- Historiska goals, arbetsloggar, researchkopior och gamla skärmdumpar är rensade.
  Git-historiken är arkivet; de ska inte återskapas som lösa statusdokument.

## Nästa del

Goal-74–80 är lokalt låsta och den samlade kodacceptansen är grön. Nästa
byggdel är Goal-81: bokningsmotorns fyra lägen genom den verkliga
plats-/djuplänksmatrisen. Goal-74:s kvarvarande e-postprov samt Goal-75/76:s
produktionsmigration/host/HTTPS-prov är releasecheckar och blockerar inte det
lokala bygget. Ingen ny deldeploy ska göras innan de lokala byggdelarna är klara.
Den persistenta Supabase-previewbranchen `localhost-acceptance`
(`cwnhpesrgolflkmyjbrm`) är den isolerade databasen för detta arbete. Den
innehåller inga kopierade produktionsdata och har exakt `128` kanoniskt
numrerade migrationer genom `0129`, inklusive Goal-74:s tre-försöksmigration,
Goal-75:s säkerhets-/regexmigrationer och syntetisk portaldata.
Produktion `clylvowtowbtotrahuad` är orörd.

Relationspaketet är publicerat från den verifierade leveransen och produktionen
svarar på boknings- och tenantdörrarna. Zivars autentiserade manuella acceptans av
Inställningar/Frisöradmin och rollflödet gäst→kund→personal→ägare återstår; därför
ligger goal-71 och dess designpaket kvar utanför `klart/`.

Goal-72 Superadmin v2 S1–S7 är implementerad, oberoende granskad och driftsatt:
kommunikation, drift, workspace/genvägar, PII, tvåstegsarm, sann statistik,
kundkortets master–detalj, mobilparitet, IA-svängen till `/kunder` +
`/slutkunder` samt partnerrollen. Automatisk release proof, migrationscheckpoint
`0118`, Worker-budget och extern oautentiserad prod-rök är gröna. Zivars
autentiserade manuella acceptans som superadmin och en verklig partner återstår,
så goal-72 ligger kvar i `goals/` tills dess. Det senast inkomna designpaketet
`Dagens genomgångar/Mobil pwa/` styr den aktiva goal-73 och är fortsatt designlag.
Provider-konfigurationen per partner finns, men `SMS_DELIVERY_MODE=off`; provider-dry-run
och live-SMS är fortsatt separata, uttryckligen godkända driftsteg.
Direktoperatörsspåret i `1-Planering/18-sms-direktoperator/` byggs nu som goal-74
mot den befintliga SIM/Giada-transporten med nummerbaserad avsändare och
e-postfallback. Ett framtida svenskt A2P/Bulk-avtal och godkänt Sender ID byter
adapter bakom samma kontrakt; det blockerar inte PIN-flödet eller e-postfallbacken.

## Hårda regler

- Ingen bransch får hårdkodas som plattformens standard eller specialfall.
- `corevo.se` är POS-/plattformshost och får aldrig lösas som en tenant-storefront.
- Tenant- och platsgränser är fail-closed. Följ `private.tenant_id()` och etablerad RLS.
- Personaldomänen använder `staff`/`staff_id`; skapa inte parallella personmodeller.
- Build once, never delete: funktioner kan modulgatas men inte försvinna för andra tenants.
- En byggdel i taget: underlag -> goal -> kod -> verifiering -> klart.
- Secrets får aldrig hamna i Git. Driftreferenser bor i `5-Kod/docs/ops/`.

## Lokala kvalitetskommandon

Kör från `5-Kod/`:

```text
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Deploy och databasskrivningar kräver respektive säker produktionsväg; använd inte
muterande E2E mot den kanoniska databasen.
