# Databasmigrationer — driftgrind och säker avstämning

## Bekräftat nuläge 2026-07-18

- Supabase-projektet är `ACTIVE_HEALTHY`, PostgreSQL 17.6.1 och organisationen
  ligger på Pro.
- Produktionshistoriken är avstämd till 106 numeriska versioner `0001–0107`
  (projektets historiska lucka `0013` finns varken lokalt eller remote), utan
  datumversioner eller andra ogiltiga versionsnamn.
- De 14 gamla datumversionerna som motsvarade `0069–0082` har bevisats motsvara
  de lokala filerna och ersatts i historiken. Effekterna `0060–0091` verifierades
  före repair; ingen av de gamla filerna kördes om mot kunddata.
- Två verkliga legacy-luckor reparerades additivt: `0105` återställde
  slot-hold-kontraktet som saknades trots registrerad `0014`, och `0107`
  återställde global plattformsidentitet som saknades trots registrerad `0029`.
- En datalös Supabase-previewbranch har efter full reset kört hela kedjan
  `0001–0107`; historiken innehöll 106 numeriska versioner, inga ogiltiga
  versionsnamn, och alla 26 SQL-runtime-/RLS-tester passerade. Den officiella
  repair-sekvensen har dessutom repeterats där: efter avstämningen erbjöd
  `db push --dry-run` exakt `0092–0106`; den senare driftluckan erbjöd exakt
  `0107` och inget annat.
- Produktionscheckpointen är verifierad till `0107`. Det tar bort just
  migrationsdriftgrinden, inte de övriga lanseringsgrindarna.

## Produktionsavstämning 2026-07-18

- Operatör: Codex på uttryckligt godkännande av Zivar.
- Förkontroll: projekt `ACTIVE_HEALTHY`; fysisk backup samma dag `COMPLETED`.
- Efterkontroll: 106 historikrader, senaste `0107`, 0 ogiltiga versioner och tom
  `db push --dry-run`.
- Schemaaudit: samtliga kontroller `0014`, `0029`, `0060–0068` och `0083–0091`
  passerade, inklusive RLS, grants och fyra aktiva pg_cron-jobb.
- Runtime: alla 26 transaktionella/read-only SQL-/RLS-tester passerade direkt mot
  produktion utan kvarlämnad fixturedata.
- Supabase advisors: inga `ERROR` för security eller performance. Befintliga
  security-`WARN` (bland annat funktions-search_path, GraphQL-discoverability och
  Auth leaked-password protection) är inte tyst kvitterade; de ligger kvar som
  separat härdningsarbete och ändrar inte migrationspariteten.

Kör aldrig `migration repair --status applied` enbart för att ett enstaka objekt
råkar finnas. Repair ändrar historik, inte schema, och kan annars dölja en halv
migration.

## Automatisk grind

CI gör tre separata kontroller:

1. unika migrationsnummer + förväntad senaste version,
2. en SQL-runtimefil för varje lanseringsmigration 0092–0107,
3. fresh Supabase från 0001 till senaste följt av `supabase test db` och lokal
   historikparitet.

Staging kör dessutom `supabase migration list --linked` efter `db push` och
jämför den länkade historiken med repots hela migrationslista. Produktion kräver
både `PROD_DB_MIGRATION=0107` och ett granskat `verified`-checkpoint. Checkpointen
måste bära exakt `sha256:`-fingeravtryck som verifieringskommandot skriver ut samt
en referens till det sparade read-only schema-/historikbeviset. En ensam GitHub-
variabel eller en gammal checkpoint kan alltså inte låtsas att databasen är klar.

## Säker avstämning — läs först, skriv sist

Kör från `5-Kod/`. Kontrollera alltid aktuell CLI-syntax med `--help` före
operationen; Supabase CLI ändras över tid.

```text
supabase --version
supabase migration list --help
supabase db diff --help
supabase db push --help
supabase migration repair --help
```

### 1. Läs historiken och effekterna

```text
supabase link --project-ref clylvowtowbtotrahuad
supabase migration list --linked
supabase db query --linked --file scripts/sql/audit-production-migration-effects.sql
```

Spara utdata som releasebevis utanför Git. Alla kontroller ska vara `true` efter
0107. Inga reparationskommandon i detta steg.

### 2. Jämför faktisk schemaform mot migrationskedjan

Docker krävs eftersom CLI bygger en lokal shadow database.

```text
supabase db diff --linked --schema public,private
supabase db push --linked --dry-run
```

En tom schema-diff är nödvändig men inte tillräcklig: CLI-diff fångar inte all
data, cron, storage eller publication-state. Previewbranchens fulla körning och
den skrivskyddade SQL-auditen är därför obligatoriska kompletterande bevis.

### 3. Reparera endast bevisat redan applicerade versioner

Detta steg slutfördes 2026-07-18 och ska inte upprepas. Det muterar
produktionshistoriken och kräver uttryckligt operatörsgodkännande.
Detta är ett releaseoperatörssteg som Codex utför; Zivar ska inte kopiera SQL
eller handlägga historiktabellen. Den branchverifierade ordningen är:

```text
supabase migration repair 20260715211041 20260715225616 20260716003337 20260716003345 20260716003353 20260716003754 20260716005955 20260716112947 20260716113016 20260716122914 20260716122916 20260716225744 20260717080939 20260717081133 --status reverted --linked
supabase migration repair 0060 0061 0062 0063 0064 0065 0066 0067 0068 0069 0070 0071 0072 0073 0074 0075 0076 0077 0078 0079 0080 0081 0082 0083 0084 0085 0086 0087 0088 0089 0090 0091 --status applied --linked
supabase migration list --linked
supabase db push --linked --dry-run
```

Om en migration bara är delvis applicerad ska den **inte** markeras applied.
Skriv en ny, idempotent korrigeringsmigration eller återställ avvikelsen efter
separat granskning.

### 4. Applicera återstående migrationer genom normal väg

När 0060–0091 är korrekt avstämda ska dry-run endast lista verkligt ej applicerade
versioner. Applicering sker i ordning, med backup/restore-grinden klar, och aldrig
från denna dokumentationskontroll. Efteråt:

```text
supabase migration list --linked
node scripts/verify-database-release.mjs --expected-latest 0107 --required-test-versions 0092,0093,0094,0095,0096,0097,0098,0099,0100,0101,0102,0103,0104,0105,0106,0107 --history-file <migration-list.txt> --history-side remote
```

Uppdatera därefter checkpoint-filen till `verified`, sätt både
`historyAligned=true` och `schemaAligned=true`, exakt verifierare och UTC-tid,
kopiera kommandots utskrivna `sha256:` till `migrationFingerprint` och sätt
`verificationEvidence` till CI-/ärende-/artefaktreferensen där rå historiklista
och schemadiff sparats. Sätt sedan GitHub Environment-variabeln
`PROD_DB_MIGRATION=0107`. Ändringarna granskas i samma release. Kopiera aldrig
fingeravtrycket från en äldre commit.

Källor: [Supabase migration list/repair](https://supabase.com/docs/reference/cli/supabase-migration-list),
[Supabase db diff/push](https://supabase.com/docs/reference/cli/supabase-db-diff).
