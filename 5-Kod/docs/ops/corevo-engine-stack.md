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

### Aktivering

1. Skapa en Stripe-webhook för **Your account**, inte Connected accounts, mot
   `https://booking.corevo.se/api/stripe/platform-billing/webhook`.
2. Begränsa endpointen till `invoice.created`, `invoice.updated`,
   `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`,
   `invoice.voided`, `invoice.marked_uncollectible` och `invoice.deleted`.
3. Sätt Worker-secrets `STRIPE_PLATFORM_BILLING_SECRET_KEY` och
   `STRIPE_PLATFORM_BILLING_WEBHOOK_SECRET`. Behåll dessutom testnyckeln som
   `STRIPE_PLATFORM_BILLING_TEST_SECRET_KEY` under övergången till `draft`, så
   redan köade testevents kan stämmas av med rätt Stripe-konto. De får inte återanvända
   Connect-webhookens secret.
4. Sätt mode `test`, deploya och skapa ett testutkast från `/fakturering`.
   Kontrollera ledgerbelopp, Stripe-total, tenant, period, org.nr och att
   fakturan är `draft` med `auto_advance=false`.
5. Kontrollera att duplicerade och omvända webhookevent ger en ledger-effekt,
   att `corevo_jobs` arkiveras och att failed-review är tom.
6. Före varje byte av Billing-mode, API-key eller webhook-secret: verifiera att
   `pgmq.q_corevo_jobs` är tom och att `private.corevo_job_failed_review` saknar
   billingfel. Vänta in två gröna scheduler-cykler.
7. Byt till `draft` först när live-kundens juridiska fakturauppgifter har
   verifierats i Stripe. Live-key krävs; kodgrinden nekar testnyckel i detta
   läge.

Den aktiva Workern hade 2026-08-14 inga Stripe-secrets. `off` är därför det
enda verifierade produktionsläget tills stegen ovan har genomförts. V1 har
ingen kodväg för finalize, send eller pay.

Additiva tabeller, events och köhistorik raderas inte vid rollback. Eventuell
schemajustering görs med en ny framåtriktad migration efter read-only inventering.
