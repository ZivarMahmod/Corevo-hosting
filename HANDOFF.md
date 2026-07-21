# HANDOFF — Corevo

Senast uppdaterad: 2026-07-21.

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

- Produktionens boknings-, schema- och personalgrund är live. Inställningar v2 och
  Frisöradmin PWA driftsattes 2026-07-17. Produktionsdatabasen är numeriskt
  avstämd och runtime-verifierad genom migration `0118`; checkpoint och bevis
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
  notifieringscron, driftgrindar och fail-closed handel. Skarpt SMS är byggt bakom
  tre grindar men `SMS_DELIVERY_MODE=off`; inget provideranrop ska ske före Zivars
  separata canarybeslut.
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
  ingen parallell `sms_jobs` får byggas. Inget SMS har aktiverats av beslutet.
- Giadas lokala SMS-gateway är driftsatt 2026-07-21 från
  `ZivarMahmod/corevo-sms` `master`-SHA `b365065`. API och modem-worker är aktiva;
  den gamla Supabase-pollern är maskerad. Read-only deploy-nyckel, fast-forward-
  uppdatering var femte minut med test/rollback, hälsokontroll varje minut, daglig
  SQLite-backup och Huawei-route/DNS-skydd är installerade. Claude Code finns på
  Giada för manuell SSH-användning men körs inte som daemon. Modemet var inte
  fysiskt anslutet vid slutverifieringen, gatewayen hade noll väntande jobb och
  Corevos `notifications_outbox` är ännu inte kopplad till gatewayen.
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
- Goal-74 är den aktiva byggdelen och är implementerad på
  `codex/pin-booking-sim-fallback`: publik bokning kräver PIN via direkt SMS när
  Giada/modemet är friskt och faller annars tillbaka till e-post före kontaktsteget.
  Challenge + hold + anonym PIN-outbox samt PIN-verifierad bokning +
  bekräftelse-outbox är atomiska; de exakta raderna CAS-claimas och dispatchas
  direkt, överlappande holds serialiseras per tenant/personal och den gamla
  overifierade create-vägen är borttagen. Web 2 197 tester, typecheck, lint utan
  fel, produktionsbuild, SQL-parser och gateway 54 tester är gröna. Migration `0118` är
  applicerad och produktionsverifierad; Worker och gatewayrevision är ännu inte
  driftsatta, och e-post- samt SIM-canary återstår.
  Design/exekveringsplan finns i `1-Planering/18-sms-direktoperator/`; aktivering
  och manuellt prov finns i `5-Kod/docs/ops/pin-booking-activation.md` och
  `6-Testing/goal-74-pin-bokning-testlista.md`.
- Historiska goals, arbetsloggar, researchkopior och gamla skärmdumpar är rensade.
  Git-historiken är arkivet; de ska inte återskapas som lösa statusdokument.

## Nästa del

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
