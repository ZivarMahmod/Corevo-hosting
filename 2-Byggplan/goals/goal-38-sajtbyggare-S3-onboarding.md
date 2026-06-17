# goal-38 — Sajtbyggare S3: onboarding-integration
Thinking: 🔴 (rör onboarding-flödet som skapar kunder + sajtbyggar-editorn. BLOCKERAD av goal-37/S2 — får INTE startas innan S2 är verifierad klar. Flagga AV i prod tills klar. Zivar-OK före kod KRÄVS.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. **Får ej startas förrän goal-37 (S2) är verifierad klar.**
**Beslut (källa):** `1-Planering/06-sajtbyggare/01-INRIKTNING-LAST-visuell-innehalls-editor.md` (LÅST inriktning, Zivar 2026-06-16: "Ja, exakt — kör på det"). S3 där = "in i onboardingen: tema + branding + bilder + texter fylls i SAMMA editor under onboarding." Plus `ROADMAP-2026-06-17-hela-vagen.md` Fas C: "S3 — onboarding-integration: tema + branding + bilder + texter fylls i SAMMA editor under sign-up."

## Mål
Under onboarding (när en ny kund/salong skapas) fyller man **tema + branding (färg/font/logo) + bilder + texter i SAMMA visuella editor som S2** — **allt-på-EN-plats**, inte utspritt på separata wizard-steg ("Temamall" + "Token-branding" + texter var för sig). Operatören (Zivar idag) väljer mall, klickar direkt på rubrik/bild/färg/font/logo → ändrar → ser live → sparar. När kunden är skapad är **sidan redan klar** ("kundens sida är klar när hen skapas", INRIKTNING). Editorn som monteras i onboardingen är **exakt S2:s editor återanvänd** (samma overlay + samma spara-väg + samma region-manifest) — inte en andra, parallell editor. Kundens ifyllda värden landar som **Kund-nivå-overrides** ovanpå Bransch/Universal i S1:s 3-nivå-kaskad (`resolveSiteContent`), med härkomst-badge `modifierad` precis som i S1. Slår igenom **utan deploy** (runtime, som färg/font redan gör). Flagga AV i prod (`SAJTBYGGARE_ENABLED="false"`) tills hela kedjan S1→S2→S3 är verifierad.

## Lägeskoppling
**Fas C i `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md`** (Sajtbyggare-editor): S1 (datalager) klart → S2 (visuell editor-motor) → **S3 (onboarding-integration) = denna goal**.
- **🔴 BLOCKERAS AV goal-37 (S2).** S3 monterar S2:s editor i onboardingen och kan inte byggas innan editorn finns och är verifierad. **Får ej startas förrän goal-37 är i `2-Byggplan/klart/`.** Bygger även vidare på goal-34/S1 (`2-Byggplan/klart/02-ytor/sajtbyggare/goal-34-sajtbyggare-S1-innehalls-grund.md`, utfall i `1-Planering/06-sajtbyggare/S1-UTFALL.md`) — region-manifest + override-kaskad + provenance.
- **ÖPPET:** goal-37 (S2) är ÄNNU INTE skriven som brief (fanns ej i `2-Byggplan/goals/` 2026-06-17). S3:s exakta integ-yta (monterings-API, prop-kontrakt mot editorn, spara-action-signatur) **låses först när S2:s editor-API är definierad**. Denna brief markerar dessa punkter ÖPPET istället för att gissa.
- Blockerar inget pågående bygge. När verifierad → `2-Byggplan/klart/02-ytor/sajtbyggare/`.

## Kontext
**Onboarding-flödet idag (verifierat i koden 2026-06-17):**
- **Operatör-vägen (den faktiska "onboarding-wizarden" nu):** `app/(platform)/salonger/ny/page.tsx` → `components/platform/CreateTenantForm.tsx` (~44KB). Wizard med `const STEPS = ['Bransch', 'Namn & subdomän', 'Temamall', 'Moduler', 'Token-branding', 'Ägare & roll']`. Stegen **"Temamall"** (välj av 5 teman, `WIZARD_THEMES` speglar `THEME_CONTENT`/`tokens.css`) och **"Token-branding"** (accent-swatches + logo-upload) finns REDAN — men som **separata formulär-steg med statisk preview**, exakt det utspridda mönstret INRIKTNING vill ersätta med EN editor-yta. Bransch-val (`vertical`) förfyller tema + modul-states. Skrivs via `lib/platform/tenants.ts` + `lib/platform/actions.ts` (Kund-lager = `settings.copy` + `branding`-kolumnen, samma som S1 återanvänder).
- **Self-serve sign-up:** `app/(kund)/registrera/page.tsx` + `components/kund/SignUpForm.tsx` är **end-kundens kontoskapande** (namn/mejl/telefon/lösen), INTE salong-onboarding. Self-serve *salong*-onboarding är enligt agendan (`1-Planering/07-efter-sajtbyggaren/00-agenda.md` p.9) **FRAMTID** — nu är onboarding manuell/personlig (Zivar tar kunderna själv). **S3 riktar sig därför mot operatör-vägen (`CreateTenantForm`)**, inte self-serve-registreringen. **ÖPPET:** om Zivar vill att S3 även förbereder self-serve-vägen — markera, bygg inte spekulativt.

**Varför "samma editor" och inte ett nytt steg:** INRIKTNING säger explicit "Fylls redan i onboardingen → kundens sida är klar när hen skapas" och "Allt på EN plats (mall + färg + font + logo + bilder + texter) — inte utspritt". S3 ersätter alltså `Temamall`- + `Token-branding`-stegen (och inför text/bild-redigering som inte finns i wizarden idag) med **EN monterad instans av S2:s editor** mot den nya tenantens utkast-läge.

**S1-grunden S3 bygger på (från S1-UTFALL, verifierat + deployat, flagga av):**
- Region-manifest: `lib/sajtbyggare/manifest/types.ts` + `salvia.ts` (15 regioner: TEXT→`settings.copy.*`, IMAGE→`branding.*`, COLOR/FONT/LOGO→tokens).
- Kaskad + provenance: migration `0038_site_content_vertical_defaults` (Bransch-lager, **applicerad på prod** `clylvowtowbtotrahuad`), resolver `lib/sajtbyggare/resolve.ts` (`resolveSiteContent`: Universal→Bransch→Kund, härkomst `standard`/`modifierad`). **Kund-lager = befintliga `settings.copy`/`branding`** (ingen ombyggnad).
- Render/markörer: `lib/sajtbyggare/marked-regions.tsx`, `marker.ts`, `load-site-content.ts`. Flagga: `lib/sajtbyggare/flag.ts` (`SAJTBYGGARE_ENABLED === 'true'`).

## Berörda filer
*(Exakta editor-monteringspunkter låses mot S2:s API — se ÖPPET. Citerade onboarding-filer är verifierade i repo 2026-06-17.)*
- `5-Kod/apps/web/components/platform/CreateTenantForm.tsx` — **HUVUDÄNDRING.** Ersätt stegen `Temamall` + `Token-branding` (och addera text/bild-redigering) med en monterad S2-editor-yta mot den nya tenantens utkast. `STEPS`-arrayen kortas/omformas därefter. Bevara bransch-val (steg 0) som förfyllning (mall + Bransch-defaults via kaskaden). **Rör ej** `Moduler`-steget / `Ägare & roll` / submit-floor av booking.
- `5-Kod/apps/web/app/(platform)/salonger/ny/page.tsx` — server-entry. Ev. ladda S1 region-manifest/utkast-content server-side och skicka ner (mönster: `load-site-content.ts`). Behåll `loadVerticalPresets`.
- `5-Kod/apps/web/lib/platform/tenants.ts` — onboarding-stege-metadata + tenant-skrivning. Om "designa sidan" blir/är ett onboarding-steg: spegla status här (se fix-25-mönstret för flagg-speglad steg-status). **ÖPPET:** exakt rad/funktion för stege-objektet.
- `5-Kod/apps/web/lib/platform/actions.ts` — server action som skapar tenant. Onboarding-editorns spara ska skriva Kund-lager (`settings.copy` text, `branding` färg/font/logo/bilder) **via samma spara-väg som S2** (återanvänd S2:s action, mappa inte om). **ÖPPET:** S2:s spara-action-namn/signatur.
- `5-Kod/apps/web/components/platform/PlatformBrandingForm.tsx` — befintlig branding-form (referens för nuvarande färg/font/logo-fält; återanvänd fält-mappning, bygg inte om).
- **S2:s editor-komponent(er)** (skapas i goal-37; exakt sökväg/namn **ÖPPET** tills S2 skriven) — importeras och monteras här. **Bygg INTE en andra editor.**
- `5-Kod/apps/web/lib/sajtbyggare/resolve.ts` / `manifest/*` / `flag.ts` — **återanvänds oförändrade** (Kund-overrides + härkomst + flagg-gate). Lägg ny mall? → nytt `manifest/<tema>.ts` enligt S1-mönstret (universal+variant, aldrig fork).
- `5-Kod/apps/web/components/platform/CreateTenantForm.test.tsx` *(eller intilliggande)* — **NY/UTÖKAD.** Vitest: onboarding-spara → Kund-override skapas + resolvar `modifierad`.

## Steg
*(Förkrav: goal-37/S2 verifierad klar. Läs S2:s faktiska editor-API + `01-INRIKTNING-LAST-…md` + `S1-UTFALL.md` FÖRST. Underlaget är lagen — improvisera aldrig editor-beteende.)*
1. **Kartlägg S2:s editor-yta:** vilken komponent monteras, vilka props (tenant/utkast-id, region-manifest, initial-content), vilken spara-action den exponerar. Skriv ner kontraktet. Allt här som inte går att läsa ur S2 → **ÖPPET, fråga Zivar, gissa inte.**
2. **Montera S2-editorn i onboarding-wizarden:** i `CreateTenantForm.tsx`, ersätt `Temamall`- + `Token-branding`-stegen med EN editor-yta. Mata den med: vald bransch (steg 0) → mall + Bransch-defaults via `resolveSiteContent` (så editorn öppnar med branschens utseende, redo att override:as). Behåll bransch-steget och dess förfyllning. **Återanvänd S2:s komponent rakt av** — ingen klon, ingen omimplementerad inline-edit.
3. **Spara = Kund-override:** editor-ändringar i onboardingen skrivs som Kund-lager (`settings.copy` för text, `branding` för färg/font/logo/bilder) via **samma spara-väg som S2**. Inga nya kolumner — Kund-lagret ÄR `settings.copy`/`branding` (S1). Värden måste resolva som `modifierad` ovanpå Bransch/Universal.
4. **Allt-på-EN-plats:** efter steg 2 ska tema, färg, font, logo, bilder OCH texter redigeras i den enda ytan — verifiera att inget av dessa finns kvar som separat formulärsteg (det var hela poängen). `STEPS`-arrayen speglar den nya strukturen.
5. **Onboarding-stege-status (om tillämpligt):** om plattformens onboarding-stege (`lib/platform/tenants.ts`) listar "designa sidan", spegla status ur data/flagga (fix-25-mönstret), hårdkoda aldrig "Klart".
6. **Flagg-gate:** hela S3-ytan bakom `SAJTBYGGARE_ENABLED` (`lib/sajtbyggare/flag.ts`). Flagga AV → onboardingen beter sig **exakt som idag** (gamla Temamall/Token-branding-stegen kvar, oförändrat). Flagga PÅ (staging) → nya editor-ytan. Noll publik/operativ förändring i prod tills hela kedjan klar.
7. **Tester:** onboarding-spara skapar Kund-override som resolvar `modifierad`; bransch-förfyllning ger Bransch-defaults i editorn; flag-off = oförändrad wizard; booking-floor + Ägare/roll-stegen orörda.

## Verifiering (klar när — mekaniskt 0 FAIL, bevisat; aldrig ögonmått)
- [ ] **Förkrav bekräftat:** goal-37 (S2) ligger i `2-Byggplan/klart/` och dess editor är verifierad. (Annars: STOPP, bygg inte.)
- [ ] Onboarding (operatör-vägen) monterar S2:s editor — **samma komponent**, ingen andra editor i trädet (grep: ingen duplicerad inline-edit/overlay utanför S2-modulen).
- [ ] I editorn under onboarding går att ändra **tema + färg + font + logo + bild + text på EN yta**; `Temamall`- och `Token-branding`-stegen finns inte kvar som separata steg.
- [ ] Spara → ny tenant får Kund-override i `settings.copy`/`branding`; `resolveSiteContent` returnerar dessa som **`modifierad`** ovanpå Bransch/Universal (bevisat i test, mönster från S1 §4).
- [ ] Bransch-val (steg 0) öppnar editorn med branschens defaults (kaskad), inte tomt/universal-only.
- [ ] **Flag-off = oförändrad onboarding** live (gamla stegen kvar, kund skapas som idag). Flag-on bara på staging-worker.
- [ ] **Gates:** vitest grönt (nya/utökade tester med), `tsc` 0 nya fel, lint 0 (eller dokumenterat miljö-trasigt som S1 §8), **opennext build PASS** (bygg via `C:\tmp\kod` — ö-path kraschar opennext, se MEMORY goal23), grep-guard ren (`localhost:3000`).
- [ ] **Live-bevis (staging):** ny test-tenant via onboarding-editorn → storefront renderar de override:ade värdena; `corevo.se` + `booking.corevo.se` = 200 (ingen POS/prod-regression). Worker-version + rollback-id noterade.

## Anti-patterns
- **ALDRIG en andra editor.** S3 monterar S2:s editor. Bygger du en parallell inline-edit/overlay i onboardingen = fel (bryter "samma editor", dubbel underhållsbörda). Den vägen ÄR buggen.
- **ALDRIG nya Kund-content-kolumner.** Kund-lagret = befintliga `settings.copy` + `branding` (S1-beslut). Ingen ombyggnad av datamodellen.
- **ALDRIG fork per bransch.** Ny mall/bransch = nytt `manifest/<tema>.ts` + Bransch-defaults via kaskaden (universal+variant). Inget hårdkodat per kund.
- **ALDRIG behåll de utspridda stegen "för säkerhets skull"** när flaggan är PÅ — allt-på-EN-plats är kravet, inte en ny flik bredvid de gamla.
- **ALDRIG starta före S2.** Ingen editor att montera = ingen S3.
- **Hårdkoda aldrig onboarding-stege-status "Klart"** — härled ur flagga/data (fix-25 / goal-19-ärlighetsprincip).
- **Rör ALDRIG** POS / `corevo.se` / booking-wildcards / `Moduler`- + `Ägare & roll`-stegen / booking-submit-floor. POS får aldrig gå ner.
- **Improvisera aldrig editor-beteende** — `01-INRIKTNING-LAST-…md` + S2:s faktiska API är lagen. Okänd detalj → ÖPPET, fråga.
- Python: nej. Repo-stack (TS/Next + Node `.mjs` för script).

## Kopplingar
- **goal-37 (S2 — visuell editor-motor):** hård blocker; S3 monterar dess editor. **Skrivs/byggs FÖRE denna.**
- **goal-34 (S1 — innehålls-grund / override-kaskad):** `klart/02-ytor/sajtbyggare/goal-34-sajtbyggare-S1-innehalls-grund.md` + `1-Planering/06-sajtbyggare/S1-UTFALL.md`. Levererar region-manifest + `resolveSiteContent` (3-nivå-kaskad) + provenance som S3 skriver Kund-overrides mot.
- **INRIKTNING:** `1-Planering/06-sajtbyggare/01-INRIKTNING-LAST-visuell-innehalls-editor.md` (S3-raden + "allt på EN plats" + "fylls redan i onboardingen").
- **Agenda:** `1-Planering/07-efter-sajtbyggaren/00-agenda.md` (p.5 override-kaskad + badge `modifierad`; p.9 onboarding manuell nu / self-serve framtid → S3 = operatör-vägen nu).
- **ROADMAP:** `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md` Fas C (S1→S2→S3).
- **fix-25** (`2-Byggplan/goals/fix-25-sparrad-text-onboarding-steg5.md`): mönster för flagg-speglad onboarding-stege-status.

## Rollback
Flagga `SAJTBYGGARE_ENABLED="false"` i prod = onboarding-editorn osynlig (default-läge under hela bygget → noll exponering). Vid behov: `git revert` av S3-commit(s) + `wrangler rollback <föregående version-id>` (noteras vid deploy, `--config 5-Kod/apps/web/wrangler.jsonc`). Inga destruktiva DB-ändringar (S3 skriver bara befintliga `settings.copy`/`branding`; ingen ny migration — kaskad-tabellen kom i S1/0038 och rörs ej). POS/prod-domäner orörda.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
*(Tillägg, inte ersättning — original-SCOPE oförändrad. Skärper tre punkter där den ursprungliga DoD:n var icke-körbar eller otestad. Kulturen står fast: förkrav goal-37/S2 i `klart/` bekräftat annars STOPP; samma editor-komponent som S2 — ALDRIG en andra editor; spara→Kund-override resolvar `modifierad`; flag-off = oförändrad onboarding; gates + staging-live-bevis innan "klart".)*

### 1. HÅRD gate (förkrav) — S2:s editor-API MÅSTE vara dokumenterat innan S3 ens börjar
Briefen erkänner själv (§Lägeskoppling "ÖPPET") att goal-37 (S2) **ännu inte var skriven** när S3 skrevs — alltså är monterings-API, prop-kontrakt och spara-action-signatur ÖPPNA. **Så länge de är ÖPPNA är denna DoD icke-körbar** (man kan inte verifiera "samma komponent monteras med rätt props och rätt spara-väg" mot ett API som inte finns). Därför, som hård förkravs-gate utöver att goal-37 ligger i `2-Byggplan/klart/`:
- [ ] **S2:s editor-API är skriftligt fastställt i en konkret artefakt** — `5-Kod/docs/sajtbyggare-editor.md` (eller motsv. som goal-37 pekar ut). Artefakten MÅSTE namnge: (a) **monterings-API** — exakt komponent + import-sökväg som monteras; (b) **prop-kontrakt** — varje prop editorn kräver (tenant/utkast-id, region-manifest, initial/Bransch-resolvat content, flagg-state) med typ; (c) **spar-action-signatur** — exakt funktionsnamn + parametrar + retur, den väg S3 ÅTERANVÄNDER (mappar aldrig om).
- [ ] **Saknas artefakten, eller är någon av (a)/(b)/(c) "ÖPPET"/TBD → STOPP.** Ingen kod, ingen montering, ingen gissad signatur. Fyll först ÖPPET-punkterna i §Berörda filer / §Steg mot artefaktens faktiska värden — gissa aldrig editor-API.

### 2. Deterministisk `STEPS`-flagg-växling — BÅDA grenar testade (annars läcker halv-migrerat UI)
Flaggan får inte bara dölja editorn; den måste **deterministiskt byta hela steg-strukturen** så att exakt en värld är aktiv åt gången. Definiera och testa båda grenar:
- [ ] **`STEPS`-arrayen härleds ur flaggan** (ett ställe, t.ex. `const STEPS = SAJTBYGGARE_ENABLED ? STEPS_EDITOR : STEPS_LEGACY` i `CreateTenantForm.tsx`) — inte villkorlig rendering inuti ett delat steg. **Flag-OFF** = `STEPS_LEGACY` med gamla `'Temamall'` + `'Token-branding'` kvar, oförändrad ordning/etiketter. **Flag-ON** = `STEPS_EDITOR` där `'Temamall'` + `'Token-branding'` är **borta** och ersatta av den enda S2-editor-ytan.
- [ ] **Test BÅDA grenar (deterministiskt, ej ögonmått):** ett vitest-fall med flaggan av asserterar att `STEPS` innehåller `'Temamall'` + `'Token-branding'` och INTE editor-steget; ett fall med flaggan på asserterar motsatsen (editor-steg finns, de två gamla stegen finns INTE). Inget tredje "blandat" tillstånd får vara nåbart — verifiera att inget gammalt branding/tema-steg läcker in när flaggan är PÅ (det halv-migrerade UI:t ÄR buggen).

### 3. Regressions-snapshot på orörda steg — "rör ej" måste BEVISAS, inte påstås
§Steg/§Anti-patterns säger "Rör ej `Moduler` / `Ägare & roll` / booking-submit-floor" — men inget test skyddar dem. När editorn monteras i `CreateTenantForm.tsx` (~44 KB) måste det bevisas mekaniskt att de orörda stegen är oförändrade:
- [ ] **Snapshot-/integrationstest på de orörda stegen:** rendera wizarden (med editorn monterad, flag-ON) och ta snapshot av `'Moduler'`- och `'Ägare & roll'`-steget + booking-floor-fältet i `CreateTenantForm.tsx`; assertera att deras markup/fält/validering är **identiska** med flag-OFF-läget (snapshot diff = 0 på just dessa regioner). Ändras något där oavsiktligt → FAIL.
- [ ] **Submit-kontrakt oförändrat:** test att tenant-skapande via `lib/platform/actions.ts` fortfarande skriver `Moduler`-states + ägare/roll + booking-floor som idag (samma fält, samma värden) oavsett flagg-läge — editor-montering får inte ändra den befintliga create-payloaden, bara addera Kund-override-skrivningen.

### DoD-tillägg (måste vara grönt utöver §Verifiering)
- [ ] Förkravs-gate (1) uppfylld: `5-Kod/docs/sajtbyggare-editor.md` finns och (a)/(b)/(c) är ifyllda — inga ÖPPET kvar i monterings-/prop-/spar-kontraktet.
- [ ] `STEPS`-växling (2) testad i BÅDA grenar; inget halv-migrerat steg nåbart med flaggan PÅ.
- [ ] Regressions-snapshot (3) grön: `Moduler` / `Ägare & roll` / booking-floor + create-payload bevisat oförändrade.
