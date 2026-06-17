# Sajtbyggare S1 — UTFALL (goal-34: innehålls-grund / override-kaskad)

**Datum:** 2026-06-17 · **Körning:** autonom via subagent-driven-development (Opus 4.8).
**Status:** S1 datalager KLART + deployat (flagga AV i prod). EN öppen ops-fråga: test-barber.corevo.se custom-domän (fix-33-yta) gick 1016/000 efter deploy — se §6.

## 1. Vald mall
**salvia** (test-barbers tema sattes till salvia för beviset; har renaste innehållsfält + är en av de 5 prod-temana). restoran (S0:s HTML-mall) ej använd — salvia är en React-layout, inte en render-bridge HTML-mall.

## 2. Region-manifest (F1)
`5-Kod/apps/web/lib/sajtbyggare/manifest/` — `types.ts` (Region/RegionManifest/TenantBinding/RegionType) + `salvia.ts` (`SALVIA_REGION_MANIFEST`, 15 regioner).
- TEXT (6): hero.eyebrow/title/lede, about.copy, footer.tagline, about.italic → `settings.copy.<fält>`.
- IMAGE (3): hero.image (hero_images[0]), about.image, closing.image → `branding.<fält>`.
- COLOR (4): color.primary #5E7361, color.bg #F6F4EE, color.fg #232520, color.accent #5E7361 (=primary).
- FONT (1): font.body 'Jost','Inter',sans-serif. LOGO (1): logo (default null).
- Text/bild-defaults refereras LIVE från `THEME_CONTENT.salvia` (DRY, ingen drift). Färg/font speglar `tokens.css [data-theme=salvia]`. `utility` medvetet exkluderad (tema-only).

## 3. Override-kaskad + provenance (F2)
- Migration `0038_site_content_vertical_defaults` — Bransch-lagret (platform-global referensdata, anon-läs / platform-admin-skriv, EJ tenant-scopad), idempotent + rollback-fil (safe-branch only). **APPLICERAD PÅ PROD** (clylvowtowbtotrahuad): tabell + RLS (2 policies) verifierade, 0 rader vid skapande.
- Resolver `lib/sajtbyggare/resolve.ts` — `resolveSiteContent` resolvar **Universal(theme) → Bransch(vertical) → Kund(tenant)**, härkomst `standard`/`modifierad` + `source`-lager. Återanvänder befintlig `settings.copy`/`branding` som Kund-lager (ingen ombyggnad).

## 4. Kaskad + provenance-bevis (query, prod DB, test-barber)
| region | tenant-override | vertical-default | resolverat |
|---|---|---|---|
| hero.title | "Test-barber: vår egen rubrik" | — | **tenant / modifierad** |
| hero.eyebrow | — | "— Nagelstudio & Spa (bransch-default)" | **vertical / standard** |
| hero.lede | — | — | **universal / standard** |

Alla TRE lager bevisade i EN resolution. (Test-barbers vertical = nagelstudio; seedad bransch-default på (nagelstudio, salvia, hero.eyebrow).)

## 5. DOM-markör-bevis (F3, render)
`lib/sajtbyggare/marked-regions.tsx` (display-only, INGA klick-handlers) + `marker.ts` + server-loader `load-site-content.ts`. Flag-gatad route `/sajtbyggare-spike/regioner/[slug]`.
- `marked-regions.dom.test.ts` (renderToStaticMarkup av RIKTIGA komponenten med test-barbers LIVE DB-läge): alla 15 regioner får `data-editable`-markör; hero.title→tenant/modifierad (visar override), hero.eyebrow→vertical/standard (visar bransch-värde), hero.lede→universal/standard.
- **Flag-off bekräftad live:** `bokningsplatformen.zivar68.workers.dev/sajtbyggare-spike/regioner/test-barber` → **404** (notFound i prod, flagga av = noll publik yta).
- ⚠️ Live DOM på deployad staging-worker EJ körd: `wrangler deploy --env staging` (bare) blockerades av auto-mode-klassaren (kräver dokumenterad safe-path). DOM-markörerna bevisade via renderToStaticMarkup av samma komponent istället.

## 6. Deploy + prod-hälsa
- Build: opennext via `C:\tmp\kod` (ö-path), grön, route bundlad.
- Prod-deploy via **deploy-prod.mjs** (safe path, DB-driven domäner re-asserterade). Flagga `SAJTBYGGARE_ENABLED="false"` i prod (bekräftat i worker-bindings).
- **Worker-version (live):** `16735d4f-454a-4033-9cdf-f77f80062693` (opennext två-fas: f3d55da3 → 16735d4f).
- **Rollback-id:** `6b3f3192-69bc-4861-b616-d591bd6e6a4c` (versionen före denna deploy).
- Prod-hälsa: corevo.se → 200, booking.corevo.se → 200. ✅
- ✅ **test-barber.corevo.se ÅTERSTÄLLD** (Zivar-auktoriserad CF API re-attach 2026-06-17): bunden till bokningsplatformen igen (enabled, cert), serverar **200** (`<title>Test Barber</title>`). Alla 4 corevo-domäner bundna.
- 🔴 **Vad som hände (rotorsak kvarstår att fixa):** deployen DETACHADE test-barber.corevo.se (kund-domän nere 000/1016 tills re-attach). Diagnos (CF API `workers/domains`, auktoritativt): efter deploy var endast booking/superbooking/minbooking bundna; **test-barber.corevo.se saknades**. `wrangler.deploy.json` (gen-deploy-config) INNEHÅLLER test-barber (5 routes) → **deploy-STEGET tappade den**: opennext-deployen publicerade i TVÅ versioner (f3d55da3 → 16735d4f); andra publiceringen skedde UTAN DB-kund-domän-configen → FX-14-footgun (bare-deploy detachar kund-domäner). Bryter projektets #1-regel "kund-domäner ALDRIG nere vid deploy".
  - **Återställning BLOCKERAD autonomt:** både ny deploy och CF API-attach nekades av auto-mode-klassaren (prod domän-ops, kräver Zivars OK).
  - **Remediation (Zivar kör/auktoriserar):** (a) re-attacha via CF API PUT `/accounts/<acct>/workers/domains` {zone_id, hostname:test-barber.corevo.se, service:bokningsplatformen, environment:production}; ELLER (b) `cd C:\tmp\kod\apps\web && node scripts/deploy-prod.mjs` igen + verifiera test-barber=200 (OBS: kan re-detacha om two-phase-buggen kvarstår); ELLER (c) `wrangler rollback 6b3f3192-...` (osäkert om test-barber var bunden där).
  - **Misstänkt rotorsak (fix-33/goal-32-pipeline, EJ S1-kod):** `opennextjs-cloudflare deploy -c wrangler.deploy.json` verkar göra en andra publicering utan `-c` → kund-domäner detachas på VARJE prod-deploy. Bör utredas separat (drabbar alla kund-domäner, inte bara test-barber).

## 7. Återanvänt vs nytt
- **Återanvänt (ej ombyggt):** `settings.copy` (text), `branding`-kolumn (färg/font/logo + bilder), `THEME_CONTENT.salvia`, `tokens.css`, `verticals`-tabell + `tenants.vertical_id` (0026), render-bro-familjen (lib/sajtbyggare), flag.ts, deploy-prod.mjs.
- **Nytt:** region-manifest (F1), migration 0038 + resolver + provenance (F2), marker/loader/marked-regions + flag-gatad route (F3), DOM-render-bevis (F4). @corevo/db-typer synkade med 0038.
- **Orört:** 5 React-teman, FreshCut, packages/auth, POS, inget editor-UI/TipTap/GrapesJS.

## 8. Gates
vitest 433/433 · tsc 0 nya fel (2 pre-existing grapesjs = stale lokal node_modules, ej i CI) · opennext build grön · lint-verktyg trasigt i miljön (ESLint-9/config-next; build sätter ignoreDuringBuilds:true). En commit per F-steg, pushad. origin/main = `9922b28`.

## Commits
F1 `86cafab` · F2 `1816f48`+`7f672cb` · F3 `6e5ff6c` · F4-bevis `9922b28`.
