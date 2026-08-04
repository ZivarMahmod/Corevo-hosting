# HANDOFF — Corevo

Detta är repots korta nulägesingång. Arbetsregler finns i `AGENTS.md` och
produktarkitekturen i
`1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.

## Status 2026-08-04

- Branch: `codex/restore-four-state-module-lifecycle` (namnet är historiskt).
- Bas före den lokala cutovern: `44dab3a66eb00847dcc90f3ac83d1bfa34db0508`.
- Cutovern är committad som `550add1c`; aktuella lokala reviewfixar är ännu
  ocommittade och får inte blandas med annat arbete utan uttryckligt uppdrag.
- Ingen push, deploy, produktionsmigration, DNS- eller tunneländring har gjorts.
- Den samlade lokala kodgaten är grön efter aktuella reviewfixar. Acceptance-
  hemligheter och miljöbevis saknas fortfarande, så externt releasebeslut är **NO-GO**.

## Vad cutovern ändrar

- `build once, never delete` är borttagen. Git är historiken; ersatt kod tas bort
  i samma cutover och varje beteende har en kanonisk ägare.
- Parallella storefrontskal, wrappers, döda komponenter, feature-flaggor, CSS och
  test-only exports är borttagna eller hopslagna med sin riktiga ägare.
- Bokningsserveraktionerna är uppdelade efter ansvar: publik kontext,
  tillgänglighet, verifiering och checkout. Den gamla 1 058-radersägaren finns
  inte kvar.
- Web push är pensionerad helt: UI, service worker, serverfunktion och aktiv
  routing är borta. Migreringen sparar pensioneringsdatum och revokerar gamla
  prenumerationer; gamla köposter flyttas till e-post/SMS när en verklig fallback
  finns, annars hoppas de över.
- En gammal push-rad kan inte skickas av appen utan terminaliseras som ogiltig.
- Notifieringscronen misslyckas nu synligt när lösenordsåterställningens recovery-
  batch misslyckas. E-posttransporten har en 10-sekunders timeout.
- Publik bokningsverifiering ägs av bokningspolicyn, inte av customer portal-läget.
- Push-fallback återställer försökstillståndet före den lämnas till e-post/SMS.
- Schemaläggaren har timeout per route och notifieringsdräneringen har en begränsad
  parallell batch. GitHub-nödrälsen dränerar också notifieringskön.
- Kvarvarande accepterade UI-kontrakt körs åter som en enda fail-closed CI-gate.
- Credentialed staging-E2E kan bara köras manuellt på exakt `main`-SHA. Production-
  grinden letar efter den körning där staging-E2E faktiskt lyckades, inte en godtycklig
  vanlig CI-körning för samma SHA.
- Staging-workflowet kräver ett allowlistat stagingprojekt som uttryckligen skiljer
  sig från produktionsprojektet före `db push`.
- Tester ligger hos den UI- eller routeägare de provar; `lib/` importerar inte UI
  eller routes.
- Aktiv projektstyrning består av `AGENTS.md` och denna `HANDOFF.md`; gamla
  parallella promptfiler är borttagna.

Historiska SQL-migrationer skrivs inte om. Produktdata och historiska outboxrader
behålls när de behövs för spårbarhet; den döda implementationen behålls inte.

## Färska lokala verifieringar

Körda från `5-Kod/` efter sista runtimeändringen:

- `pnpm test`: 330 testfiler, 2 518 tester, 0 fel.
- `pnpm typecheck`: grön.
- `pnpm lint`: 0 fel, 3 befintliga `<img>`-varningar i Zentum.
- `pnpm build`: optimerad Next 15.5.18-produktionsbuild grön.
- Fokuserade outbox-, bokningsleverans- och plattformstester: 77/77 gröna.
- `node --test apps/web/scripts/primary-scheduler.test.mjs apps/web/scripts/primary-scheduler-config.test.mjs`:
  14/14 gröna.
- `bash -n supabase/tests/customer_portal_mode_1400_migration_test.sh` och YAML-
  parsing av CI/deploy-workflows: gröna.
- `pnpm test:acceptance:contract`: Goal 93-delen är grön, men 03/04/06 stoppar
  korrekt eftersom lokala `ACCEPT_*`-hemligheter saknas.
- `node scripts/verify-database-release.mjs`: 167 migrationer genom
  `20260804150000`, fingerprint
  `sha256:946af004a4d394b0fb8b75d45db50d54c7dcdadb3c84d33035a33faebc0ece08`.
- `git diff --check` är grön. Scan bekräftar inga gamla bokningsimporter, aktiv
  pushimplementation eller `lib -> UI`-testimporter.
- En lokal browser-smoke nådde endast den avsiktliga tenantgränsen: utan lokal
  tenantdata svarar `freshcut.localhost:3000/boka` med 404. Det är inte en
  godkänd bokningsacceptans.

Detta bevisar lokal kompilering och kontrakt, inte fungerande staging eller
produktion. SQL-runtime/samtidighetstester är inte körda lokalt eftersom Docker,
`psql` och Supabase CLI saknas. En begärd Claude-peer-review startade inte:
dess runner avbröt direkt eftersom `jq` saknas. Den räknas som ingen peer-täckning.

Den här handoffen ger ingen behörighet att ändra staging, databas, deploy, DNS
eller remote branch. Det kräver uttryckligt operatörsgodkännande.

## Färsk extern read-only-audit

- `origin/main` och senaste lyckade produktionsdeployen (`30847615398`) är
  `44dab3a`; den lokala cutovern `550add1c` och den ocommittade reviewdiffen
  finns alltså inte som en publicerbar kandidat-SHA.
- Git-indexet är bara delvis förberett: de två nya SQL-sviterna är staged, medan
  aktuell version av 1400-sviten och resten av kandidatarbetet är unstaged. En
  commit måste därför först reconcilera indexet mot den verifierade worktree-diffen.
- GitHub-miljöerna `staging` och `production` finns, men båda saknar
  protection rules. De är inte bevisade godkännandegrindar.
- Branch `main` saknar också GitHub branch protection. En push kan därför inte
  betraktas som en granskad eller spärrad releaseväg i nuvarande remote-konfiguration.
- `staging` har inga miljöscopade vars eller secrets. Repo-variablerna saknar
  även `E2E_ENABLED`, staging-allowlist och staging-readinessflagga, så den
  credentialed E2E-rutten kan inte starta förrän den är uttryckligen konfigurerad.
- Både repo- och productionnivåns lästa `PROD_DB_MIGRATION` ligger före
  `20260804150000`. Produktionsgrinden ska därför fortsätta stänga.
- Publik HTTP svarar i dag för den gamla releasen (`corevo.se` 200; `booking.corevo.se`
  leder till login), men det är ingen autentiserad eller kandidatspecifik acceptans.

## Releaseblockerare

1. Kandidaten saknar en godkänd lokal commit och därmed en exakt SHA för den
   manuella staging-E2E:n. Reconcilera och commit:a endast efter uttryckligt
   godkännande av den aktuella diffen.
2. GitHub `main`, `staging` och `production` saknar skyddsregler. Konfigurera
   branch review/statusgrindar och namngivna miljögodkännare innan credentialed
   E2E, stagingmigration eller production kan räknas som kontrollerad drift.
3. Efter uttryckligt staginggodkännande: staging saknar fortfarande vars/secrets.
   Sätt den isolerade projektreferensen, dess separata nycklar och både staging-
   och produktionsreferens för workflowets hårda spärr; använd aldrig
   produktionsreferensen i staging.
4. Efter uttryckligt staginggodkännande: kör alla 167 migrationer, SQL/RLS-sviter
   och samtidighetstester i en disponibel
   databas och därefter i isolerad staging. Observera låstid för indexet i
   `20260804150000`.
5. Efter uttryckligt staginggodkännande: kör autentiserad browseracceptans med
   seedad tenant: bokning, avbokning,
   offert, customer portal, admin och providerflöden. Verifiera sedan mobil/design.
6. Senast lästa deklarerade `PROD_DB_MIGRATION` är `20260803095219`; repots
   checkpoint är `20260803191057`. Båda ligger före denna kandidats krav
   `20260804150000`. Produktionsgrinden ska fortsätta neka tills den verkliga
   migrationshistoriken och fingerprint är verifierade.
7. Omverifiera staging/prod-hostarnas TLS, scheduler-heartbeat och providerdrift
   först efter staging. Ingen av dessa är lokalt bevisad.
8. Acceptance-gaten saknar lokalt/staging `ACCEPT_*`-hemligheter och misslyckas nu
   korrekt i stället för att ge falskt grönt. Den credentialed E2E-körningen måste
   startas manuellt för exakt `main`-SHA i den skyddade stagingmiljön efter uttryckligt
   godkännande.
9. Verifiera e-post-claimens query plan mot SMS-backlog i staging innan en separat
   concurrent partial index-migration eventuellt beslutas.

## Nästa säkra ordning

1. Efter uttryckligt godkännande: reconcilera den aktuella diffen till en lokal
   commit. Publicera inte den utan ett separat godkännande.
2. Efter uttryckligt godkännande: skydda GitHub-miljöerna och konfigurera den
   isolerade staginggrinden med namngivna ägare, secrets, allowlist och
   checkpoint-record. Skriv aldrig hemligheter i repot.
3. Efter uttryckligt staginggodkännande: publicera exakt den godkända SHA:n och kör
   exakt samma SHA i isolerad staging:
   backup/PITR-kontroll, migrationer,
   audit SQL, seedad E2E, browseracceptans och teardown.
4. Efter uttryckligt staginggodkännande: åtgärda varje stagingavvikelse med en
   framåtriktad migration eller en ändring i
   dess befintliga ägare; bygg inga parallella ersättningslager.
5. Ta separat GO-beslut för produktionsmigration och deploy först efter grön
   staging och en ny signerad produktionscheckpoint.

## Källor som gäller

- Arbetsregler: `AGENTS.md`
- Arkitektur: `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`
- Aktiv releaseordning: `2-Byggplan/relaunch-local-deploy-readiness-2026-08-04.md`
- Drift: `5-Kod/docs/ops/`
- Slutlig sanning: källkod, migrationer, tester och read-only miljöbevis

Zivar Graph Studio använder Graphify som motor. Grafen väljer vad som ska läsas;
källfiler och tester avgör vad som är sant.
