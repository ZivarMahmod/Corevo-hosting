# Plan 005: Driftgrind — post-deploy-smoke i CD och härdad cron

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- .github/workflows 5-Kod/apps/web/scripts/check_domains.mjs 5-Kod/docs/ops`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (rör deploy-pipelinen — fel här kan blockera deployer; därför
  varje steg bakom egen verifiering och smoke-steget får inte kunna fälla en
  lyckad deploy av MISSTAG, bara larma på riktiga fel)
- **Depends on**: none
- **Category**: dx / lanseringsgrind ("driftbevis")
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Roadmapens lanseringsgrind "domänsmoke och driftbevis" saknar automatik:

1. **Ingen post-deploy-smoke.** `deploy.yml` deployar men verifierar inget efteråt —
   prod-röken körs manuellt och är inte loggad. En trasig deploy upptäcks av kunden.
   Skriptet finns redan (`5-Kod/apps/web/scripts/check_domains.mjs`, exit-kodat för
   CI) men anropas inte i workflown.
2. **Produktionskritisk cron kör på GitHub Actions.** `cron-booking.yml` anropar
   `/api/cron/pending-expiry` + `/api/cron/reminders` var 15:e minut via GH Actions
   `schedule` — som är best-effort (förseningar 15–60+ min under last och stängs av
   TYST efter 60 dagars repo-inaktivitet). Bokningspåminnelser och pending-TTL hänger
   på den.

## Current state

- `.github/workflows/deploy.yml` — deploy-pipelinen (triggas på v*-taggar). Läs hela
  filen innan ändring; sista jobben/stegen är platsen för smoke.
- `.github/workflows/cron-booking.yml` rad 10: `- cron: '*/15 * * * *'` med kommentar
  "(pending-TTL är 30 min)". Workflown anropar cron-rutterna över HTTPS med en
  `CRON_SECRET`-bearer (läs filen för exakt form).
- `.github/workflows/worker-watchdog.yml` — övervakar ENBART Cloudflare Error 1102
  (exceededResources), ingen generell uptime-koll.
- `5-Kod/apps/web/scripts/check_domains.mjs` — domänvalidering, redan exit-kodad
  för CI-bruk.
- Cron-rutterna själva: `5-Kod/apps/web/app/api/cron/pending-expiry/route.ts`,
  `5-Kod/apps/web/app/api/cron/reminders/route.ts` (skyddade av CRON_SECRET;
  ändras inte i denna plan — plan 001 rör pending-expiry-rutten, undvik
  merge-konflikt genom att inte röra rutterna alls här).
- Workern deployas via OpenNext (`@opennextjs/cloudflare` 1.19.11) med
  `wrangler.jsonc`/`wrangler.deploy.json` i `5-Kod/apps/web/`. **VARNING**:
  wrangler-konfigen innehåller live-domänroutes och deploy-läget har kända fällor
  (bare `wrangler deploy` är förbjudet i detta repo — deploy sker via
  `scripts/deploy-prod.mjs`). Du ändrar INTE wrangler-konfig i denna plan utan
  en explicit investigationsslutsats (steg 3) som operatören godkänner.

## Commands you will need

| Purpose   | Command | Expected on success |
|-----------|---------|---------------------|
| YAML-lint | `node -e "require('js-yaml')"` funkar ej här — använd `pnpm dlx yaml-lint <fil>` eller aktionera på GitHubs egen validering | parse OK |
| Tests     | `pnpm test` (från `5-Kod/`) | gröna |
| Smoke lokalt | `node apps/web/scripts/check_domains.mjs` (från `5-Kod/`) | exit 0 mot live |

## Scope

**In scope**:
- `.github/workflows/deploy.yml` (smoke-steg)
- `.github/workflows/cron-booking.yml` (härdning: keepalive + larm)
- `.github/workflows/worker-watchdog.yml` (endast om larmsteget naturligt bor där)
- `5-Kod/docs/ops/` (dokumentation av cron-beslutet)

**Out of scope**:
- `5-Kod/apps/web/wrangler.jsonc` / `wrangler.deploy.json` — deploy-känsliga;
  Cloudflare Cron Triggers-flytten är ett INVESTIGATE-steg, inte en ändring här.
- Cron-rutternas kod (plan 001 äger pending-expiry-rutten).
- `scripts/deploy-prod.mjs` — deploy-vägen ändras inte.
- Sentry/backup-verifiering — manuella operatörssteg, listas i README, inte kod.

## Git workflow

- Direkt på `main`. En commit per steg. Stil: `ci(deploy): post-deploy-smoke` osv.
- Pusha inte utan operatörens klartecken — ändringar i deploy.yml aktiveras vid
  nästa v*-tagg och ska granskas först.

## Steps

### Step 1: Post-deploy-smoke i deploy.yml

Efter det steg som fullbordar deployen: lägg ett smoke-steg som

1. kör `node apps/web/scripts/check_domains.mjs` (working-directory `5-Kod`,
   samma node/pnpm-setup som övriga jobb — kopiera setup-stegen från `ci.yml`
   om deploy-jobbet saknar dem),
2. curl-ar login-sidan på plattformshosten och kräver HTTP 200 + att svaret INTE
   innehåller den kända fel-strängen för fel-host-läget (grep i repot efter
   "salongen inte tillgänglig" för exakt sträng — den är dokumenterad som
   live-blocker #1 i ci.yml:s kommentarer):

```yaml
      - name: Post-deploy smoke
        working-directory: 5-Kod
        run: |
          node apps/web/scripts/check_domains.mjs
          body=$(curl -sS --fail --max-time 30 https://superbooking.corevo.se/login)
          echo "$body" | grep -qi "logga in" || { echo "::error::login-sidan renderar inte"; exit 1; }
```

Smoke-fail ska INTE rulla tillbaka något automatiskt (ingen sådan mekanik finns) —
den ska göra deploy-runet RÖTT så operatören ser det.

**Verify**: workflow-filen parsar (GitHub Actions-validering vid push, eller
`pnpm dlx @action-validator/cli .github/workflows/deploy.yml` om tillgängligt —
annars noggrann YAML-granskning + `git diff`-läsning), och kommandona i steget kör
lokalt: `node apps/web/scripts/check_domains.mjs` → exit 0.

### Step 2: Härda cron-booking.yml mot tyst avstängning

GH Actions stänger av schedule-workflows efter 60 dagars repo-inaktivitet och
levererar best-effort. Utan att flytta cronen ännu:

1. Lägg `workflow_dispatch:` som trigger (manuell nödkörning).
2. Lägg ett larmsteg: om något av curl-anropen mot cron-rutterna failar → gör
   jobbet rött (idag: kontrollera om fel sväljs — läs filen; om `curl` redan är
   `--fail` är detta klart, annars lägg till det).
3. Dokumentera i `5-Kod/docs/ops/` (ny eller befintlig driftfil): cron kör på GH
   Actions, riskerna (fördröjning, 60-dagars-avstängning), och att en repo-commit
   var 60:e dag håller den vid liv.

**Verify**: `grep -n "workflow_dispatch" .github/workflows/cron-booking.yml` → 1 träff;
`grep -n "\-\-fail" .github/workflows/cron-booking.yml` → ≥1 träff per curl.

### Step 3: INVESTIGATE — flytt till Cloudflare Cron Triggers

Undersök (ändra inget): kan workern få `triggers.crons` i wrangler-konfig +
en `scheduled`-handler under OpenNext? Kontrollera `@opennextjs/cloudflare` 1.19.x-
dokumentationen för custom worker-entry/`scheduled`-stöd. Skriv slutsatsen
(GÅR/GÅR EJ/GÅR MED FÖLJANDE STEG, inkl. exakt konfigdiff som skulle krävas) i
`5-Kod/docs/ops/`-notisen från steg 2. Cloudflare Cron Triggers är rätt långsiktiga
hem (garanterad leverans, samma plattform som workern) — men konfigflytten rör den
deploy-känsliga wrangler-filen och ska beslutas av operatören.

**Verify**: notisen innehåller en explicit slutsats med rubriken
"Cloudflare Cron Triggers — utredning".

## Test plan

Ingen appkod ändras — testytan är workflows + skriptkörning:
- `node apps/web/scripts/check_domains.mjs` lokalt → exit 0 (mot live-domänerna).
- `pnpm test` → gröna (ingen regression av misstag).

## Done criteria

- [ ] `deploy.yml` har ett post-deploy-smoke-steg (check_domains + login-probe)
- [ ] `cron-booking.yml` har `workflow_dispatch` + failande curl gör jobbet rött
- [ ] Ops-notis med cron-risker + Cron Triggers-utredning finns i `5-Kod/docs/ops/`
- [ ] `node apps/web/scripts/check_domains.mjs` → exit 0 lokalt
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- `deploy.yml`:s struktur matchar inte antagandet (t.ex. deploy sker i ett jobb
  utan checkout/node — då behöver smoke ett eget jobb med `needs:`; bygg det bara
  om det är entydigt, annars rapportera).
- `check_domains.mjs` kräver hemligheter/miljövariabler som inte finns i
  Actions-miljön — rapportera vilka i stället för att lägga till secrets själv.
- Login-probens förväntade sträng ("logga in"-varianten) finns inte i svaret ens
  när sidan är frisk — justera greppen mot faktisk sida EN gång; failar det igen,
  rapportera.

## Maintenance notes

- När Cron Triggers-utredningen (steg 3) säger GÅR: gör flytten som egen plan —
  wrangler-konfig + deploy-väg är känsliga (kända fällor: bare `wrangler deploy`
  förbjudet, domänroutes i konfig är sanningen).
- Smoke-steget är medvetet minimalt (domäner + login-render). Nästa utbyggnad:
  boka-flödets förstasida per tenant-host och `/api/health` om en sådan byggs.
- Kvarvarande MANUELLA driftbevis-poster (operatören, ej kod): verifiera
  Supabase-plan/backup/PITR + EN restore-övning; sätt SENTRY_DSN i prod och trigga
  testevent; uptime-larm utanför GitHub (t.ex. Cloudflare Health Checks).
