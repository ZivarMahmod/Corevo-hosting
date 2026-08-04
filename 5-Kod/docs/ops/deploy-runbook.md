# Deploy och rollback

Det här är den kanoniska releasevägen. Inga pushes till `main` deployar
automatiskt.

## Releasegrind

En produktionrelease kräver:

1. lyckad CI på exakt samma SHA,
2. granskad produktionsdatabas och uppdaterad
   `production-schema-checkpoint.json`,
3. matchande `PROD_DB_MIGRATION` i GitHub-miljön,
4. konfigurerade GitHub- och Worker-secrets,
5. godkännande i GitHub-miljön `production`.

Kör lokalt från `5-Kod/` före release:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Berörda ytor körs därefter som autentiserad browseracceptans mot rätt miljö.
CI kör dessutom databas-/RLS-tester och kontrollerar Worker-bundlens storlek.

## Staging

Staging startas endast manuellt i `.github/workflows/deploy.yml` och körs bara
när `ISOLATED_STAGING_READY=true`. Workflowen applicerar migrationer på det
isolerade stagingprojektet, bygger OpenNext och deployar med
`wrangler --env staging`.

## Produktion

Produktion startas med en `v*`-tagg eller ett manuellt production-val i samma
workflow. Produktionsmigrationer körs och verifieras separat; deploy-workflowen
applicerar dem aldrig.

Workflowen bygger OpenNext och publicerar endast genom:

```text
cd 5-Kod/apps/web
node scripts/deploy-prod.mjs
```

Kör aldrig en bar `wrangler deploy` mot produktion. För en lokal validering utan
publicering:

```text
cd 5-Kod/apps/web
node scripts/deploy-prod.mjs --dry-run
```

## Domäner

Standardstorefronten använder `*.boka.corevo.se/*`. Fasta plattformshostar,
wildcard-routen och kvarvarande legacy-domäner som är direkt kopplade till
Workern ska finnas i `wrangler.jsonc`. `deploy-prod.mjs` verifierar den listan
mot Cloudflares Worker Domains före publicering.

Worker-routen provisionerar inte ensam TLS för den djupa hosten
`<slug>.boka.corevo.se`. `node apps/web/scripts/check_domains.mjs` måste vara helt
grön före release; TLS-fel på en kanonisk tenanthost är en blockerare även om en
legacy-domän svarar.

Egna kunddomäner som provisioneras via Cloudflare for SaaS är Custom Hostnames,
inte Worker-routes, och ska därför inte läggas i `wrangler.jsonc`. Stäm av deras
live-status separat under releaseinventeringen och följ
[runbooken för egna domäner](custom-domains-ops.md).

## Kontroll efter release

Verifiera minst:

- en verklig tenant på `<slug>.boka.corevo.se`,
- plattformsinloggningen,
- kundportalen,
- en bokning och dess notifierings-/betalningsstatus,
- att registrerade egna domäner fortfarande svarar.

Ett svarande Worker-hostnamn är inte tillräckligt releasebevis.

## Rollback

Worker:

```text
cd 5-Kod/apps/web
pnpm exec wrangler deployments list
pnpm exec wrangler rollback <last-good-version-id>
```

Kod återställs med en ny korrigerande commit/tagg. En applicerad
databasmigration redigeras aldrig; använd en framåtriktad kompensationsmigration
eller dokumenterad PITR enligt `backup-restore.md`.
