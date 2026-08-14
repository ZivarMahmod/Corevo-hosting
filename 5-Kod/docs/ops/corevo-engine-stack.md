# Corevo Engine Stack — drift och rollback

Den här runbooken gäller de generiska motorerna. Domänägarna och deras
befintliga runbooks fortsätter gälla.

## Releasegrind

1. Bekräfta exakt `main`-SHA och ren, relevant release-diff.
2. Jämför hela lokal och live migration history read-only och kör schemaaudit.
3. Bekräfta backup. PITR får inte antas vara aktivt utan separat bevis.
4. Kör fokuserade tester, fulla appgrindar och Worker dry-run/storleksgrind.
5. Deploya med repots deployskript, aldrig bare Wrangler.
6. Kör auth-, tenant-, scheduler-, queue-, billing- och provider-smoke för
   den fas som släpps.
7. Kräv två gröna Cloudflare-cykler innan fasen accepteras.

Rapportera lokal, CI, migration, deploy och liveacceptans separat. En route,
port eller konfigurationsfil är inte livebevis.

## Observability

- Nuvarande säkra läge: strukturerade logs 100 procent, invocation logs
  avstängda och native traces avstängda.
- Aktivera inte tracing medan replaybara capabilities finns i request-URL:er.
  Tracing kan accepteras först när capabilities har flyttats bort eller en
  verifierad redaktion före Cloudflares persistens finns. Kör då ett
  kontrollerat 100-procentsfönster och sänk till 5 procent efter verifiering.
- Stäng tracing genom Wrangler-konfiguration och en vanlig deploy.
- OTLP-destination tas bort separat i Cloudflare. Skapa ingen destination eller
  ny kostnad utan godkännande.
- Befintlig logger och Sentry-envelope behålls tills en extern destination är
  verifierad och ersättningen har ett eget beslut.

## Refine

- Rollback är code revert av tjänstesidans provider, hooks och formulär.
- Refine-fasen har inga datamigrationer.
- Server actions, guards och RLS fortsätter fungera utan Refine.

## Queue

- Stoppa konsumtion genom att ta bort `generic-jobs` ur schedulerlistan och
  deploya. Ta inte bort kö, messages eller failed-review-historik.
- Replay sker först efter att jobbeffekten har verifierats idempotent.
- `anon` och `authenticated` ska fortsatt sakna execute/råtabellåtkomst.

## Billing

- Sätt `STRIPE_PLATFORM_BILLING_MODE=off` och deploya för omedelbart stopp.
- Utkast kan granskas, korrigeras eller tas bort manuellt. V1 får inte
  finalisera, skicka eller debitera automatiskt.
- Radera inte periodledger eller webhookevent vid rollback; de är audit- och
  dubblettskydd.
- Connect-klient, Connect-webhook och direct charges får inte ändras av
  billing-rollback.

Additiva tabeller, events och köhistorik raderas inte vid rollback. Eventuell
schemajustering görs med en ny framåtriktad migration efter read-only inventering.
