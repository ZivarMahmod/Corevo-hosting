# Backup, restore och dataradering

Det här är den operativa grinden för Postgres/Auth, R2-media och Corevos
GDPR-flöden. En konfigurerad backup är inte ett återställningsbevis. Beviset är en
lyckad restore till en isolerad miljö följd av kontroller mot samma kod- och
migrationsversion.

## Kanoniska ägare

| Område                               | Ägare                                        |
| ------------------------------------ | -------------------------------------------- |
| Databasschema                        | `supabase/migrations/`                       |
| Migrationsinventering                | `scripts/verify-database-release.mjs`        |
| Produktionscheckpoint                | `docs/ops/production-schema-checkpoint.json` |
| Kundexport                           | `apps/web/lib/gdpr/data.ts`                  |
| Kundradering och Auth-reconciliation | `apps/web/lib/gdpr/erase.ts`                 |
| R2-uppladdning och radering          | `apps/web/lib/r2/upload.ts`                  |
| Durabel mediastädning                | `apps/web/lib/media/cleanup.ts`              |

## Releasegrind

Före en release som kan påverka data:

1. Kontrollera i rätt Supabase-projekt att backup/PITR är aktivt och att
   retentionen täcker releasefönstret.
2. Kontrollera vad leverantörens restore faktiskt omfattar, inklusive Auth.
3. Kontrollera R2-versionering eller annan verifierad kopia. En DB-backup återställer
   inte borttagna objekt i R2.
4. Kör migrationsinventeringen enligt
   [databasmigrations-runbooken](database-migration-drift.md).
5. Öva restore till en separat branch/stagingmiljö. Kör aldrig en restoreövning mot
   produktion.
6. Dokumentera commit, migrationsfingeravtryck, UTC-fönster, målmiljö och resultat
   utan kunddata, objektinnehåll eller hemligheter.

## Restore

1. Stoppa nya mutationer och deployer för den drabbade miljön.
2. Fastställ senaste säkra tidpunkt och matchande Git-commit. Gissa inte.
3. Återställ till ett isolerat mål och behåll originalmiljön orörd för analys.
4. Kör den kodversion som matchar det återställda schemat.
5. Verifiera migrationshistorik och schema read-only.
6. Verifiera tenant/RLS, inloggning, bokning, betalningsjobb, scheduler och ett
   representativt mediaobjekt. Använd syntetiska eller godkända testidentiteter.
7. Kontrollera att DB-referenser till media motsvaras av verkliga R2-objekt och att
   inga städjobb arbetar mot fel generation.
8. Flytta trafik först efter ett uttryckligt go/no-go. Följ därefter
   [deploy-runbooken](deploy-runbook.md) och kör produktions-smoke.

Redigera aldrig en applicerad migration och kör inte gammal reverserings-SQL mot en
nyare databas. En schemakorrigering görs som en ny, granskad migration. PITR eller
annan destruktiv återställning kräver alltid operatörsgodkännande.

## GDPR och retention

- Självserviceexporten går genom `/api/gdpr/export`; bygg ingen parallell export ur
  råa tabeller.
- Radering går genom den etablerade RPC-/Auth-reconciliationen i
  `apps/web/lib/gdpr/erase.ts`. Manuella tabellraderingar får inte ersätta flödet.
- Affärs-, bokförings-, FK- och auditdata kan behöva bevaras utan direkt PII.
- En post i väntan på Auth-cleanup är inte färdig. Reconcila den etablerade kön och
  bekräfta slutläget innan raderingen rapporteras klar.
- Audit och driftbevis får endast bära slutna felkoder och pseudonyma identifierare.

## Minsta restorebevis

- exakt källmiljö och isolerat återställningsmål;
- Git-commit och migrationsfingeravtryck;
- återställd UTC-tidpunkt;
- schema-/historikparitet;
- tenant- och RLS-kontroll;
- Auth-kontroll;
- R2-kontroll;
- scheduler-/köhälsa;
- operatörens go/no-go.
