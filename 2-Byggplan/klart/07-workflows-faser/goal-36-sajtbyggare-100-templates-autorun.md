# goal-36 — Sajtbyggare: bygg + optimera ALLA ~100 templates (autonom run)

> Run-spec för en autonom loop som tar varje template i katalogen, gör den till en
> sajtbyggare-template (render-bridge-manifest + data-editable regioner + booking-aware),
> optimerar mot design-kanon, och **render-bevisar 0 FAIL** innan nästa. Loopar tills alla klara.
> Bakom flagga `SAJTBYGGARE_ENABLED` — prod orörd tills batch verifierad.

## 0) VISIONEN (syntetiserad ur underlaget 2026-06-17 — Zivar, korrigera bara om nåt är fel)
> Källor: `1-Planering/06-sajtbyggare/00-DESIGN-sajtbyggare.md` §1 · `…/01-INRIKTNING-LAST-visuell-innehalls-editor.md`
> (**LÅST**, går FÖRE 00 på editor-scopet, bekräftad av dig 2026-06-16 "Ja exakt — kör på det") ·
> `…/02-RITNING-v3-moduler-storefront.md` · `4-Dokument-Underlag/01-acceptans/01-BASELINE.md`.

1. **En mall = exakt vendor-utseende.** Tenant (salong/restaurang/klinik…) väljer en färdig mall och ser den
   EXAKT som originalet i live-preview — vi hårdkodar ingen mall. (00-DESIGN §1)
2. **Visuell innehålls-editor, INTE page-builder.** Klicka direkt på elementet → ändra live: bild→byt,
   text→skriv om, färg/font/logo→ändra. Allt på EN yta. Inga drag-drop-block, inga egna sidor/sektioner
   från noll. **Redigerbara regioner DEFINIERAS av mallen** → kunden kan inte söndra layouten. (01-INRIKTNING, LÅST)
3. **Editor-motor = eget litet "klicka-på-elementet"-overlay** ovanpå mallen: **TipTap** (inline-text) +
   **egen R2-bildväljare** + färg/font/logo som tokens i sidopanel. **GrapesJS är FÖRKASTAD** (page-builder =
   fel modell). **Render-BRON är keepern** — mallen renderar troget med levande moduler invävda. (01-INRIKTNING)
4. **Fylls i onboardingen, slår igenom UTAN deploy.** Kundens sida är klar när hen skapas; ändringar är
   runtime (som färg/font redan funkar idag). (01-INRIKTNING)
5. **Riktiga Corevo-moduler invävda** på rätt plats: **7 LIVE** (booking, shop, offert, lojalitet, presentkort,
   blogg +1) byggs/justeras till **design-trohet mot v3**; **8 roadmap rörs ej & raderas ej**. **Booking ska bli
   bransch-medveten** (bord/party_size) = enda riktiga nybygget. Utseende-källa = LAG:
   `01-acceptans/super-admin/preview.jsx` (`Mod*`) + `kund-admin/surfaces-*.jsx`. (02-RITNING)
6. **Slutprodukt = kundens publika sajt på `<slug>.corevo.se`** med riktig bokning inuti. White-label,
   EN databas / EN kodbas, isolering per `tenant_id`. **DB (`clylvowtowbtotrahuad`) vinner** vid krock. (01-BASELINE)
7. **De ~100 mallarna** ger bredden av designer; varje görs distinkt per bransch via ui-ux-pro-max (§4),
   men **design-kanon vinner alla konflikter** (exakt-kopia-regeln).

## 1) LÄS FÖRST (vision + kanon — i denna ordning, HELA)
1. `HANDOFF.md` (nuläge + hårda regler) och `CLAUDE.md` (arbetssätt + filplacering).
2. `1-Planering/06-sajtbyggare/` — ALLA: `00-DESIGN-sajtbyggare.md`, `01-INRIKTNING-...md`,
   `02-RITNING-v3-moduler-storefront.md`, `AUTOMATION-scripts.md`, `S0-UTFALL.md`, `S1-UTFALL.md`.
3. **Design-kanon:** `4-Dokument-Underlag/01-acceptans/` — `00-LÄS-FÖRST.md`, `01-BASELINE.md`,
   `02-Arkitektur-sanning.md`, samt `kund-admin/ super-admin/ standalone/`. **Paketet = LAG.**
4. Motorn: `5-Kod/apps/web/lib/sajtbyggare/` (render-bridge, manifest/, marker, resolve, flag,
   booking-mount) + `5-Kod/apps/web/app/sajtbyggare-spike/`. Förstå render-bron INNAN du rör templates.
5. Katalogen: `4-Dokument-Underlag/03-template-katalog/` — numrerade `01 … 100` = arbetslistan.

## 2) MÅL / DEFINITION OF DONE
- Varje template i katalogen (numrerade `01`–`100`) blir en fungerande sajtbyggare-template:
  render-bridge-manifest + `data-editable`-regioner (3 lager: Universal→Bransch→Kund) + booking-mount.
- **Optimerad mot din vision (§0) + design-kanon (§1.3)** — exakt kopia av kanon-värden, aldrig improviserat.
- Per-bransch distinkt design-system via **ui-ux-pro-max** (se §4).
- **"Klart" = mekaniskt 0 FAIL** via projektets accept-specer/probe (render-bevis), aldrig ögonmått.
- Allt bakom `SAJTBYGGABLE_ENABLED`/`SAJTBYGGARE_ENABLED`-flaggan. Prod inte deployad i denna run
  om inte Zivar explicit OK:ar — bygg + verifiera + commit, deploy är separat beslut.

## 3) PER-TEMPLATE PIPELINE (kör för varje, en i taget → verifiera → nästa)
1. **Klassificera** bransch/vertikal (barber, spa, nagel, klinik, gym, restaurang …) ur mappnamn + innehåll.
2. **Design-system:** kör ui-ux-pro-max (§4) för den vertikalen → style/palett/font/effekter/anti-patterns.
3. **Bygg** render-bridge-manifest + markera `data-editable`-regioner + booking-mount (mönster: `manifest/salvia.ts`).
4. **Optimera** mot design-kanon (§1.3) + vision (§0): exakta px/hex/font ur kanon, aldrig re-härled.
5. **Render-bevisa:** DOM-render-proof (mönster: `marked-regions.dom.test.ts`, `salvia.test.ts`) + accept/probe.
   0 FAIL krävs. **Oberoende verify** — verifieraren rättar inte sin egen läxa (separat agent/pass).
6. **Commit** (en template = en commit, conv-format). Markera klar i TRACKER (§5).

## 4) ui-ux-pro-max (design-DB, web-stack)
- Skill finns; motorn stödjer web: `--stack nextjs` / `react` / `shadcn` / `html-tailwind` (verifierat).
- Per template: `python3 <plugin>/src/ui-ux-pro-max/scripts/search.py "<bransch nyckelord>" --design-system --stack nextjs`
- Använd dess val som UTGÅNGSPUNKT; **design-kanon (§1.3) vinner alla konflikter** (exakt-kopia-regeln).
- Python finns (3.14.1).

## 5) TRACKER (durabel checklista — överlever compact/session)
- Skapa/uppdatera `1-Planering/06-sajtbyggare/100-TEMPLATES-TRACKER.md`: en rad per template
  `NN namn | bransch | status(TODO/BYGGD/VERIFIERAD 0FAIL/COMMIT <sha>) | ev. KVAR`.
- Loopen läser trackern först → tar nästa `TODO/KVAR` → kör pipeline → uppdaterar raden. Idempotent.

## 6) LOOP-DRIVE (autonomt tills alla 100 klara)
- Driver: `/loop` (self-paced) ELLER `/ralph-loop` ELLER inbyggd `Workflow`-batchning (ultracode på).
- **Batcha** via `Workflow`: fan-out N templates → pipeline-stage per template (design→bygg→verify),
  oberoende verify-stage, dedup/commit. Loopa batch→batch tills trackern = 0 kvar.
- Auto-compact sköts av runtime; använd `context-mode` + `strategic-compact` för långa körningar.
- **Stoppvillkor:** alla `01`–`100` = `VERIFIERAD 0FAIL` + committad i trackern. Då: sammanfatta, stopp.

## 7) HÅRDA REGLER (bryts ej)
- **Design = EXAKT kopia, aldrig improvisera** (18h brann förr). Kanon = LAG.
- **Status-honesty:** säg "klart" ENDAST vid mekaniskt 0 FAIL; annars rapportera bara KVAR, terse.
- **En template i taget → verifiera → markera klar.** Build-once-never-delete.
- **Filplacering:** inget i repo-roten; nya filer i rätt mapp (CLAUDE.md-tabellen).
- **POS-guardrail** på corevo.se, `private.tenant_id()`, `staff/staff_id` — rör ej.
- **Deploy ≠ del av denna run** utan explicit Zivar-OK (deploy detacharar kunddomäner, se minnet).

## 8) FÖRSTA STEGET NÄR RUN STARTAR
Läs §1 i sin helhet → bygg TRACKER (§5) ur katalogen → välj template `01` → kör §3-pipeline →
0 FAIL → commit → nästa. Fråga INTE om lov mellan templates; loopa tills §6-stoppvillkor.

## 9) ISOLERING & SAMORDNING (kör vid sidan av övriga goals)
- **Egen branch/worktree** (`sajtbyggare-100-templates`), bakom flaggan → stör inte annat arbete. Deploy separat (Zivar-OK).
- **Rör BARA:** katalog-ingest + nya per-template manifest-filer under `5-Kod/apps/web/lib/sajtbyggare/templates/`
  (+ matchande render-proof-tester) + trackern. Append, build-once-never-delete.
- **READ-ONLY kontrakt — ändra EJ unilateralt:** `manifest/types.ts` (region-schema), `render-bridge.tsx`,
  `booking-mount`, flaggan. Behövs ny region-typ → STOPP, notera i trackern för goal-37-samordning, forka inte schemat.
- **Krockar EJ med:** domän/deploy-goals (30/32/33/35), admin-dörrar (27/28), onboarding-steg5 (fix-25),
  refund (fix-26) — helt andra filområden, rör dem inte.
- **Grannar (sekventiellt beroende):** **goal-37** (editor-motor) redigerar de regioner du PRODUCERAR; **goal-38**
  (onboarding) erbjuder mallarna. Håll region-markup till det delade kontraktet så 37/38 "bara funkar" —
  du levererar mallar + regioner, INTE editorn (det är goal-37) och INTE onboarding-wiring (det är goal-38).

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
> Skärper §2 (DoD) och §3 (pipeline) utan att ändra SCOPE: fortfarande ~100-template autorun.
> Tre hål täpps: (a) loopa inte mot ett antaget "100", (b) tomma gröna mot inga assertions,
> (c) tyst blockering när en template kräver schema-utökning. Kanon (`4-Dokument-Underlag/01-acceptans/`) = LAG.

### M1) Assertera katalogens FAKTISKA count FÖRST (innan loopen ens börjar)
- **Räkna riktiga template-mappar i `4-Dokument-Underlag/03-template-katalog/` — anta ALDRIG 100.** Loopens
  arbetslista byggs ur den faktiska katalogen, inte ur siffran i rubriken. `~100` är en uppskattning, inte ett kontrakt.
- **Hantera oregelbundenheter EXPLICIT — skippa + logga, räkna bara dugliga:**
  - **Trasig** (saknar förväntad mall-fil/innehåll, tom mapp) → `SKIPPAD: trasig` i trackern, räknas EJ som byggbar.
  - **Dubbel** (samma vertikal/mall två gånger, dubblerat namn) → behåll en, `SKIPPAD: dubblett av NN` på den andra.
  - **Icke-numrerad** (bryter `NN namn`-mönstret) → ta med men flagga `ONUMRERAD` så ordningen är spårbar, hoppa inte tyst.
- **DoD-rad:** trackern (§5) inleds med en **manifest-rad** `KATALOG: <N> hittade · <B> byggbara · <S> skippade (skäl)`.
  Stoppvillkoret (§6) refererar **`<B>` byggbara**, INTE 100. "Klart" = alla `<B>` = `VERIFIERAD 0FAIL`, skippade redovisade.

### M2) Per-template render-proof-SPEC (annars är "0 FAIL" en tom grön)
- **Varje template MÅSTE ha template-SPECIFIKA assertions** — en generell smoke-test som bara kollar "renderar utan krasch"
  räknas INTE som verifierad. 0 FAIL mot noll meningsfulla assertions = falsk grön. Detta är samma fälla som "känns nära" (→62%).
- **Proofen genereras per template ur en kort `proof-spec` (deklareras bredvid manifestet, t.ex. `templates/<namn>.proof.ts`)
  som låser exakt:**
  1. **Vilka `data-editable`-regioner** som ska finnas (id + lager Universal/Bransch/Kund + typ) — assertas mot DOM-render
     (mönster: `marked-regions.dom.test.ts`). Antal OCH identiteter, inte bara "minst en".
  2. **Vilken booking-variant** mallen monterar (bransch-medveten: bord/party_size vs tid/staff) — assertas mot booking-mount.
  3. **Vilken kanon-mall** den mappar mot (`01-acceptans/...`) + de exakta px/hex/font-värden som lyfts DÄRIFRÅN
     (aldrig re-härledda) — assertas så drift från kanon = FAIL.
- **DoD-rad:** ingen template markeras `VERIFIERAD 0FAIL` utan att dess `proof-spec` finns, är icke-trivial (≥ regioner+booking+kanon-mappning),
  och kördes grön. **Oberoende verify** (§3.5) granskar att proof-specen faktiskt asserterar mallens unika regioner — inte en kopia-paste-stub.

### M3) Eskaleringsväg när en template kräver schema-utökning (loopen blockeras inte tyst)
- **Trigger:** en template behöver en region-typ som inte finns i `manifest/types.ts` (READ-ONLY-kontraktet, §9).
  Forka ALDRIG schemat unilateralt och improvisera ALDRIG fram en egen typ för att "få grönt".
- **Loopens beslut = HOPPA + FLAGGA + FORTSÄTT (mjuk skip, ej hård stopp på hela runet):**
  - Markera template `BLOCKERAD: kräver region-typ <X> i types.ts` i trackern (med vilken kanon-region som kräver den).
  - **Fortsätt direkt till nästa template** — en blockerad mall får inte stoppa de andra ~99 tyst på template ~30.
  - Samla alla blockerade i en **`BLOCKERAD (schema)`-sektion** i trackern för **goal-37-samordning** (schemat ägs där).
  - **Detta preciserar §9:s "STOPP"** = stoppa BYGGET AV DENNA MALL (hoppa + flagga), INTE hela runet. (`<namn>.proof.ts`
    ligger i §9:s tillåtna skriv-scope "matchande render-proof-tester" — rör fortfarande EJ READ-ONLY-kontraktet.)
- **Hård stopp gäller BARA** om READ-ONLY-kontraktet faktiskt måste brytas för att gå vidare — då stopp + fråga Zivar,
  aldrig tyst patcha `types.ts`/`render-bridge.tsx`/`booking-mount`/flaggan.
- **DoD-rad:** runet räknas klart även med blockerade mallar OM varje blockerad rad är redovisad med skäl + krävd typ;
  stoppvillkoret (§6) blir: alla byggbara `<B>` = `VERIFIERAD 0FAIL` ELLER `BLOCKERAD (schema)` med flagga — inga tysta hål.
