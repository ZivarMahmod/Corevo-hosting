# HANDOFF — Corevo

Senast uppdaterad: 2026-07-17.

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
  Frisöradmin PWA driftsattes från commit `4970548` i GitHub Actions-körning
  `29565743755` den 2026-07-17. Supabase har migrationerna 0071–0082 registrerade.
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
- En samlad slutgenomgång finns på grenen `codex/corevo-final-sweep` men är ännu
  **inte driftsatt**. Den samlar Inställningar i ett vertikalt workspace, härdar
  publika skrivvägar/betalningar/cron och lägger migrationerna 0083–0088.
  Produktionsdatabasen är fortfarande verifierad till 0082. Produktionens deploy
  spärras därför tills 0083–0088 har granskats, applicerats och GitHub-variabeln
  `PROD_DB_MIGRATION` satts till `0088`. Full rapport:
  `5-Kod/docs/corevo-slutgenomgang-2026-07-17.md`.
- Samma odriftsatta gren härdar Personalpanelen: oförändrade formulär ger inget
  falskt fel, kalenderfärg skickas explicit, historisk personal kan inte erbjudas
  permanent radering och schemahoppet behåller plats. Panelen och Schemas innehåll
  är avsiktligt befintliga implementationer inne i nya Inställningar-workspacet;
  individuell nydesign ingår inte i paket 04.
- Mobil-/iPadkalendern kan flytta bokningar med finger via ett separat touch-handtag.
  Kalendern visar måltid/resurs under draget och kräver bekräftelse innan skrivning;
  vanlig scroll startas utanför handtaget.
- Historiska goals, arbetsloggar, researchkopior och gamla skärmdumpar är rensade.
  Git-historiken är arkivet; de ska inte återskapas som lösa statusdokument.

## Nästa del

Goal 71:s tidigare grundversion är driftsatt. Den kompletta 04-härdningen på
`codex/corevo-final-sweep` är lokalt verifierad men inte driftsatt och står kvar
som `pågår` tills den säkra deploygrinden är passerad och Zivar har kört den
autentiserade manuella acceptansen i
`6-Testing/goal-71-installningar-frisoradmin-testlista.md`. Flytta inte goal eller
designpaket till `klart/` före den acceptansen.

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
