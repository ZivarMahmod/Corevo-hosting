# Domän-automation — kund-domäner auto + ALDRIG nere vid deploy (goal-32)

Hur `<slug>.corevo.se` per salong kopplas automatiskt och överlever 100+ deploys.
Skiljt från `custom-domains-ops.md` (det = kundens EGNA externa domän via CF for
SaaS). Detta = plattformens egna subdomäner på corevo.se-zonen.

## Mekanism (A): config = sanning, automatiserad
- `scripts/gen-deploy-config.mjs` läser aktiva tenants (anon REST,
  `status != 'deleted'`) → lägger till en `custom_domain`-route per
  `<slug>.corevo.se` ovanpå de fasta infra-routarna i `wrangler.jsonc` → skriver
  `wrangler.deploy.json` (gitignored build-artefakt).
- **PROD deployas ENBART via `scripts/deploy-prod.mjs`:** gen → 3-fasta-host-invariant
  (fail-closed) → `wrangler deploy --dry-run` pre-flight → `opennextjs-cloudflare
  deploy -c wrangler.deploy.json`.
- Varje deploy re-asserterar ALLA kund-domäner → en deploy kan aldrig detacha en
  levande salong. `<slug>.corevo.se` = första-nivå-subdomän → **gratis Universal SSL
  `*.corevo.se`-cert** (ingen Advanced Cert-kostnad — därför INTE `<slug>.boka...`).

### ⚠️ Footgun
En **bare** `wrangler deploy` (eller `opennextjs-cloudflare deploy` utan `-c
wrangler.deploy.json`) skickar bara de fasta routarna i `wrangler.jsonc` och
**detachar alla kund-domäner** (FX-14, deploy-runbook §3.1). Deploya ALDRIG prod
förbi `deploy-prod.mjs`. CI (`deploy.yml` prod-jobb) MÅSTE kalla `deploy-prod.mjs`.

### Borttagning = bara manuell radering
Generatorn filtrerar `status != 'deleted'`. En domän försvinner FÖRST när salongen
soft-deletas (RLS-döljer den för anon-läsningen) → nästa deploy utelämnar den. En
deploy ENSAM tar aldrig bort någon. Suspendering rör den inte.

## Instant-attach vid onboarding (DORMANT — kräver ops-token)
`lib/cloudflare/worker-domains.ts` + `attachWorkerSubdomain()` i `createTenant`
försöker koppla `<slug>.corevo.se` OMEDELBART vid onboarding (utan att vänta på
nästa deploy) via Cloudflare **Workers Domains**-API. Den är **fail-closed + av i
prod**: utan token/flagga är anropet en no-op och domänen blir live vid nästa deploy
istället. Onboarding blockeras eller faller ALDRIG på detta.

**Aktivera (ops) — bara om du vill ha live-på-sekunden istället för live-vid-deploy:**
1. CF API-token (My Profile → API Tokens → Create Custom) med scope:
   **Account → Workers Scripts → Edit** + **Zone → DNS → Edit** + **Zone → Zone →
   Read** på `corevo.se`. (Bredare än SSL/Certs-token i `custom-domains-ops.md`; en
   token kan bära bägge scope-uppsättningarna.)
2. Worker-secrets (kör i `5-Kod/apps/web`):
   ```
   wrangler secret put CF_API_TOKEN        # token ovan
   wrangler secret put CF_ACCOUNT_ID       # 0be2655be66efbfa5d9b36721ddae008
   wrangler secret put CF_ZONE_ID          # corevo.se-zonens id
   ```
3. Sätt `DOMAIN_AUTOATTACH_ENABLED=true` som var i `wrangler.jsonc` → redeploy via
   `deploy-prod.mjs`. Av = `false`/ta bort → no-op igen (koden orörd).

> Även med instant-attach PÅ är (A) fortfarande sanningen: domänen står i DB → varje
> deploy re-asserterar den. Instant-attach är bara "blir live nu" istället för "blir
> live vid nästa deploy".

## Vakt: `scripts/check_domains.mjs` (offline)
Listar aktiva tenants → assertar att var och en svarar på `<slug>.corevo.se` + att de
3 fasta hostarna (booking/superbooking/minbooking) lever. Larmar (exit 1) vid drift.
Kör efter varje prod-deploy: `node scripts/check_domains.mjs`.

## Rollback
- `pnpm exec wrangler rollback <version-id>` (re-pointar trafik, ingen rebuild).
- Mekanism av: ta bort gen-steget → bare deploy `wrangler.jsonc` (statiska routes).
- Throwaway-test-tenant: `delete from public.tenants where slug = '<slug>'` (cascade)
  → nästa deploy släpper domänen.
