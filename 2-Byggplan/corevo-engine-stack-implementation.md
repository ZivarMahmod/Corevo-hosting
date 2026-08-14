# Corevo Engine Stack — aktiv byggplan

Beslutad 2026-08-14. Arbetet sker i samma checkout på
`codex/corevo-engine-stack`, skapad från `main` efter motion-merge
`fc3abc72976e42389485c9e20a9c676224673d21`.

## Fas 0 — baslinje

- Ersätt preliminärt motorunderlag med arkitekturbeslut, denna byggplan och en
  drift-/rollback-runbook.
- Verifiera repo, migration history, backup, PGMQ, pg_cron, Cloudflare och
  Stripe utan att mutera externa system.
- Kör fokuserade tester och full baseline från `5-Kod/`.

Verifierad startpunkt 2026-08-14: Supabase-projektet är aktivt på Pro,
dagliga backuper finns, PITR-status är inte verifierad, `pgmq` 1.5.1 är
installerad utan köer och aktiva `pg_cron`-jobb har lyckade senaste körningar.
Produktionen saknar repoets additiva motionmigration `20260810090000`.
Wranglers lokala Cloudflare-token är ogiltig, så live Worker-plan och
observability verifieras via godkänd CI/deploy. Stripe Billing-secrets är
inte verifierade och billing ska därför vara `off` som default.

## Fas 1 — observability

- Deklarera Cloudflare logs explicit med 100 procent sampling och stäng av
  invocation logs, så att request-URL:er inte persistieras av plattformen.
- Håll native traces explicit avstängda medan replaybara gäst- och
  kundcapabilities finns i URL:er. Aktivera tracing först när de har flyttats
  bort eller en verifierad redaktion före Cloudflares persistens finns; kör då
  ett kontrollerat 100-procentsfönster och sänk därefter till 5 procent.
- Verifiera strukturerade scheduler-, Supabase- och R2-händelser utan PII,
  tokens eller secrets.
- Behåll befintlig logger och Sentry-envelope. OTLP läggs inte till innan
  aktuell Workers-plan och eventuell kostnad har godkänts.

## Fas 2 — tjänster

- Montera Refine endast på den guardade tjänstesidan och registrera endast
  resursen `services`.
- Låt en fail-closed Data Provider anropa befintliga server actions och
  kanoniska läsare; okända resurser och operationer nekas.
- Dela ett Zod-schema mellan React Hook Form och server actions.
- Migrera create, edit, toggle och delete utan att ändra befintlig Drawer,
  Table, PillToggle, toast, fokus, mobil eller storefront-invalidation.
- Ta bort ersatta `useActionState`-grenar när sista operationen är flyttad.

## Fas 3 — generiska jobb

- Skapa privata `corevo_jobs` i PGMQ, service-role-only RPC:er och en privat
  failed-review-ledger.
- Acceptera endast `{ v: 1, type: "stripe.billing.reconcile", eventId,
  objectId }` och tekniska ID:n.
- Lägg `/api/cron/generic-jobs` sist i befintlig scheduler med batch 10,
  visibility 120 sekunder, routetimeout 60 sekunder och max 8 försök.
- Arkivera efter lyckad effekt. Okänd version eller typ registreras för review
  och arkiveras utan retry-loop.
- Låt `pg_cron` äga pending-expiry efter verifierade DB-körningar; endpointen
  och GitHub-fallbacken behålls som nödräls under stabilisering.

## Fas 4 — Stripe fakturautkast

- Behåll Connect-klient och Connect-webhook oförändrade.
- Inför separat plattforms-Billing-klient, webhook-secret och mode
  `off|test|draft`; plattformsanrop saknar connected-account-scope.
- Skapa privat periodledger med unik tenant/period och prissnapshot.
- Återanvänd `monthlyFeeCents`; operatören skapar endast utkast.
- Deduplikera webhookevent, enqueuea reconcile atomiskt och låt konsumenten
  hämta aktuellt Stripeobjekt innan ledgern uppdateras.
- Finalisering, utskick, debitering, subscriptions, usage meters och automatisk
  accessavstängning ingår inte.

## Grind per fas

Kör fokuserade tester samt `pnpm test`, `pnpm typecheck`, `pnpm lint` och
`pnpm build`. Före live-deploy krävs migration parity/checkpoint, Worker
dry-run/storleksgrind, exakt `main`-SHA och efterdeploy-smoke. En fas är inte
klar förrän två Cloudflare-cykler är gröna, köålder är under 30 minuter och
notification/refund-health saknar regression där fasen berör dessa flöden.
