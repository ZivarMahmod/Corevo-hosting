# Databasmigrationer och releasecheckpoint

`supabase/migrations/` är schemats enda historik. Både fyrsiffriga legacyversioner
och tidsstämplade Supabase-versioner är permanenta identiteter. En applicerad fil
får aldrig byta namn eller innehåll.

## Kanoniska ägare

- Migrationer: `supabase/migrations/`.
- SQL-kontrakt: `supabase/tests/`.
- Inventering, historikparitet och fingerprint:
  `scripts/verify-database-release.mjs`.
- Read-only schemaaudit: `scripts/sql/audit-production-migration-effects.sql`.
- Produktionsbevis: `docs/ops/production-schema-checkpoint.json`.
- Releasegrind: `.github/workflows/deploy.yml`.

Produktionsmigrationer körs inte automatiskt av CI. Apply, repair och ändring av
checkpoint/remote releasevariabel kräver uttryckligt operatörsgodkännande.

## Lokal inventering

Kör från `5-Kod/`:

```powershell
node scripts/verify-database-release.mjs
node --test scripts/verify-database-release.test.mjs
```

Kommandot ska ge exakt en version per fil och ett fingerprint över normaliserat
migrationsinnehåll. Den aktuella senaste versionen ska tas från kommandot och
workflowen, aldrig kopieras från en gammal runbook.

## Read-only jämförelse med en länkad miljö

1. Bekräfta projekt-referensen innan första kommandot. Gissa aldrig från ett gammalt
   `supabase link`.
2. Hämta historiken read-only till en temporär fil.
3. Jämför hela remotehistoriken med repot.
4. Kör schemaauditen read-only. En historikrad är inte bevis för att objektet finns.

```powershell
supabase migration list --linked | Out-File -Encoding utf8 <temp-migration-list>
node scripts/verify-database-release.mjs --history-file <temp-migration-list> --history-side remote
supabase db query --linked --file scripts/sql/audit-production-migration-effects.sql
```

Rapportera separat: lokal inventering, preview/staginghistorik, produktionshistorik
och schemaform. `unknown` är inte godkänt och får inte omskrivas till grönt.

## Ny migration

1. Skapa en ny, unikt versionerad fil. Ändra aldrig en redan applicerad fil.
2. Gör migrationen transaktionell och idempotent där kontraktet tillåter det.
3. Lås `search_path`, grants och default execute för nya funktioner.
4. Lägg ett beteende-/säkerhetstest i `supabase/tests/`.
5. Kör fresh reset och hela SQL/RLS-sviten i en isolerad databas.
6. Kör lokal inventering och uppdatera workflowens förväntade senaste version och
   testlista i samma ändring.
7. Verifiera staginghistorik och schema före produktionsbeslut.

## Produktionscheckpoint

Efter en godkänd apply ska operatören read-only verifiera hela historiken och
schemaauditen. Först därefter uppdateras checkpointen med:

- `status=verified`;
- repoets faktiska senaste version;
- observerad senaste remoteversion;
- historik- och schemaresultat;
- UTC-tid, operatör och evidensreferens;
- exakt fingerprint från inventeringsskriptet.

Checkpoint, repo och releasevariabel måste beskriva samma version. Workflown ska
falla stängt vid minsta avvikelse.

## Release av 20260804-migrationerna

Före en godkänd staging- eller produktionsapply: ta en PITR-/backupcheckpoint och
kör schemaauditen read-only. Efter apply ska de tre sista raderna i
`audit-production-migration-effects.sql` vara gröna: ingen aktiv push-kanal eller
push-prenumeration, inga aktiva obundna bokningslänkar eller gamla
`customer_accounts_enabled`-flaggor, samt validerad avbokningsconstraint utan
betalda avbokningar som saknar refund-jobb.

Det finns ingen säker down-migration för dessa datatransformationer. En avvikelse
stoppas och rättas med en ny framåtriktad migration efter read-only inventering.

## Drift eller delvis applicerad migration

- Stoppa release. Markera inte en delvis applicerad migration som klar.
- Samla read-only historik och schemaevidens innan någon mutation.
- Använd `migration repair` endast för en bevisad historikavvikelse med separat
  godkännande; kommandot reparerar historik, inte schema.
- Reparera schema med en ny framåtriktad migration.
- Ta backup/PITR-checkpoint före riskfylld apply och följ
  [backup-/restore-runbooken](backup-restore.md).
- Kopiera aldrig repair-kommandon, fingerprint eller versionsnummer från ett äldre
  incidentdokument.
