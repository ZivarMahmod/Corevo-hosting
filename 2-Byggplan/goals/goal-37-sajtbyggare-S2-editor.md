# goal-37 — Sajtbyggare S2: visuell editor-motor
Thinking: 🔴 (multi-file + nytt flöde: editor-UI över flera lager, ny spar-väg med XSS-sanering, ny admin-yta. Inget prod-deploy av editorn — `SAJTBYGGARE_ENABLED` av i prod tills klar. Bygger på goal-34/S1; rör INTE de 3 fasta hostarna / POS / kund-domäner.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal.
**Status-vid-skrivning:** S0 (goal-31, render-bro) + S1 (goal-34, region-manifest + kaskad + DOM-markörer) KLARA. Editorn (S2) ej påbörjad. Bakom `SAJTBYGGARE_ENABLED` (av i prod, på i staging).

## Mål
Bygg den **visuella editor-motorn**: EN live-vy där Zivar (och senare salongen) **klickar direkt på ett element och ändrar det** — text, bild, färg/font/logo — och ser ändringen direkt, **sparar, och den går live UTAN deploy** (runtime-apply, precis som färg/font redan gör idag). Editorn redigerar de regioner S1:s region-manifest definierade (`data-editable`-markörerna) — inget annat. Resultat: dagens utspridda Varumärke/Texter/Bilder-formulär ersätts av EN WYSIWYG-yta bakom admin-dörren.

**LÅST riktning (från `1-Planering/06-sajtbyggare/01-INRIKTNING-LAST-visuell-innehalls-editor.md`):** visuell **klick-editor**, INTE page-builder/drag-drop. Kunden konfigurerar en färdig design — bygger inte sidor. Redigerbara regioner är definierade av mallen/manifestet → kunden kan inte söndra layouten.

## Lägeskoppling
**Fas C** i `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md` (rad 56–63: "S2 — visuell editor-motor: GrapesJS + TipTap (MIT) + R2-bildväljare + tokens-sidopanel + XSS-sanerare (edge-kompatibel). Klicka element → redigera text/bild/färg → live, ingen deploy."). Bygger DIREKT på **goal-34 / S1** (`2-Byggplan/klart/02-ytor/sajtbyggare/goal-34-sajtbyggare-S1-innehalls-grund.md`): region-manifest, 3-nivå-override-kaskad (Universal→Bransch→Kund), `data-editable`-DOM-markörer. Ersätter editor-formulärspåret; rör inte deploy-pipen (den hanteras av fix-35). När verifierad → `2-Byggplan/klart/02-ytor/sajtbyggare/`.

## Kontext — varför (vad S2 bygger PÅ och vad som är låst)
- **S0 bevisade render-bron** (`html-react-parser` väver in `<corevo-module>` vid markör på riktiga Workers-vägen) — *keepern, frikopplad från editorn.*
- **S1 levererade datalagret:** region-manifest (`SALVIA_REGION_MANIFEST`, 15 regioner), resolver `resolveSiteContent` (Universal→Bransch→Kund + härkomst `standard`/`modifierad`), och `data-editable`-markörer i DOM via `marked-regions.tsx`. **S2 gör de markörerna klickbara och redigerbara** — S1:s `marked-regions.tsx` är medvetet display-only (inga klick-handlers); S2 lägger interaktionslagret ovanpå.
- **Motorval (från INRIKTNING, korrigerar S0:s GrapesJS-val för editor-scopet):** Ingen drop-in passar exakt. Sanity Presentation / TinaCMS kräver egen backend (fel för Supabase/R2). De stora React-builders (GrapesJS, Puck, Craft.js, Plasmic) är page-builders = fel modell för "klicka-på-fast-mall". **BESLUT i INRIKTNING:** litet eget "klicka-på-elementet"-overlay ovanpå mallen + **TipTap** (MIT, headless rich-text) för inline-text + **egen R2-bildväljare** för klick-byt-bild + **färg/font/logo som tokens i sidopanel**. Allt öppet (MIT), ingen vendor-lock, ingen månadskostnad, MINDRE kod än ett tungt ramverk.
- **OBS motstridig formulering mellan källorna (måste hanteras, ej döljas):** ROADMAP rad 60 listar "GrapesJS + TipTap"; INRIKTNING (LÅST, nyare — 2026-06-16, går uttryckligen FÖRE S0:s motorval) säger **eget overlay + TipTap**, med **GrapesJS-overlay som det tunga alternativet** och **Puck (MIT, edit-only-låst) som RESERV**. → **S2 implementerar INRIKTNING-modellen** (eget klick-overlay + TipTap), och utvärderar GrapesJS-overlay endast om det egna overlayt visar sig för dyrt. Se Steg 1 (motor-grind) + ÖPPET-noten.
- **Live-preview-mönster:** iframe + `postMessage` mot den riktiga storefront-render-vägen (draft) — så Sanity/Builder gör det. INRIKTNING noterar att en MVP kan klara sig utan iframe (rendera mallen direkt, uppdatera React-state on-change), men ROADMAP/uppgiften kräver **iframe live-preview mot den riktiga render-vägen** → bygg iframe-vägen (den ger äkta WYSIWYG och återanvänder storefront-renderern, ingen andra-renderare att hålla i synk).
- **Spar → live utan deploy:** ändringar skrivs till Kund-lagret som redan finns (`settings.copy` för text, `branding`-kolumnen för färg/font/logo + bilder — S1:s återanvända Kund-lager). Runtime läser dem redan → ingen deploy, precis som färg/font idag.
- **XSS-sanering (S0-fynd §6, kritiskt):** tenant-redigerad HTML MÅSTE saneras **vid spar** (server-action, INTE per render-request). `isomorphic-dompurify`/DOMPurify bygger på **jsdom** → kan **inte** köra på Cloudflare Workers edge. Saneraren måste vara **edge-kompatibel** (allowlist-parser, ej jsdom) och **MÅSTE tillåta `<corevo-module>` + attribut `type`/`pos`** annars dödas modul-markörerna. Konkret bibliotek = öppen utredning (se Steg + ÖPPET).

## Berörda filer
Verifierade riktiga sökvägar under `5-Kod/apps/web` (om inget annat anges). NYA filer markeras; befintliga repurpose-/återanvänds.

**S1-grund som S2 bygger på (befintliga — återanvänds, ej ombyggda):**
- `5-Kod/apps/web/lib/sajtbyggare/flag.ts` — `sajtbyggareEnabled()` (call-time-läst). Editor-rutten gatas av denna. Av i prod = noll publik yta.
- `5-Kod/apps/web/lib/sajtbyggare/manifest/types.ts` — `Region`/`RegionManifest`/`TenantBinding`/`RegionType`. Källan till vilka regioner som är redigerbara + vilken typ (TEXT/IMAGE/COLOR/FONT/LOGO).
- `5-Kod/apps/web/lib/sajtbyggare/manifest/salvia.ts` — `SALVIA_REGION_MANIFEST` (15 regioner). Första mallen som blir klick-redigerbar.
- `5-Kod/apps/web/lib/sajtbyggare/resolve.ts` — `resolveSiteContent` (Universal→Bransch→Kund + provenance). Editorn LÄSER resolverat värde (för att visa "modifierad"-badge) och SKRIVER till Kund-lagret.
- `5-Kod/apps/web/lib/sajtbyggare/marked-regions.tsx` — display-only `data-editable`-markörer. **REPURPOSE/byggs ut:** S2 lägger klick-interaktion ovanpå (eller en parallell editor-variant som återanvänder markör-logiken).
- `5-Kod/apps/web/lib/sajtbyggare/marker.ts` — markör-attribut-helpers (återanvänds av overlayt för att hitta region från DOM-nod).
- `5-Kod/apps/web/lib/sajtbyggare/load-site-content.ts` — server-loader för resolverat innehåll. Återanvänds av draft-render-vägen.
- `5-Kod/apps/web/lib/sajtbyggare/render-bridge.tsx` + `booking-mount.tsx` — render-bron (modul-invävning). Oförändrad; iframe-previewen renderar genom denna väg.

**Editor-UI (NYA, eget klick-overlay + TipTap):**
- `5-Kod/apps/web/lib/sajtbyggare/editor/` — **NY mapp** för editor-motorn (overlay-logik, region→DOM-bindning, on-change-state, postMessage-protokoll). Exakt fil-uppdelning väljs av byggaren; håll den isolerad från storefront-render-koden.
- `5-Kod/apps/web/components/admin/SiteEditor.tsx` (eller motsv. under `components/admin/`) — **NY.** Editor-skalet (live-preview-iframe + sidopanel + spar-knapp). Klient-komponent.
- `5-Kod/apps/web/app/(admin)/admin/sajtbyggare/page.tsx` — **NY.** Admin-rutt för editorn. **OBS:** S1:s editor-yta levde under `app/sajtbyggare-spike/` (flag-gatad spik). S2 ska bo bakom **admin-dörren** (`app/(admin)/admin/…` — befintligt admin-segment, jfr `app/(admin)/admin/media/page.tsx`). Gata BÅDE med `sajtbyggareEnabled()` OCH admin-auth. **ÖPPET:** exakt rutt-namn (`/admin/sajtbyggare` vs `/admin/sida`) — bekräfta med Zivar; default `/admin/sajtbyggare`.

**Rich-text (TipTap, MIT):**
- TipTap-integration som ny dep (MIT core). Inline-text-redigering bunden till TEXT-regioner → skriver `settings.copy.<fält>`. **ÖPPET:** exakt TipTap-paketuppsättning (`@tiptap/react` + `@tiptap/starter-kit` + ev. minimal extension-allowlist) — välj minsta möjliga; rich-text-omfång (bara fet/kursiv/länk vs mer) bekräftas, default = minimal.

**R2-bildväljare (ÅTERANVÄND befintlig media-library — uppfinn ej hjulet):**
- `5-Kod/apps/web/components/admin/MediaLibrary.tsx` — **BEFINTLIG** R2-media-väljare. Återanvänd som "klick-byt-bild"-väljaren för IMAGE-regioner istället för att bygga ny.
- `5-Kod/apps/web/lib/admin/media/actions.ts` + `5-Kod/apps/web/lib/admin/media/types.ts` — befintliga R2-server-actions/typer. Återanvänd för uppladdning/listning.
- IMAGE-regioner skriver till `branding.<fält>` (S1:s Kund-lager för bilder; hero.image → `hero_images[0]`).

**Tokens-sidopanel (färg/font/logo):**
- `5-Kod/apps/web/components/admin/BrandingForm.tsx` — **BEFINTLIG** branding-form (färg/font/logo). Detta är ett av "de utspridda formulär" S2 konsoliderar. Återanvänd dess server-action/skriv-logik bakom tokens-sidopanelen (skriv inte om sparvägen; wrappa den).
- `5-Kod/packages/ui/tokens.css` — tema-tokens (`[data-theme=…]`). COLOR/FONT-regioner speglar dessa (S1: färg/font speglar tokens.css). Sidopanelen ändrar Kund-override i `branding`; tokens.css är referens-default, rör den ej.

**Spar-väg + XSS-sanering (NYA):**
- `5-Kod/apps/web/lib/sajtbyggare/save-site-content.ts` (eller server-action under editor-mappen) — **NY.** Tar editor-output → **sanerar (edge-kompatibelt) → persisterar** till `settings.copy` / `branding`. Fail-closed: sanering misslyckas → spara inget.
- `5-Kod/apps/web/lib/sajtbyggare/sanitize.ts` — **NY.** Edge-kompatibel allowlist-sanerare (INTE jsdom/DOMPurify). MÅSTE allowlista `<corevo-module>` + `type`/`pos`. Egna tester.

**Storefront / draft-render (iframe-target):**
- Draft-render-vägen som iframe-previewen pekar på. **ÖPPET:** om en dedikerad draft-rutt behövs (`/admin/sajtbyggare/preview/[slug]` som renderar med osparade ändringar via postMessage-state) eller om S1:s `app/sajtbyggare-spike/regioner/[slug]/page.tsx` återanvänds som preview-target. Default: ny flag-gatad preview-rutt under admin som renderar genom samma `load-site-content.ts` + render-bro, och tar osparat utkast via `postMessage`. Rör INTE den publika `(public)`-storefront-renderern.

**Tester (NYA, Vitest):**
- `*.test.ts(x)` bredvid varje ny enhet (overlay-region-bindning, sanitize allowlist inkl. `<corevo-module>`-överlevnad, spar-väg fail-closed, tokens-skriv wrappar BrandingForm-action). Jfr S1:s test-mönster (`resolve.test.ts`, `marked-regions.dom.test.ts`).

**Doc:**
- `5-Kod/docs/sajtbyggare-editor.md` — **NY** (kort): editor-arkitektur, motorval-beslut + varför, spar/sanerings-gränsen, hur en ny mall görs redigerbar. (Kod-doc → `5-Kod/docs/`, ej roten.)

## Steg
1. **Motor-grind FÖRST (besluta på liten spike, inte på känsla):** implementera ett minimalt eget klick-overlay mot `SALVIA_REGION_MANIFEST` + `data-editable`-markörerna (klick på region → identifiera region via `marker.ts` → öppna rätt redigerare). Tidsboxa. **Grind:** klarar det egna overlayt text- + bild- + färg-redigering rent och billigt → fortsätt eget overlay (INRIKTNING-modellen). Visar det sig för tungt → fall tillbaka till **GrapesJS-overlay**, och om det också skaver → **Puck (MIT) edit-only-låst** (`permissions: { drag, insert, delete, duplicate = false }`, inline-text v0.20). Dokumentera utfallet i `docs/sajtbyggare-editor.md`. (INRIKTNING: "Motorvalet omprövas när S2 skrivs.")
2. **Inline-text (TipTap):** bind TEXT-regioner till TipTap (minimal extension-set). Redigering on-change → editor-state. Spar skriver `settings.copy.<fält>`. Visa "modifierad"-badge när Kund-värde avviker från resolverat Universal/Bransch-värde (läs via `resolveSiteContent`).
3. **Klick-byt-bild (återanvänd MediaLibrary):** klick på IMAGE-region → öppna befintlig `MediaLibrary.tsx` (R2) → vald bild → uppdatera region → `branding.<fält>` (hero.image → `hero_images[0]`). Återanvänd `lib/admin/media/actions.ts`; bygg INTE en ny R2-väljare.
4. **Tokens-sidopanel (färg/font/logo):** sidopanel med COLOR/FONT/LOGO-regioner från manifestet, bunden till `branding`-Kund-override via befintlig `BrandingForm`-skriv-logik (wrappa, skriv ej om). Live-uppdatering speglas i previewen.
5. **Iframe live-preview (postMessage):** preview-rutt (default: ny flag-gatad rutt under `/admin/sajtbyggare/preview/[slug]`) renderar storefront via `load-site-content.ts` + render-bron. Editor-skalet skickar osparat utkast via `postMessage`; previewen re-renderar mot utkastet. Äkta WYSIWYG mot den RIKTIGA render-vägen — ingen andra-renderare.
6. **Spar → live utan deploy:** server-action `save-site-content.ts`: (a) **sanera** via `sanitize.ts` (edge-allowlist, behåller `<corevo-module>` + `type`/`pos`); (b) persistera text→`settings.copy`, bild/färg/font/logo→`branding`. Fail-closed: sanering eller validering brister → skriv inget, returnera fel. Runtime läser redan dessa → live direkt, **ingen deploy**.
7. **Edge-kompatibel XSS-sanerare (`sanitize.ts`):** allowlist-parser (ej jsdom/DOMPurify — kraschar på Workers). **ÖPPET — utred bibliotek:** kandidater i S0 §6 = allowlist ovanpå `html-react-parser`s egen DOM, eller en WASM/ren-JS-sanerare. Om inget edge-säkert bibliotek räcker → skriv en strikt egen allowlist (taggar/attribut-vitlista) med `<corevo-module>`-undantaget. Bevisa i test att en `<script>`/`onerror`-injektion strippas OCH att `<corevo-module type="booking" pos="reservation">` överlever.
8. **Admin-yta + flagg-gating:** lägg editor-rutten under `app/(admin)/admin/sajtbyggare/page.tsx`, gatad av `sajtbyggareEnabled()` + admin-auth. Flytta editorn ur `sajtbyggare-spike/` (spik → produktyta). `SAJTBYGGARE_ENABLED` förblir **"false" i prod** tills hela S2 är verifierad.
9. **EN mall klar (salvia):** salvia (S1:s mall) ska vara fullt klick-redigerbar end-to-end (alla 15 regioner: 6 text, 3 bild, 4 färg, 1 font, 1 logo). Övriga mallar = senare skivor.
10. **Tester + gates:** Vitest för varje ny enhet (särskilt sanitize-allowlist + `<corevo-module>`-överlevnad + spar fail-closed). tsc 0, lint 0, opennext build PASS. Bygg ENDAST via `C:\tmp\kod` (ö-path i repo-sökvägen kraschar opennext — rensa `.next`/`.open-next`/`.env.local` före bygge).

## Verifiering (klar när — bevisat, INTE ögonmått)
- [ ] **Live/staging-bevis:** editorn deployad på **staging-workern** (`SAJTBYGGARE_ENABLED="true"` endast i `env.staging`). Klick på salvia-region → ändra text → spara → storefront-render visar nytt värde **utan deploy** (proba draft + sparat värde mot render-vägen).
- [ ] **Bild:** klick på IMAGE-region → MediaLibrary → välj → spara → `branding`-fält uppdaterat, previewen visar ny bild. Ingen ny R2-väljare byggd (MediaLibrary återanvänd — verifiera i diff).
- [ ] **Färg/font/logo:** tokens-sidopanel skriver `branding`-override via BrandingForm-logiken; preview speglar live. "modifierad"-badge syns när Kund avviker från Universal/Bransch (läst via `resolveSiteContent`).
- [ ] **XSS-sanering bevisad:** test visar `<script>`/`onerror`/`javascript:` strippas vid spar, OCH `<corevo-module type="booking" pos="reservation">` överlever sanitizern intakt (type+pos kvar). Saneraren använder INTE jsdom/DOMPurify (verifiera i import-grep).
- [ ] **Ingen page-builder-yta:** ingen drag-drop, inga "lägg till sektion/sida från noll". Endast manifest-definierade regioner är redigerbara (verifiera mot `SALVIA_REGION_MANIFEST`).
- [ ] **Flag-off i prod = noll publik yta:** `bokningsplatformen.…workers.dev/admin/sajtbyggare` (eller motsv.) → 404/notFound när `SAJTBYGGARE_ENABLED="false"`. Prod-worker oförändrad gällande editorn.
- [ ] **Ingen regression på fasta ytor:** booking/superbooking/minbooking + POS `corevo.se` = 200; kund-domäner (test-barber.corevo.se) orörda. (Editorn rör inte deploy-pipen/domänerna — men kör ändå hälsoproben.)
- [ ] **Gates:** Vitest grönt (nya tester med), tsc 0, lint 0 (eller dokumenterad miljö-begränsning som i S1 §8), opennext build PASS. En commit per delsteg, pushad. Worker-version + rollback-id noterade.

## Anti-patterns
- ALDRIG en **page-builder** (drag-drop block, egna sidor/sektioner/knappar från noll). Kunden konfigurerar en fast mall — bygger inte layout. Endast manifest-regioner är redigerbara.
- ALDRIG **sanera per render-request på edge** — sanera vid **spar** (server-action). ALDRIG `isomorphic-dompurify`/DOMPurify/jsdom (kraschar på Workers). Edge-kompatibel allowlist-sanerare.
- ALDRIG strippa `<corevo-module>` / `type` / `pos` i saneraren (dödar modul-markörerna → bron väver inte in modulen).
- ALDRIG bygga en **ny R2-bildväljare** — återanvänd `components/admin/MediaLibrary.tsx`. Uppfinn inte hjulet (Zivars regel).
- ALDRIG skriva om `BrandingForm`/`settings.copy`/`branding`-sparvägen — wrappa befintlig logik (build-once-never-delete; S1 återanvände dessa medvetet).
- ALDRIG **fork:a** för en specifik kund/mall — EN editor-motor + manifest per mall (universal motor + variant). Nytt = ny manifest-rad, inte ny editor.
- ALDRIG slå på `SAJTBYGGARE_ENABLED` i **prod** förrän S2 är verifierad. ALDRIG rör de 3 fasta hostarna / POS / kund-domäner / `env.staging.routes`.
- ALDRIG bygg från ö-path → `C:\tmp\kod` (opennext kraschar annars). Python: nej — Node/TS (repo-konsistens).
- ALDRIG en **andra-renderare** för previewen — iframe pekar på den RIKTIGA storefront-render-vägen (annars driftar preview från live).
- "Känns nära" är INTE klart — mekaniskt bevis (tester + live-proba) krävs (design-trohet-regeln, 18h-läxan).

## Kopplingar
- **goal-31 / S0-UTFALL** (`1-Planering/06-sajtbyggare/S0-UTFALL.md`) — render-bro (`html-react-parser`), motorbevis, XSS-fynd §6 (edge-sanering), bransch-medveten bokning §7.
- **goal-34 / S1-UTFALL** (`1-Planering/06-sajtbyggare/S1-UTFALL.md` + `2-Byggplan/klart/02-ytor/sajtbyggare/goal-34-sajtbyggare-S1-innehalls-grund.md`) — region-manifest, kaskad, DOM-markörer (det S2 bygger PÅ).
- **INRIKTNING** (`1-Planering/06-sajtbyggare/01-INRIKTNING-LAST-visuell-innehalls-editor.md`) — LÅST editor-modell (eget overlay + TipTap + R2 + tokens; Puck reserv).
- **ROADMAP** (`2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md`) — Fas C, S2/S3.
- **fix-35** (`2-Byggplan/goals/fix-35-domaner-i-wrangler-deploy-safe.md`) — deploy-pipen/domäner (separat spår; S2 rör den ej men förlitar sig på att deploy är domän-safe när staging-bevis görs).
- **S3 (nästa skiva)** — onboarding-integration: samma editor fylls i under sign-up.
- **Bransch-medveten bokning (Fas B)** — modul-djupet; sajtbyggaren PLACERAR modulen via markör, modulens variant byggs separat.
- **media-library-modulen** — `components/admin/MediaLibrary.tsx` + `lib/admin/media/*` (R2-väljaren som återanvänds).

## Rollback
- Editorn är bakom `SAJTBYGGARE_ENABLED` (av i prod) → ingen publik exponering att rulla tillbaka i prod oavsett.
- Kod: `git revert` av S2-commit(s). Staging-worker: `wrangler rollback <förra-version-id>` (noteras vid staging-deploy).
- Data: spar-vägen skriver bara till befintliga `settings.copy` / `branding` (Kund-lager) — inga nya destruktiva migrationer. En felaktig sparning ångras genom att skriva tillbaka föregående Kund-värde (eller rensa override → faller tillbaka till Bransch/Universal via `resolveSiteContent`). Inga schema-ändringar i S2 (om en visar sig behövas → egen migration, safe-branch, rollback-fil, Zivars go — som S1:s 0038).

## ÖPPNA frågor (flaggade — blockerar ej bygget, beslutas under/före)
- **ÖPPET (motor):** eget klick-overlay vs GrapesJS-overlay vs Puck-reserv — avgörs på motor-grinden i Steg 1, ej på förhand. INRIKTNING lutar mot eget overlay; ROADMAP nämner GrapesJS. Byggaren dokumenterar valet.
- **ÖPPET (sanerare-bibliotek):** vilket konkret edge-kompatibelt XSS-bibliotek (allowlist ovanpå `html-react-parser`-DOM, WASM, ren-JS, eller egen strikt allowlist) — S0 lämnade detta som S2-utredningsobjekt. Måste bevisas mot `<corevo-module>`-överlevnad.
- **ÖPPET (rutt-namn):** `/admin/sajtbyggare` (default) vs annat namn — bekräfta med Zivar.
- **ÖPPET (preview-target):** ny dedikerad draft-preview-rutt vs återanvänd S1:s `sajtbyggare-spike/regioner/[slug]` — default ny flag-gatad preview-rutt under admin.
- **ÖPPET (TipTap-omfång):** minimal rich-text (fet/kursiv/länk) vs mer — default minimal; bekräfta vid behov.
- **ÖPPET (vendor-JS/animationer):** S0 §5 valde "statiskt först, React-ifiera rörelse vid behov". salvia är en React-layout (ej HTML-render-bro-mall som restoran) → vendor-JS-frågan är mindre akut för S2:s första mall, men noteras för render-bro-mallar i S4.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper tre punkter som annars är subjektiva/tvetydiga: (1) motor-grindens go/no-go, (2) XSS-fuzz-bredd bortom `<script>`, (3) spar-semantiken. Lägger till — tar INTE bort. SCOPE oförändrat: visuell klick-editor, INTE page-builder.

### 1. Motor-grind — mätbar go/no-go (Steg 1, ej känsla)
INRIKTNING är LÅST: **eget overlay är default** — detta är EXIT-kriterier för att ÖVERGE eget overlay, inte en omprövning av modellen. "För dyrt/för tungt" = mätbart, annars är motorvalet subjektivt (och briefen erkänner redan ROADMAP↔INRIKTNING-konflikten, §Kontext rad 20).
- [ ] **Hård timebox:** spiken på eget klick-overlay tidsboxas till **max 2 arbetsdagar (≈16 h)**. Klockan slår → grinden utvärderas på det som finns, ingen förlängning.
- [ ] **LoC-tak:** eget overlay-kärna (overlay + region→DOM-bindning + on-change-state, EXKL. tester och TipTap/MediaLibrary-wrappers) ska rymmas inom **≈800 LoC**. Spränger den taket med marginal (>≈1000 LoC) för text+bild+färg-redigering → signal "för tungt".
- [ ] **Edge-bugg-tak:** **>3 olösta interaktions-buggar** kvar vid timebox-slut (t.ex. overlay-position driver vid scroll/resize, TipTap-fokus krockar med overlay-klick, region-bindning tappas vid re-render) → fall tillbaka till **GrapesJS-overlay**; skaver även det → **Puck (MIT) edit-only-låst** (jfr Steg 1).
- [ ] **Utfall RECORDED, inte "kändes":** valt motoralternativ + de tre mätvärdena (h / LoC / kvarvarande edge-buggar) skrivs explicit i `5-Kod/docs/sajtbyggare-editor.md`. Saknas siffrorna = grinden ej passerad.

### 2. XSS fuzz-svit — bortom `<script>`/`onerror` (saneraren = högrisk)
Saneraren är öppen (bibliotek ej valt) OCH måste behålla `<corevo-module>` → allowlist-parsern är lätt att läcka igenom. Verifierings-checklistan (rad 84) täcker `<script>`/`onerror`/`javascript:` — denna svit LÄGGER TILL XSS-cheatsheet-vektorer. Alla körs mot den **riktiga edge-allowlist-saneraren**, **ALDRIG jsdom/DOMPurify** (bevisa XSS ej i jsdom).
- [ ] **`srcset`-vektor:** `<img srcset="x.jpg, javascript:alert(1) 2x">` → farlig kandidat strippas/neutraliseras (saneraren får inte vitlista `srcset` rått).
- [ ] **`style`/`expression()`-vektor:** `style="background:url(javascript:…)"` och legacy `expression(…)` → inline-`style` med exekverbar payload strippas (vitlista inte hela `style`-attributet okontrollerat).
- [ ] **`data:`-URI-vektor:** `href`/`src="data:text/html;base64,…"` och `data:image/svg+xml,<svg onload=…>` → `data:`-scheman med script-bärande innehåll strippas.
- [ ] **Nästlad/manipulerad `<corevo-module>`:** en LEGITIM `<corevo-module type="booking" pos="reservation">` ska ÖVERLEVA (type+pos intakt), MEN en nästlad/missformad/extra-attribut-variant (`<corevo-module type="booking" onclick="…">`, `<corevo-module>`-i-`<corevo-module>`, okänt `type`) ska AVVISAS/saneras. "Tillåt alla `<corevo-module>`" ÄR läckan — endast `type`/`pos` med kända värden passerar.
- [ ] **Bevis i två riktningar:** sviten visar BÅDE att varje vektor ovan stripps OCH att den giltiga modul-markören överlever (annars dödar saneraren bron). Import-grep bevisar att jsdom/DOMPurify INTE importeras.

### 3. Spar-semantik — beslutad (ej "address it")
"Live direkt" är annars tvetydigt mot S3:s utkast-läge. **BESLUT för S2:** spar = **direkt publikt** till Kund-lagret (`settings.copy` text / `branding` bild/färg/font/logo) → runtime läser direkt, ingen deploy. Detta är hela poängen med "spar → live utan deploy" (Steg 6).
- [ ] **Draft i S2 = endast efemärt:** det enda "utkastet" i S2 är **osparat editor-state i iframe-previewen** (postMessage, försvinner vid stängning). Ett **persisterat utkast-/publicerat-skikt är S3** — byggs INTE i S2. (Dödar tvetydigheten mot S3 explicit.)
- [ ] **Samtidighet — region-granulär last-write-wins, dokumenterad gräns:** två admins som sparar OLIKA regioner krockar inte (skrivningar är per-region-nyckel i `settings.copy` / `branding`). Två admins på SAMMA region → **sista-skrivningen-vinner per region** (ingen merge, ingen låsning) — accepterad gräns för en admin-only-yta med låg samtidighet (build-once, lägsta scope). Detta DOKUMENTERAS i `docs/sajtbyggare-editor.md`; ingen versionshistorik/CMS-revision i S2 (scope-vakt: klick-editor, ej page-builder).
- [ ] **Ångra = skriv tillbaka / rensa override:** en felsparning ångras genom att skriva tillbaka föregående Kund-värde, eller rensa override → faller tillbaka till Bransch/Universal via `resolveSiteContent` (jfr §Rollback). Ingen destruktiv migration.

### Kultur-grindar (gäller denna maxning, scopat till nytt innehåll)
- [ ] **Staging-bevis utan deploy:** för var och en av (text/bild/färg) — klick → ändra → spara → storefront-render visar nytt värde på staging-workern **utan deploy** (proba). "Känns nära" ÄR buggen (18h-läxan).
- [ ] **`<corevo-module type/pos>` överlever saneringen** (punkt 2 ovan) — annars väver bron inte in modulen.
- [ ] **Flag-off i prod = 404:** editor- + preview-rutten ger 404/notFound när `SAJTBYGGARE_ENABLED="false"`; prod-worker oförändrad.
- [ ] **Inga fasta-yta-regressioner:** booking/superbooking/minbooking + POS `corevo.se` = 200; kund-domäner (test-barber.corevo.se) orörda (hälsoprob körs ändå).
- [ ] **Gates + spårbarhet:** Vitest grönt (XSS-fuzz-sviten + spar-semantik-test med), tsc 0, lint 0, opennext build PASS (bygg via `C:\tmp\kod`). Worker-version + rollback-id noterade.
