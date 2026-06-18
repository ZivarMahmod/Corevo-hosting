> ✅ **KLAR + DETACH-BEVISAD 2026-06-18.** Tidigare "BYGGD men EJ detach-bevisad" — nu BEVISAD på riktig prod-deploy: `deploy-prod.mjs` (validator committad⊇live + dry-run + publish-gate m. CF-token) kördes 2× i prod (sajtbyggare-go-live, worker v `f972a15c`/`dd0e8902`), **`test-barber.corevo.se` = 200 EFTER varje deploy — domänen detachades INTE.** Deploy-vägen är detach-säker. Doc flyttad ur 2-Byggplan-roten → klart/08-fixar.

# fix-35 — Kund-subdomäner i wrangler.jsonc (deploy-safe, build-once-never-delete)
Thinking: ⚫ (rör prod-deploy + LIVE kund-domäner. Fel = kund nere. Rollback obligatorisk. Zivar-OK före kod: GIVET 2026-06-17.)

**Datum:** 2026-06-17
**Typ:** Autonom fix-order för Claude Code — körs via /goal.
**Beslut (Zivar 2026-06-17):** (1) En ny kund läggs till **UTAN deploy** — `<slug>.corevo.se` attachas live via CF Workers Domains API. (2) Källan-till-sanning flyttas DB-genererad (goal-32) → **committad `wrangler.jsonc`** så en framtida deploy aldrig sopar bort en attachad domän. Att skriva raden i filen är en **commit, INTE en deploy**.

## Mål
En ny kund läggs till **utan en ny deployment**: scriptet attachar `<slug>.corevo.se` via **CF Workers Domains API** (`attachWorkerSubdomain`, finns) → live på sekunder, ingen worker-redeploy. Samma script skriver in subdomänen som en committad `custom_domain`-route i `wrangler.jsonc` så en FRAMTIDA deploy (för annan kod) re-asserterar den och **aldrig sopar bort den** — det steget är en commit, INTE en deploy. Resultat: lägg till kund = 1 manuellt kommando, live direkt, **noll flimmer på befintliga**. Manuell väg nu; onboarding-auto senare (samma funktion, scaffoldas).

## Lägeskoppling
Fix på goal-32 (`goal-32-auto-doman-deploy-proof.md`) + fix-33 (`fix-33-doman-530-deploy-proof.md`). Stänger flimmer-buggen Code flaggade i goal-34 / `1-Planering/06-sajtbyggare/S1-UTFALL.md`. Blockerar inget pågående bygge. När verifierad → `2-Byggplan/klart/08-fixar/`.

## Kontext — varför (ärlig root cause)
- **Symptom:** kund-domän (`test-barber.corevo.se`) detachas/går ner vid deploy ("ner och upp").
- **Code:s teori (opennext "andra publicering utan -c") = motbevisad.** `@opennextjs/cloudflare` 1.19.11-källan (`dist/cli/commands/deploy.js` + `utils/utils.js` `getWranglerArgs`) vidarebefordrar `--config` korrekt → EN publish av huvud-workern, med rätt config. "Två versioner" = normalt opennext (upload + aktivera), ej en config-lös publish. fix-33 avfärdade dessutom token-hypotesen (OAuth-attach gick utan rättighetsfel).
- **Verklig svaghet (oavsett vilken körning som triggade):** den DB-genererade vägen (`gen-deploy-config.mjs` → `wrangler.deploy.json`) är skör. Två failure-modes:
  1. En bare `wrangler deploy` utgår från `wrangler.jsonc` (utan kund-domäner) → detach.
  2. Anon-läsningen i `fetchActiveSlugs` ser bara `status='active'` (RLS-policy `tenants_public_read = USING (status='active')`), medan queryn filtrerar `status=neq.deleted` → en `paused` salong faller **tyst** bort ur configen → detach. (Verifierat mot prod-DB `clylvowtowbtotrahuad` 2026-06-17.)
- **Fixen tar bort BÅDA:** lägg kund-domänerna direkt i committad `wrangler.jsonc`. Då finns de i den enda config varje deploy utgår från — ingen DB-läsning, ingen bare-deploy-lucka. Samma princip som de 3 fasta hostarna (booking/superbooking/minbooking), som aldrig går ner. Build-once-never-delete, i filen.
- **Token:** en NY subdomän måste få proxied DNS-post + cert vid första deployen → kräver `CLOUDFLARE_API_TOKEN` med **Zone DNS:Edit**. Zivars nya token (skapas 2026-06-17) har scope: Workers Scripts:Edit · Workers R2:Edit · Workers Routes:Edit · **DNS:Edit** · Zone:Read, zon = `corevo.se`. Befintliga domäner re-asserteras utan DNS-skapande.

## Berörda filer
- `5-Kod/apps/web/scripts/add-domain.mjs` — **NY.** Lägger `<slug>.corevo.se` i top-level `routes[]` i wrangler.jsonc, kommentar-bevarande, idempotent.
- `5-Kod/apps/web/scripts/add-domain.test.mjs` — **NY.** Enhetstester (Vitest).
- `5-Kod/apps/web/wrangler.jsonc` — kund-domäner skrivs hit. `test-barber.corevo.se` läggs in permanent. **Top-level `routes`; `env.staging.routes` förblir `[]`.**
- `5-Kod/apps/web/scripts/gen-deploy-config.mjs` — **REPURPOSE:** generator → validator (assert att varje aktiv tenants `<slug>.corevo.se` finns i wrangler.jsonc; FAIL annars). Radera ej koden.
- `5-Kod/apps/web/scripts/deploy-prod.mjs` — deployen utgår från `wrangler.jsonc` (med kund-domäner); kör validatorn som fail-closed pre-flight.
- `5-Kod/docs/ops/deploy-runbook.md` — uppdatera §3.1: källan = `wrangler.jsonc` (ej DB-gen); add-domain-flödet; token-scope (DNS:Edit KRÄVS nu för ny subdomän).

## Steg
1. **`add-domain.mjs` — `node scripts/add-domain.mjs <slug>` (gör BÅDE live-attach OCH fil-skydd):**
   - Normalisera slug (trim/lowercase); avbryt på tom eller `RESERVED`-label (återbruk listan från `gen-deploy-config.mjs`).
   - **(a) Live NU, ingen deploy:** attacha `<slug>.corevo.se` mot workern via CF Workers Domains API (PUT `/accounts/{id}/workers/domains`, återbruk `attachWorkerSubdomain`-logiken; idempotent PUT = re-attach är no-op). Läs CF-creds från env (`CLOUDFLARE_API_TOKEN` + account-id + zone-id). Kund live på sekunder utan redeploy.
   - **(b) Skydda mot framtida deploy:** om `<slug>.corevo.se` ej redan i top-level `routes[]` → infoga `{ "pattern": "<slug>.corevo.se", "custom_domain": true }` via **jsonc-parser `modify` + `applyEdits`** (bevarar kommentarer/format). Idempotent.
   - Assert efter infogning: de 3 fasta hostarna + `*.boka.corevo.se/*`-wildcarden kvar; mönstret är aldrig `*.corevo.se`. Brott → skriv inget, exit 1.
   - Logga: "✓ live nu via API · rad tillagd i wrangler.jsonc → **committa** för att skydda över framtida deploys (commit ≠ deploy)."
2. **`test-barber` permanent:** kör scriptet för `test-barber` → committa `wrangler.jsonc` med raden inne. Den slutar bero på DB-genereringen.
3. **`gen-deploy-config.mjs` → validator (CF-live vs fil — fångar en attachad domän som glömts i filen):**
   - Ändra `main()` så den **inte längre skriver `wrangler.deploy.json` som deploy-källa**. Istället: lista LIVE worker-domäner (`listWorkerDomains`, finns) + aktiva tenants, och assertera att varje live kund-domän OCH varje aktiv/pausad salongs `<slug>.corevo.se` finns i wrangler.jsonc top-level routes. Saknas någon → tydligt fel + exit 1 (**stoppa deployen så den inte sopar bort en live domän som bara lades till via API men aldrig committades**).
   - **RLS-fällan:** läs tenants så att `paused` INTE tappas (anon ser bara `active`). Använd service-role-läsning (CI har nyckeln) ELLER en dedikerad RPC — aldrig tyst hoppa över.
4. **`deploy-prod.mjs`:** deploya `wrangler.jsonc` direkt (kund-domäner ligger där). Kör validatorn (steg 3) som fail-closed pre-flight. Behåll dry-run + fasta-host-assertionen.
5. **Onboarding-auto (SCAFFOLD, dormant — bygg ej live):** extrahera infoga-logiken till en delad funktion. Notera i kod + runbook att live-workern INTE kan skriva `wrangler.jsonc` (serverless, ingen repo-access) → auto-vägen blir senare: onboarding → CF API instant-attach (`lib/cloudflare/worker-domains.ts` `attachWorkerSubdomain`, finns) + en CI/skript-sync som skriver `wrangler.jsonc`. Lämna tydlig TODO.
6. **Tester (`add-domain.test.mjs`):** idempotent; avvisar reserved; bevarar fasta hostar + kommentarer; vägrar `*.corevo.se`; infogar i top-level, ej staging.

## Verifiering (klar när — bevisat på riktig deploy, INGET flimmer)
- [ ] `node scripts/add-domain.mjs test-barber` → wrangler.jsonc har raden, kommentarer intakta, fasta hostar kvar. Kör 2× = ingen dubblett.
- [ ] Validatorn FAILar om en aktiv salong saknas i filen (testa med en fejk-slug).
- [ ] Deploy (sanktionerad väg) → `test-barber.corevo.se` = **200 FÖRE och EFTER**. `check_domains` ALL UP (exit 0).
- [ ] **EN deploy till** → fortfarande **200** (överlever). Proba under/efter: befintlig domän gick ALDRIG ner.
- [ ] booking/superbooking/minbooking + POS `corevo.se` = 200 hela vägen (ingen regression).
- [ ] Gates: vitest grönt (nya tester med), tsc 0, lint 0, opennext build PASS, grep-guard ren. Worker-version + rollback-id noterade.

## Anti-patterns
- ALDRIG `JSON.parse`+`stringify` på `wrangler.jsonc` → dödar kommentarerna (FX-14-motiveringen). Använd jsonc-parser comment-preserving edit.
- ALDRIG `*.corevo.se` (fångar POS-subdomäner på delad zon → POS nere). Bara per-slug + `*.boka.corevo.se`.
- Rör ALDRIG de 3 fasta hostarna / POS / boka-wildcarden / `env.staging.routes` (`[]`).
- Radera ej `gen-deploy-config` — repurpose (build-once-never-delete).
- Python: **nej.** Node `.mjs` (repo-konsistens, CI har node ej python).
- Stäng ej fixen utan FX-bevis på **2 riktiga deploys** (test-barber 200 hela vägen).

## Kopplingar
goal-32 (DB-gen, ersatt som källa), fix-33 (530/detach-historik), goal-16/goal-23 (custom domains / DomänPanel), `worker-domains.ts` (`attachWorkerSubdomain` för framtida instant-attach), `check_domains.mjs` (post-deploy-grind).

## Rollback
`git revert` av commiten + `wrangler rollback <förra-version-id>` (noteras vid deploy). Inga destruktiva DB-ändringar (validatorn är read-only mot DB).

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper "gick aldrig ner" från antagande → mätning, stänger RLS-fällan med egen vakt, och låser kontraktet för den delade infoga-funktionen NU. Behåller hela SCOPE ovan — detta är acceptans + DoD, inte ny scope.

### 1. Kontinuerlig proba UNDER deploy-fönstret (mät uptime, anta den inte)
- [ ] **Poll genom HELA deployen, inte bara två stillbilder.** En probe som curlar en befintlig kunddomän (`test-barber.corevo.se`) **var ~2:e sekund från strax före `deploy-prod.mjs` startar tills `check_domains` ALL UP** — inte bara 200 FÖRE + 200 EFTER. Två stillbilder missar exakt det flimmer-fönster goal-34/S1-UTFALL flaggade.
- [ ] **Resultatet är ett mätvärde, inte en känsla:** logga varje sample (tidsstämpel + HTTP-status) → **0 icke-2xx-samples under hela fönstret = grön**. Ett enda 5xx/530/connection-fail under deployen = FAIL (fixen är inte klar). Bevara samplet i FX-beviset (klistra in i `klart/08-fixar/`-noten).
- [ ] **Kör mot minst en BEFINTLIG kunddomän** (inte den nyligen attachade) — poängen är att en orelaterad deploy aldrig nuddar redan-live domäner. Probe-scriptet är read-only (bara GET), idempotent, och får köras 2× utan sidoeffekt.
- [ ] Probe-loggen ska visa kontinuitet ÖVER båda de 2 sanktionerade deployerna (steg i Verifiering ovan) — inte en deploy isolerat.

### 2. Explicit testfall för en `paused` salong (RLS-fällan som egen regressionsvakt)
- [ ] **Dedikerad regressionsvakt för paused-domäner** — inte underförstådd i validatorn. Testfall: en salong med `status='paused'` ska **ses av validatorns service-role-läsning** men **INTE av anon-policyn** (`tenants_public_read = USING (status='active')`). Validatorn får ALDRIG tyst tappa en paused-domän ur configen.
- [ ] **Bevisa båda sidor av fällan:** (a) service-role-läsningen returnerar paused-salongen → dess `<slug>.corevo.se` krävs i wrangler.jsonc; (b) en anon-läsning av samma query returnerar den INTE (visar varför den gamla DB-gen-vägen detachade). Asserta diffen explicit — det är hela root-causen från rad 19.
- [ ] **Negativt fall:** paused-salong vars `<slug>.corevo.se` saknas i filen → validatorn FAILar (exit 1) med tydligt meddelande som namnger slugen och dess status. Tyst skip = bugg.
- [ ] Testet är read-only mot DB (eller mot en mock/fixtur som speglar RLS-beteendet) och får köras i CI utan att mutera prod.

### 3. Kontrakt för den delade infoga-funktionen (lås signatur + anropsplatser NU)
- [ ] **Definiera funktionen en gång, återbruk överallt** — så onboarding-auto + CI-sync inte blir en refaktor senare (steg 5 scaffold konsumerar detta kontrakt).
- [ ] **Signatur (lås nu):** `upsertCustomDomainRoute(wranglerPath: string, slug: string): { added: boolean; pattern: string }` — comment-preserving (jsonc-parser `modify`+`applyEdits`), idempotent (`added=false` när raden redan finns), vägrar reserved-label + `*.corevo.se`, rör aldrig de 3 fasta hostarna / POS / boka-wildcarden / `env.staging.routes`. Ren fil-funktion, ingen nätverks-/DB-bieffekt (live-attach är separat).
- [ ] **Anropsplatser (dokumentera kopplingen i kod + runbook):**
  - `add-domain.mjs` steg (b) — manuella vägen idag.
  - **goal-32:s `attachWorkerSubdomain`** (`lib/cloudflare/worker-domains.ts`) — live-attachen och fil-skyddet är två separata steg som BÅDA hängs på samma slug; kontraktet säger explicit: attach = nät (live nu), `upsertCustomDomainRoute` = fil (commit ≠ deploy). Notera paret i runbooken så ingen tror attach räcker.
  - **Framtida onboarding-auto** — onboarding → `attachWorkerSubdomain` (instant) + `upsertCustomDomainRoute` via CI/skript-sync (live-workern kan ej skriva repo). TODO i koden pekar hit.
  - **CI-sync / validator** (`gen-deploy-config.mjs` repurposed) — assert-vägen läser samma kontrakt (vilka routes SKA finnas) som infoga-vägen skriver. En sanning, två riktningar.
- [ ] Kontraktet committas med fixen (signatur + JSDoc + TODO för auto-vägen) även om onboarding-auto förblir dormant — så det aldrig blir en senare refaktor.

### Kulturkrav (oförändrade — gäller maxningen med)
- [ ] Idempotent: allt ovan körbart 2× = ingen dubblett, ingen sidoeffekt.
- [ ] Kommentarer + de 3 fasta hostarna + POS `corevo.se` + `*.boka.corevo.se` bevarade; mönstret aldrig `*.corevo.se`; reserved-labels vägrade.
- [ ] Gates gröna (vitest inkl. paused-vakten + kontrakts-testet, tsc 0, lint 0, opennext build PASS, grep-guard ren). Worker-version + rollback-id noterade vid deploy.
- [ ] 3 fasta hostar (booking/superbooking/minbooking) + POS `corevo.se` = **200 hela vägen** = 200 (ingen regression).

## ⬆️ UPPDATERING 2026-06-17 (B) — FX-14 2-fas EMPIRISKT bekräftad + självläkande skyddsnät
> Code rentvådde alla andra teorier 2026-06-17: token HAR `DNS:Edit` + `Routes:Edit` + `Scripts:Edit` (Zivar visade), `gen-deploy-config` producerar rätt (test-barber med), `opennextjs-cloudflare deploy` har äkta `-c/--config`. Kvar = **opennexts interna fler-stegs-publicering**: ett internt steg rör workern UTAN `-c` → routes nollställs till `wrangler.jsonc` (bara fasta hostar) → kund-domän tappas. FX-14 "2-fas", i deploy-VERKTYGET. **(Rättar rad 16: 2-fas-teorin är nu BEKRÄFTAD, inte motbevisad.)**

**Varför fix-35:s kärna ändå löser det:** 2:a fasen faller tillbaka på `wrangler.jsonc`. Lägg kund-domänerna DÄR (denna fix) → 2:a fasen **behåller** dem (precis som de 3 fasta hostarna) → ingen detach, ingen flimmer. Ingen jakt på exakt opennext-sub-steg behövs.

**Belt-and-suspenders (lägg in i `deploy-prod.mjs`, Steg 4):** ett självläkande efter-steg EFTER opennext-deployen som re-asserterar domänerna — antingen `wrangler deploy -c wrangler.deploy.json` (bart wrangler = en-fas, honorerar `-c`) ELLER en idempotent CF-API re-attach-loop över DB-domänerna (token duger). Domänerna sätts då ALLTID tillbaka i samma deploy, även om wrangler.jsonc-vägen mot förmodan inte räcker. Flimmer-proben (Maxning §1) verifierar 0 nedtid över hela fönstret.
