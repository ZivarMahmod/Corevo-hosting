# HANDOFF — Corevo

Senast uppdaterad: 2026-07-20.

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
  avstämd och runtime-verifierad genom migration `0117`; checkpoint och bevis
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
- Personalpanelen är härdad: oförändrade formulär ger inget falskt fel,
  kalenderfärg skickas explicit och historisk personal kan inte erbjudas permanent
  radering. Personkortet äger nu personens bokningsbarhet, tjänster, arbetspass,
  bokbara starter och frånvaro; Scheman är platsens öppettider + teamöversikt och
  länkar vidare till personkortet. Ägarkonto kan länkas via kanoniska
  `staff.profile_id`; döda självservice-länkar döljs utan aktiv personalkoppling.
- Goal-73 för kundadminens mobilchrome och kalendergester finns och är aktiv.
  Mobilkalendern använder hela bokningskortet för långtryck och drag; inget separat
  touch-handtag finns. Kalendern visar måltid/resurs och kräver bekräftelse innan
  skrivning. Dagvyn landar vid schemats start utan fördröjda vertikala hopp och
  använder en lugn, oräfflad pappersyta. Passerade bokningar skapar ingen klocka
  eller avslutskö; Genomförd/Uteblev är frivilliga val inne i bokningen. Goal-73
  innehåller även keyboard-safe kalenderträffar och explicit Ja/Nej till
  kundmeddelande vid flytt. Goal-73 arkiveras inte förrän Zivar godkänt den live.
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
`0117`, Worker-budget och extern oautentiserad prod-rök är gröna. Zivars
autentiserade manuella acceptans som superadmin och en verklig partner återstår,
så goal-72 ligger kvar i `goals/` tills dess. Det senast inkomna designpaketet
`Dagens genomgångar/Mobil pwa/` styr den aktiva goal-73 och är fortsatt designlag.
Provider-konfigurationen per partner finns, men `SMS_DELIVERY_MODE=off`; provider-dry-run
och live-SMS är fortsatt separata, uttryckligen godkända driftsteg.

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
