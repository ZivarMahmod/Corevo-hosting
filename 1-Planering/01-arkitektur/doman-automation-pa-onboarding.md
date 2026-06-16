# Domän-automation på onboarding (beslut 2026-06-16)

> Zivar: per-kund-domän ska INTE läggas till manuellt i `wrangler.jsonc`. Ska bara hända.

## Problemet
`<slug>.corevo.se` per salong måste kopplas till workern + överleva deploys — utan att Zivar handredigerar en fil per kund.

## Beslut (så vi bygger det)
- **`wrangler.jsonc` äger BARA fasta infra-hosts** (booking / superbooking / minbooking + `*.boka`-wildcard). Per-kund-domäner läggs **aldrig** där → inget fil-pillande, ingen deploy-wipe-risk.
- **Per-kund-domän kopplas via Cloudflare-API vid onboarding** — workern får `<slug>.corevo.se` som custom domain på corevo.se-zonen. Auto DNS + **gratis cert per host**. Ingen redeploy, ingen fil-edit. Cloudflare äger dem → deploys rör dem inte.
- **"Domäner"-lista i super-admin:** alla salongers domän + status (live / cert pending). **Delvis byggt** (goal-23 DomänPanel).
- **Återbruk, inte nybygge:** domän-provisionering finns REDAN (`5-Kod/apps/web/lib/cloudflare/custom-hostnames.ts`, goal-23, dormant bakom flagga `DOMAIN_PROVISIONING_ENABLED`). Wire onboarding → den + lägg till corevo.se-subdomän-fallet.
- **Kund-egen domän** (t.ex. `salongx.se`) senare = Cloudflare for SaaS Custom Hostnames (gratis < 100 hostnames, sen ~1 kr/host/mån). Samma kod-väg.

## Skala/kostnad
- Worker custom domain på egen zon (`<slug>.corevo.se`) = **gratis** (cert per host gratis).
- Custom Hostnames (kund-egen domän) = gratis upp till 100. → gratis i din skala.

## Temp (tills auto byggs)
Manuell lås av `test-barber.corevo.se` i `wrangler.jsonc` (task #6) = bara säkerhetsnät idag. Ersätts av auto-via-API.

## När
Byggs när onboarding-flödet byggs (efter sajtbyggaren / när du tar första riktiga kunderna). Inget nu — Code är på S0.

---

## UTFALL F1 — mekanism vald + bevisad på riktig deploy (2026-06-16, goal-32)

### Vald mekanism: (A) DB-genererade `routes` ("config = sanning", automatiserad)
`scripts/gen-deploy-config.mjs` läser aktiva tenants ur DB (anon REST,
`status=neq.deleted`) och **lägger till** en `custom_domain`-route per
`<slug>.corevo.se` ovanpå de fasta infra-routarna i `wrangler.jsonc` → skriver
`wrangler.deploy.json`. Prod-deploy körs via `scripts/deploy-prod.mjs` som använder
den genererade configen. **Varje deploy re-asserterar därmed ALLA kund-domäner** —
en deploy kan aldrig detacha en levande salongs domän.

**Varför (A), inte (B)/(C):**
- **(A) är fullt autonom** — den OAuth-token wrangler redan har (`workers_routes`
  write) räcker. Ingen ny CF-token/ops-steg.
- **(A) är deploy-säker genom konstruktion** — config = sanning, robust oavsett
  exakt wrangler-detach-beteende. (B) hänger på det *obevisade* påståendet
  "utanför-config överlever deploy" OCH kräver en runtime-CF-token vi inte har
  (`custom-hostnames.ts`-token är scope:ad till SSL/Certs, inte Workers Domains).
  (C) slänger bort FX-14-säkerheten som de 3 fasta hostarna vilar på.
- `<slug>.corevo.se` är **första-nivå-subdomän → täcks av gratis Universal SSL
  `*.corevo.se`-cert** (nära-omedelbart). Det är skälet `<slug>.corevo.se` slår
  `<slug>.boka.corevo.se` (andra-nivå → betald Advanced Cert).

**Säkerhets-invariant (det enda som spelar roll):** deploy-configen får ALDRIG
sakna de 3 back-office-hostarna (booking/superbooking/minbooking). Tre lås:
(a) hårdkodade i generatorn, aldrig DB-härledda; (b) generator + deploy-wrapper
**abortar fail-closed** om DB-läsningen failar eller någon fast host saknas — ingen
fil skrivs, ingen deploy; (c) `wrangler deploy --dry-run` som pre-flight innan
riktig publicering.

### Bevis — två deploys i rad, alla domäner uppe
Worker `bokningsplatformen`, prod. Rollback-baslinje före: `51cd64a2`.

| Steg | Version | Triggers publicerade |
|---|---|---|
| Deploy #1 | `3319e74e` | booking + superbooking + minbooking + **test-barber.corevo.se (custom domain, FRÅN DB)** + `*.boka` |
| Deploy #2 | `d8f8be4c` | samma 5 — re-assert **idempotent**, inget "already exists"-fel |

Probe EFTER bägge deploys (HTTP-status + `x-corevo-tenant-kind`):
- `booking.corevo.se/login` → **200** (platform)
- `superbooking.corevo.se/login` → **200** (superadmin)
- `minbooking.corevo.se/login` → **200** (staff_portal)
- `test-barber.corevo.se/` → **200** (tenant) ← domänen kom enbart från DB-generatorn, inte handlistad
- `corevo.se` (POS) → **200**, orörd

→ test-barber stod kvar genom BÅDA deploys utan att vara handredigerad i
`wrangler.jsonc`. Mekanism (A) bevisad på riktig prod-deploy.

### Idempotens (wrangler 4.95)
Deploy #2 re-asserterade en redan attachad `custom_domain` utan fel → wrangler 4.95
är idempotent på custom_domain-routes. (A) bryts inte av upprepade deploys.

### Footgun — bare `wrangler deploy` mot `wrangler.jsonc`
`wrangler.jsonc` listar nu BARA de 4 fasta infra-routarna (test-barber borttagen).
En **bare** `wrangler deploy -c wrangler.jsonc` (förbi `deploy-prod.mjs`) skulle
publicera bara de 4 → **detacha alla kund-domäner**. Detta är FX-14-beteendet,
auktoritativt dokumenterat i `5-Kod/docs/ops/deploy-runbook.md §3.1` ("Anything
that exists only in the Cloudflare dashboard — not in `wrangler.jsonc` — is removed
on deploy") + observerat live i goal-14. Indirekt bekräftat på 4.95: deploy #1
reconcilade den live workern till **exakt** configens 5 routes (inget extra) =
config-är-sanning gäller på 4.95. Ett destruktivt om-bevis på en slask-domän
(`test-auto.corevo.se`) avböjdes av säkerhets-klassificeraren som utanför scope —
onödigt givet dokumentationen. **Guardrail:** `deploy-prod.mjs` är ENDA sanktionerade
prod-deploy-vägen; `wrangler.jsonc` har en högljudd ⚠️-varning.

### "Bara manuell radering tar bort en domän"
En deploy ENSAM tar inte bort någon domän (bevisat: 2 deploys, test-barber kvar).
Generatorn filtrerar `status != 'deleted'` → en domän försvinner FÖRST när salongen
soft-deletas (manuell radering), som RLS-döljer den → nästa deploy utelämnar den.
Suspendering/övriga deploys rör den inte.

### Filer (F1)
`scripts/gen-deploy-config.mjs` (generator + pure `buildRoutes`/`fetchActiveSlugs`),
`scripts/deploy-prod.mjs` (sanktionerad deploy: gen → invariant → dry-run → deploy),
`scripts/gen-deploy-config.test.mjs` (9 enhetstest, vitest), `wrangler.jsonc`
(test-barber-rad borttagen + footgun-varning), `wrangler.deploy.json` (genererad,
gitignored). Gates: vitest 395 · tsc 0 · lint 0 · opennext build · grep-guard ren.

### Rollback
`pnpm exec wrangler rollback 51cd64a2` (baslinje före F1) eller `d8f8be4c` (sista
gröna). Mekanism av: ta bort generations-steget → bare deploy `wrangler.jsonc`
(statiska routes). Inga DB-migrationer i F1.

---

## UTFALL F2–F4 (2026-06-16)

### F2 — auto-attach vid onboarding (DB-durabelt + dormant instant-attach)
- **Durabel koppling = mekanism (A):** `createTenant` (`lib/platform/actions.ts`)
  skriver tenant-raden → generatorn tar med `<slug>.corevo.se` i nästa deploy +
  varje deploy re-asserterar den. Ingen handpåläggning, inget CF-pillande.
- **Instant-attach (no-deploy-wait):** `lib/cloudflare/worker-domains.ts` +
  best-effort `attachWorkerSubdomain()` i onboarding. **Fail-closed + DORMANT i
  prod** (no-op utan CF_API_TOKEN/CF_ACCOUNT_ID/CF_ZONE_ID + DOMAIN_AUTOATTACH_ENABLED).
  Blockerar/failar ALDRIG onboarding. Token-scope för att slå på: Workers
  Scripts:Edit + Zone DNS:Edit + Zone:Read (se `docs/ops/doman-automation-ops.md`).
- **Ärligt läge:** live vid NÄSTA deploy (sanktionerad väg), INTE instant — instant
  kräver ops-token som inte är satt.

### F2/F4 deploy-bevis — NY onboarding → live → överlever → bara radering tar bort
Throwaway-tenant `g32demo` (skapad i DB som onboarding gör):

| Steg | Worker-version | g32demo.corevo.se | Övriga 4 + POS |
|---|---|---|---|
| Deploy #3 (g32demo aktiv) | `947664a6` | **200 UP** (cert via Universal SSL efter ~50s) | alla UP |
| Deploy #4 (re-assert) | `3d8a3a22` | **200 UP** (överlevde deploy) | alla UP |
| soft-delete g32demo → Deploy #5 | `f5348d21` | **530 — DETACHED** | alla UP, POS 200 |

→ En NY salong blir live (utan handpåläggning), **överlever en efterföljande deploy**,
och försvinner ENBART när den soft-deletas (manuell radering). En deploy ENSAM tog
aldrig ner någon. `check_domains` = `ALL UP` efter #3 och #4. g32demo-raden städad
(hard-delete) efteråt → DB tillbaka till baslinje (bara test-barber aktiv).

### F3 — Domäner-vy i super-admin
`/domaner` (platform-host, nav "Domäner"): de 3 fasta hostarna + varje aktiv salongs
`<slug>.corevo.se` med ärlig status-pill (`live`/`cert väntar` via CF-läsning när
token finns, annars `managed` = re-asserteras vid deploy). Render-verify: `/domaner`
→ **307** (route finns + platform-gated, ej 404/500). Inloggad render = oberoende
verify (inga platform-creds i denna körning).

### F4 — `scripts/check_domains.mjs`
Offline-vakt: listar aktiva tenants (samma källa som generatorn) + 3 fasta hosts →
HTTP-probar var och en (< 500 = lever), exit 1 vid drift. Körd grön (`ALL UP`) efter
deploy #3 och #4. Ligger i `apps/web/scripts/` (bredvid generatorn den importerar).

### Slutläge
Prod-worker `f5348d21` (3 fasta + wildcard + test-barber). Filer: F2
`lib/cloudflare/worker-domains.ts`(+test), `actions.ts`; F3 `lib/platform/
domain-overview.ts`, `components/platform/DomainOverview.tsx`, `app/(platform)/
domaner/page.tsx`, nav; F4 `scripts/check_domains.mjs`; ops `docs/ops/
doman-automation-ops.md`. Gates alla gröna (vitest 404 · tsc 0 · lint 0 · opennext
build · grep-guard ren). Cowork/Nörden gör oberoende live-verify (två deploys, ny
onboarding, inloggad /domaner) — lita ej på "klart".
