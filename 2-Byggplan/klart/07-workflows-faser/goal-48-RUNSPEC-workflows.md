# goal-48 RUN-SPEC — autonom våg-byggare (workflows), DB + frontend + push

> **Till den NYA sessionen:** Detta är körinstruktionen. Bygg onboarding-studion (goal-48) **en våg i taget**, via workflows (ultracode: understand → plan med låsta kontrakt → build → adversariell review). Varje våg: DB (om behövs) + frontend → gates → render-verify 0-FAIL → commit → push. Inget ögonmått. Design = LAG.

## LÄS FÖRST (i denna ordning, varje design-rörande våg)
1. `2-Byggplan/goals/goal-48-onboarding-studio-multibransch.md` — planen (gap, vågor, regler).
2. **Design = LAG** (exakt kopia, ALDRIG improvisera — 18h brann en gång): `4-Dokument-Underlag/01-acceptans/super-admin/` (cfg-data.js · studio.jsx · app.jsx · preview.jsx · stages.jsx · HANDOFF.md) + `standalone/Onboarding-studio.html` + `01-BASELINE.md` + `02-Arkitektur-sanning.md` (DB-vs-mockup per modul — läs FÖRE modul-wiring).
3. Denna runspec.

## NULÄGE (foundation klar, OCOMMITTAD i working tree på `main`)
- **Klart + verifierat:** `5-Kod/apps/web/lib/platform/onboarding-studio/flag.ts` (`onboardingStudioEnabled()`) · `.../model.ts` (StudioCfg + applyBranch/resolveModuleState/studioSlugify, port av app.jsx) · `model.test.ts` **8 tester gröna** · `tsc` 0. Plus `actions.ts` #3 (invite-mejl `tenant_name`).
- **Working tree = TVÅ spår mixade på `main`:**
  - goal-48: `lib/platform/onboarding-studio/*`, `actions.ts` (#3), `goal-48-*.md`.
  - goal-47 (ANNAT spår, template-bron skin — Zivars commit-beslut väntar): `app/(public)/page.tsx`, `lib/storefront/skin/*`, `components/storefront/skin/`, `vitest.config.ts`, `goal-47-*.md`. **Rör ej / committa separat.**
- **FÖRSTA STEG nya sessionen:** branch:a från main (`git switch -c goal-48-onboarding-studio`), committa goal-48-foundation separat (path-scoped `git add`), lämna goal-47-filerna. Sen bygg vågorna.

## VÅGORDNING (en klar → push → nästa; goal-48 §Vågor)
| Våg | DB | Frontend | Klar-bevis |
|---|---|---|---|
| **W0** DB-sanning + buggar | verifiera live-DB; **migration**: lojalitet-nyckel (`verticals.default_modules` "loyalty"→"lojalitet") + seeda 4 tomma mallar (edit/leander/linnea/zigge) | — | migration applied STAGING, default-aktivering ger `lojalitet` ej `loyalty`; nagel-onboard ger ej tom sajt |
| **W1** studio-skal | ingen | JourneyBar + SuperEntry + StepRail (5 faser/12 steg) + panel-host + preview-pane; flagg-gatad i `salonger/ny/page.tsx`; Lansera→befintliga `createTenant`. **Lägg `ONBOARDING_STUDIO_ENABLED` i wrangler.jsonc** (top-level "false", `env.staging.vars` "true") | flag-OFF byte-identisk (CreateTenantForm orörd); studio renderar på staging |
| **W2** live-preview | ingen | preview = riktig storefront-render (återbruk S2/S3 salvia-väg); per-bransch modul-sektioner | re-temar live, render 0-FAIL |
| **W3** stegen (inga nya writes) | ingen | modval · modconf (MODULES.variants spec-display) · brand · agare · granska (LAUNCH_CHECK) · live (LaunchSequence) | varje panel exakt design, wire:ad/ärligt märkt |
| **W4** tjänster | **migration om service_prices saknas** (verifiera form: inline price_cents vs separat tabell) | tjanster-steg → services (+pris öre) | minst 1 tjänst m. pris = launch-krav, skrivs |
| **W5** text + modplace | skriv `content_slots` (`tenant_site_pages` finns EJ → DB-wins) | hero klicka-redigera + modul-ordning | text/ordning når live utan deploy (template-bron-väg, ihop med goal-47 slice 2) |
| **W6** resultat | ingen | Besökarens vy (riktig storefront) + "Kundens admin (M6)" länkar till `booking.corevo.se/admin` | resultat-stage renderar |

## PER-VÅG-LOOP (mandatet)
1. (design-rörande) re-läs relevant design-fil.
2. **DB:** migration i `5-Kod/supabase/migrations/00NN_*.sql` om behövs → applicera **STAGING först** (Supabase MCP/CLI), aldrig prod-först. Build-once: lägg till, radera aldrig.
3. **Frontend:** bygg flagg-gatat. flag-OFF MÅSTE vara byte-identisk (CreateTenantForm = fallback tills hela studion bevisad).
4. **Gates (alla):** `pnpm --filter @corevo/web typecheck` = 0 · `pnpm --filter @corevo/web test` grön (+ nya) · opennext: robocopy → `C:\tmp\kod` (ö-fällan!) → `pnpm --dir C:\tmp\kod --filter @corevo/web run preview` = "Compiled successfully".
5. **Render-verify 0-FAIL** på staging-testtenant (skapa kund e2e). **Oberoende verify** — ej byggarens eget ord.
6. **Commit** (`git add 5-Kod <berörda> supabase/migrations`; verifiera filer stage:as individuellt, EJ gitlink — nested `5-Kod/.git` är stale) → **push** (`git push`; deployar EJ prod).
7. **Deploy:** staging-worker först (`bokningsplatformen-staging`, flaggor). Prod ENDAST via `v*`-tag → CI `deploy-prod.mjs` (re-asserterar domäner, har CF-token) EFTER Zivar-OK + 0-FAIL.

## HÅRDA GUARDRAILS
- **Design = LAG**, exakt kopia. "Klart" = mekaniskt 0-FAIL + oberoende verify. Aldrig "känns nära".
- **DB vinner över mockup.** Designen 2026-06-16 namnger tabeller som ej finns (`tenant_site_pages`) → verifiera ALLT mot live-DB först (goal-47-lärdomen: en falsk premiss kostade en hel runda).
- **Bara live wire:as:** 7 moduler / ~5 verticals. Roadmap-moduler/-branscher visas (märkta) men byggs ej, raderas ej. **mockup ≠ funktion** — aldrig fejk-kontroll/fejk-success.
- **Bygg ALDRIG i repo-mappen** (`ö` → opennext-krasch). Endast `C:\tmp\kod`.
- **POS `corevo.se` + 3 fasta hostar (booking/superbooking/minbooking) ALDRIG nere** vid deploy. **Aldrig bare `wrangler deploy`** (detachar kund-domäner) — endast `deploy-prod.mjs` via v-tag.
- **Flagga `ONBOARDING_STUDIO_ENABLED`**: anropa i komponentkropp (Workers env-fälla), aldrig modul-scope. Prod "false" tills hela studion staging-bevisad.

## WORKFLOW-TIPS
- Kör varje våg som en workflow (ultracode/lfg): understand (läs design+DB) → plan (låsta kontrakt: flagga, byte-identisk fallback, vilka tabeller) → build → adversariell review (4 linser) → fixa fynd → gates → push. Reviews rena före push.
- W0 är inte design-tung men bär hela "modulerna funkar"-spåret — kör den noggrant.
- En våg = en commit = en PR/push. Aldrig flera vågor i ett svep (en-sak-klar-regeln).

## EFTER goal-48 (nästa goal, "modulerna funkar som de ska")
W3-spåret i CHECKLISTA: webshop checkout · blogg läsesida · lojalitet inlösen · presentkort köp · offert-notis — end-to-end per modul. Egen goal. `02-Arkitektur-sanning.md` §1 = `MODULES[*].build` = exakt kravlista per modul.
