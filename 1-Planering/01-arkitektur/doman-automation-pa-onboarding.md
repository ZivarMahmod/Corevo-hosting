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

### Deploy-vägen wired (blockare-fix efter F1–F4)
Standard- + CI-deploy går nu genom `deploy-prod.mjs` (annars hade nästa `pnpm deploy`
/ CI-tag bare-deployat `wrangler.jsonc` och detachat ALLA kund-domäner — inkl
test-barber som nu är DB-driven):
- `package.json` `"deploy"` = `opennextjs-cloudflare build && node scripts/deploy-prod.mjs`.
- `.github/workflows/deploy.yml` prod-steg = `pnpm --filter @corevo/web exec node
  scripts/deploy-prod.mjs` (ej bare `wrangler deploy`).
- ⚠️ **Ops-check (ej verifierbar i denna körning):** CI-`CLOUDFLARE_API_TOKEN` måste
  ha **Zone DNS:Edit** på corevo.se utöver Workers Scripts/Routes:Edit, annars 403 när
  wrangler ska SKAPA DNS-posten för en NY `<slug>.corevo.se`. Mina prod-deploys denna
  körning gick via Zivars breda OAuth-token (funkade); CI-token-scopet är en pre-flight.

### F3 inloggad render — ÄRLIGT KVAR
`/domaner` route-gating (307) verifierad, men **inloggad render + 0 console-fel är EJ
verifierad** i denna autonoma körning (inga platform-admin-creds / service-role-nyckel
tillgänglig för att minta en session). Lämnas till Cowork/Nördens oberoende verify.

### Slutläge (UPPDATERAS av fix-33 — se UTFALL-FX nedan)
> ⚠️ Detta slutläge stämde INTE: `test-barber.corevo.se` var i själva verket
> DETACHED (NXDOMAIN) — inte live. Rättat slutläge står i UTFALL-FX5.

Prod-worker `f5348d21` (3 fasta + wildcard + test-barber). Filer: F2
`lib/cloudflare/worker-domains.ts`(+test), `actions.ts`; F3 `lib/platform/
domain-overview.ts`, `components/platform/DomainOverview.tsx`, `app/(platform)/
domaner/page.tsx`, nav; F4 `scripts/check_domains.mjs`; ops `docs/ops/
doman-automation-ops.md`. Gates alla gröna (vitest 404 · tsc 0 · lint 0 · opennext
build · grep-guard ren). Cowork/Nörden gör oberoende live-verify (två deploys, ny
onboarding, inloggad /domaner) — lita ej på "klart".

---

## UTFALL-FX1 — diagnos av `test-barber.corevo.se`-felet (fix-33, 2026-06-16)

### Vad som faktiskt felar (mätt, inte gissat)
- **HTTP/DNS:** `curl https://test-barber.corevo.se/` → `Could not resolve host`
  (**NXDOMAIN**) — inte ens 530. (Granskaren såg 530 tidigare; nu finns ingen
  DNS alls. Båda är samma grundfel: domänen är inte kopplad.)
- **DNS-post i `corevo.se`-zonen (CF API `GET /zones/<id>/dns_records?name=test-barber.corevo.se`):**
  **tom (`[]`)** — ingen post finns. Kontrast: `minbooking.corevo.se` har den av
  Workers hanterade posten `AAAA 100:: (proxied)` → den svarar 307 (frisk).
- **Worker custom-domain-bindning (CF API `GET /accounts/<id>/workers/domains`):**
  listar ENDAST `booking` / `superbooking` / `minbooking` på `corevo.se`-zonen
  (service `bokningsplatformen`). **`test-barber.corevo.se` saknas helt** i listan.
- **Slutsats:** test-barber har VARKEN worker-bindning ELLER DNS-post → domänen är
  **DETACHED**. Den var live genom goal-32 deploy #1/#2 (probe 200), så den blev
  **bortkopplad efteråt** — den skapades aldrig "halvt".

### Varför detachad (rotorsak)
- **test-barber är `status=active` i DB** (anon REST: `[{slug:"test-barber",status:"active"}]`),
  så generatorn (`gen-deploy-config.mjs`) **tar med** dess `custom_domain`-route i
  `wrangler.deploy.json`. Config-sidan är alltså korrekt — felet sitter i att en
  deploy gått FÖRBI den genererade configen.
- **Detach-vektorn = en deploy mot bara `wrangler.jsonc`** (som listar enbart de 4
  fasta infra-routarna). En sådan deploy reconcilar workern till de 4 → **tar bort
  test-barbers bindning + dess hanterade DNS-post** (FX-14-beteendet). Koden är NU
  rutad genom `deploy-prod.mjs` (commit `33d03cd`: `package.json` + CI prod-jobb),
  MEN **`docs/ops/deploy-runbook.md` §3/§3.1 dokumenterar fortfarande prod som bare
  `wrangler deploy` (top-level)** → en människa som följer runbooken bare-deployar
  och detachar varje DB-driven kund-domän. Det är den osealade vektorn (→ FX2).

### Token-frågan (granskarens hypotes: deploy-token saknar `Zone DNS:Edit`)
- **Wrangler-auth nu:** Zivars OAuth (`zivar68@gmail.com`). Scopes inkluderar
  `workers (write)`, `workers_routes (write)`, `workers_scripts (write)`,
  `ssl_certs (write)` — men zonen endast `zone (read)` (ingen separat DNS-write-grant).
- **MEN diskriminerande bevis pekar bort från token-hypotesen:** en HELT NY
  `<slug>.corevo.se` (`g32demo`) blev live genom EXAKT denna OAuth + `deploy-prod.mjs`
  i goal-32 (deploy #3, 200 efter ~50s cert). Workers Custom Domains hanterar sin
  DNS-post UNDER Workers-produkten (inte via en fristående `dns_records:edit`-grant),
  så credentialet/vägen *kan* skapa worker-custom-domains. → **Lead-hypotes:
  engångs-detach (H2), inte token-scope (H1).**
- **ÖPPEN fråga (avgörs i FX3, inte i förväg):** lyckas `deploy-prod.mjs` RE-ATTACHa
  test-barber med nuvarande token? **Om attach failar med behörighetsfel** → H1
  bekräftas → batcha token-uppgift till Zivar (Workers Scripts:Edit + Zone DNS:Edit
  + Zone:Read, ENBART `corevo.se`) och stanna med "kör om FX3–FX4 när token finns".
  **Om attach lyckas** → H2 bekräftad, fixen = seala bare-deploy-doc-vektorn (FX2).

### Friska (ingen regression — verifierat samma mätning)
`booking.corevo.se` 307 · `superbooking.corevo.se` 307 · `minbooking.corevo.se` 307 ·
`corevo.se` (POS) 200. Endast test-barber är drabbad.

---

## UTFALL-FX2 — detach-vektorn sealad (fix-33, 2026-06-16)
Rotorsaken (en deploy förbi `wrangler.deploy.json` detachar DB-drivna kund-domäner)
hade **kod-vägen redan sealad** i commit `33d03cd` (`package.json` `deploy` +
`.github/workflows/deploy.yml` prod-jobb → båda `node scripts/deploy-prod.mjs`).
Grep-svep bekräftar: inga andra automatiska `wrangler deploy`-anrop mot prod;
staging-jobbet (`deploy.yml:83`) är `--env staging` (workers.dev, `routes: []`) →
kan inte detacha prod-domäner. **Kvarvarande öppen vektor = den DOKUMENTERADE
människo-vägen:** `5-Kod/docs/ops/deploy-runbook.md` §3/§3.1 sa fortfarande
"`wrangler deploy` (top-level)" för prod. **Nu rättat** (commit `4416502`): §3 prod =
`deploy-prod.mjs`; §3.1 beskriver bare deploy som DET som detachar kund-domäner +
mandaterar `check_domains` efter varje deploy. `check_domains` fångar redan NXDOMAIN
(fetch-throw → `ok:false`) och 530 (status ≥ 500 → `ok:false`) → ingen ny guard
byggd; luckan var operationell (den kördes inte efter den detachande deployen).

## UTFALL-FX3 — re-attach + live, bevisat på riktig deploy (fix-33, 2026-06-16)
Sanktionerad väg: ASCII-bygge (C:\tmp\kod, ö-path-workaround) → `node
scripts/deploy-prod.mjs` (gen → invariant → dry-run → `opennextjs-cloudflare deploy
-c wrangler.deploy.json`). Generatorn skrev 5 routes (3 fasta + boka-wildcard +
`test-barber.corevo.se`).

| Bevis (efter Deploy #1, worker `c1b7628e-52bc-4bc7-9c5f-7be6e50a618c`) | Värde |
|---|---|
| Deploy-triggers publicerade | `test-barber.corevo.se (custom domain)` + 3 fasta + `*.boka` |
| CF worker-bindning (`GET /accounts/<id>/workers/domains`) | `test-barber.corevo.se → bokningsplatformen` ✓ |
| CF DNS (`GET /zones/<id>/dns_records?name=test-barber.corevo.se`) | `AAAA 100:: (proxied)` ✓ (samma form som minbooking) |
| HTTP `https://test-barber.corevo.se/` | **200**, `x-corevo-tenant-kind: tenant` |
| `check_domains` | **ALL UP (exit 0)** |
| 3 fasta + POS | booking 307 · superbooking 307 · minbooking 307 · `corevo.se` 200 |

→ **Token-frågan avgjord empiriskt:** nuvarande OAuth (`zivar68`, `zone (read)`, ingen
separat DNS-write) attachade kund-domänen **utan behörighetsfel**. H1 (token-scope)
**motbevisad**; H2 (engångs-detach, re-attachbar) **bekräftad**. → **Ingen ny CF-token
behövs, ingen Zivar-ops-uppgift.** (Workers Custom Domains hanterar sin DNS under
Workers-produkten, inte via `dns_records:edit` — som g32demo redan antydde.)

## UTFALL-FX4 — överlever en efterföljande deploy (det som NO-GO:ade) (fix-33, 2026-06-16)
Deploy #2, worker `9ae34d87-620a-4aea-a481-d9faae1c0d66` (idempotent re-assert, inget
"already exists"-fel): `test-barber.corevo.se` → **fortfarande 200** (`kind: tenant`).
`check_domains` → **ALL UP (exit 0)** efter BÅDA deploys. 3 fasta + POS = 200/307 hela
vägen genom båda. → Garantin "kund-domän blir live OCH överlever nästa deploy" är nu
**bevisad på riktig prod-deploy** (inte motbevisad som i goal-32:s slutläge).

## UTFALL-FX5 — rättat slutläge + citat
- **Falskt i goal-32:** "Slutläge: prod-worker `f5348d21` (3 fasta + wildcard +
  test-barber)" implicerade att test-barber var live — den var DETACHED (NXDOMAIN).
  F1-tabellens "test-barber 200 genom 2 deploys" stämde vid den mätningen men höll
  inte i `f5348d21`-slutläget. **Sant slutläge nu:** prod-worker
  `9ae34d87-620a-4aea-a481-d9faae1c0d66`, `test-barber.corevo.se` = **200 live**,
  re-attachad + överlevande deploy, bevisat ovan (FX3/FX4).
- **"Phantom-sökväg":** granskaren flaggade citatet `deploy-runbook.md §3.1` som
  saknad/fel. Verifierat: filen finns på `5-Kod/docs/ops/deploy-runbook.md` och §3.1
  finns (rubrik "Safe deploy — deploys must never tear down domains/vars (FX-14)").
  Citatet är korrekt; §3.1 är dessutom uppdaterad (FX2) så den nu pekar på
  `deploy-prod.mjs` istället för bare deploy.
- **Rollback om något fallerar:** `pnpm exec wrangler rollback c1b7628e` (FX3-läge) /
  `9ae34d87` (FX4-läge) / `51cd64a2` (goal-32-baslinje). Inga DB-ändringar i fix-33.
