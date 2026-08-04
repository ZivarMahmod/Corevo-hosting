# HANDOFF — Corevo

Detta är repots korta nulägesingång. Arbetsregler finns i `AGENTS.md` och
produktarkitekturen i
`1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`.

## Status 2026-08-04

- Branch: `codex/restore-four-state-module-lifecycle` (namnet är historiskt).
- Bas före den lokala cutovern: `44dab3a66eb00847dcc90f3ac83d1bfa34db0508`.
- Den lokala releasekandidaten är branchens HEAD efter denna cutover-commit.
- Ingen push, deploy, produktionsmigration, DNS- eller tunneländring har gjorts.
- Lokal releaseverifiering är grön. Externt releasebeslut är fortfarande **NO-GO**.

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

- `pnpm test`: 330 testfiler, 2 529 tester, 0 fel.
- `pnpm typecheck`: grön.
- `pnpm lint`: 0 fel, 3 befintliga `<img>`-varningar i Zentum.
- `pnpm build`: optimerad Next 15.5.18-produktionsbuild grön.
- Fokuserade outbox-, bokningsleverans- och plattformstester: 36/36 gröna.
- `pnpm test:goal93:contract`: 12 katalogkontrakt och 5/5 browserkontrakt gröna.
- `node scripts/verify-database-release.mjs`: 167 migrationer genom
  `20260804150000`, fingerprint
  `sha256:6a9b8a269d64c570d8a82045a6f3007537f07f121fca2a1d6a65904db21405fa`.
- `git diff --check` är grön. Scan bekräftar inga gamla bokningsimporter, aktiv
  pushimplementation eller `lib -> UI`-testimporter.
- En lokal browser-smoke nådde endast den avsiktliga tenantgränsen: utan lokal
  tenantdata svarar `freshcut.localhost:3000/boka` med 404. Det är inte en
  godkänd bokningsacceptans.

Detta bevisar lokal kompilering och kontrakt, inte fungerande staging eller
produktion. SQL-runtime/samtidighetstester är inte körda lokalt eftersom Docker,
`psql` och Supabase CLI saknas. En extern peer-review kunde inte startas på
maskinen eftersom `jq` saknas.

## Releaseblockerare

1. Kör alla 167 migrationer, SQL/RLS-sviter och samtidighetstester i en disponibel
   databas och därefter i isolerad staging. Observera låstid för indexet i
   `20260804150000`.
2. Staging saknar fortfarande vars/secrets. Sätt den isolerade projektreferensen,
   dess separat nycklar och både staging- och produktionsreferens för workflowets
   hårda spärr; använd aldrig produktionsreferensen i staging.
3. Kör autentiserad browseracceptans med seedad tenant: bokning, avbokning,
   offert, customer portal, admin och providerflöden. Verifiera sedan mobil/design.
4. Senaste lästa produktionscheckpoint är `20260803191057`, medan denna kandidat
   kräver `20260804150000`. Produktionsgrinden ska fortsätta neka tills den
   verkliga migrationshistoriken och fingerprint är verifierade.
5. Omverifiera staging/prod-hostarnas TLS, scheduler-heartbeat och providerdrift
   först efter staging. Ingen av dessa är lokalt bevisad.

## Nästa säkra ordning

1. Commit:a den lokalt verifierade cutovern. Remote publicering väntar på
   uttryckligt godkännande.
2. Kör exakt samma SHA i isolerad staging: backup/PITR-kontroll, migrationer,
   audit SQL, seedad E2E, browseracceptans och teardown.
3. Åtgärda varje stagingavvikelse med en framåtriktad migration eller en ändring i
   dess befintliga ägare; bygg inga parallella ersättningslager.
4. Ta separat GO-beslut för produktionsmigration och deploy först efter grön
   staging och en ny signerad produktionscheckpoint.

## Källor som gäller

- Arbetsregler: `AGENTS.md`
- Arkitektur: `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`
- Aktiv releaseordning: `2-Byggplan/relaunch-local-deploy-readiness-2026-08-04.md`
- Drift: `5-Kod/docs/ops/`
- Slutlig sanning: källkod, migrationer, tester och read-only miljöbevis

Zivar Graph Studio använder Graphify som motor. Grafen väljer vad som ska läsas;
källfiler och tester avgör vad som är sant.
