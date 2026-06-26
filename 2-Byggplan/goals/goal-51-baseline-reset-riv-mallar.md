# GOAL-51 — BASELINE RESET: riv ALLA mallar (looks), behåll motor + moduler

**Thinking: ⚫ Ultrathink** — datadestruktion i kod + prod-DB. **Rollback OBLIGATORISK. Branch + tag FÖRE allt annat.** Ingen deploy utan Zivars explicita OK.

---

## Mål
Nolla sajtbyggarens **mall-lager**: ta bort alla 13 importerade vendor-looks ur kod + DB så projektet står på en **ren baseline UTAN mallar** — men med motor, **moduler**, galleri, editor och `content_slots` helt intakta. Detta förbereder native-ombygget av original-5 (goal-52).

## Lägeskoppling
- Ormen station 5 (template-bron) → reset till baseline.
- **Supersedes** goal-36 (100-template-import) + goal-50:s import-väg.
- **Föregår** goal-52 (native rebuild av de 5 looksen, kit + config).
- Beslut: minne `corevo-vendor-mallar-skrotade` (2026-06-26).

## Kontext (varför)
Vendor-mallarna är främmande statiska sajter (egen CSS/JS — owl/aos m.m.). De smälter aldrig in med Corevos tokens, moduler eller live-edit; Zivars ändringar slog aldrig igenom. Hela import-idén skrotas. Rätt modell = native sektions-kit + look-som-config (goal-52). Den här goalen river bara — bygger inget nytt.

## ⛔ RÖR INTE (hård guardrail)
- **Moduler + boka-väven** — Zivar: *"vi tar INTE bort moduler".* Lämnas 100% orörda.
- `content_slots`-systemet (load/save), **editorn** (SiteEditor, goal-37), **galleriet/boxen/picker** (goal-50).
- `flag`, `verticals`, `onboarding-steps`, storefront-sidans skal.
- **Väv-motorn** `render-bridge / marker / resolve / manifest / sanitize` → **PARKERA vilande, radera INTE** (build-once; rivs/återanvänds i goal-52 när native är bevisad).
- Gamla 5 React-teman (`salvia/leander/zigge/linnea/edit`) → orörda (referens för goal-52).
- POS `corevo.se` + 3 fasta hostar → orörda. **Ingen deploy** i denna run utan Zivar-OK (domän-detach-risk).

## Berörda filer
**Källa för EXAKT vilka 13 = `look-registry.ts`.** Läs den först; om mina antagna namn skiljer → använd registrets faktiska keys, inte denna lista.

DELETE — kod (13 looks):
- `5-Kod/apps/web/lib/sajtbyggare/templates/{haircare,hairsal,haircut,alotan,barberx,barberz,dentcare,keto,feane,restoran,klinik,drivin,carserv}.ts`
- `5-Kod/apps/web/lib/sajtbyggare/manifest/{…samma 13…}.ts`
- `5-Kod/apps/web/lib/sajtbyggare/templates/{…samma 13…}.proof.test.ts`
- `5-Kod/apps/web/public/sajtbyggare/{…samma 13…}/` (CSS/bild-assets)

DELETE — codemod:
- `5-Kod/scripts/import-template.mjs` + `import-template.test.mjs`

EDIT — registret (töm):
- `5-Kod/apps/web/lib/sajtbyggare/look-registry.ts` → ta bort alla 13 template- + manifest-imports och alla 13 `entry(...)` → `LOOKS = []`. Behåll engine-importerna.

DELETE — DB (ny migration):
- `5-Kod/supabase/migrations/00NN_purge_vendor_looks.sql` — idempotent DELETE av de 13 look-keys i `templates` + child `template_slots` + orphan `content_slots`.

DOC — märk superseded (radera ej, historik):
- `1-Planering/06-sajtbyggare/100-TEMPLATES-TRACKER.md` + `goal-36-BUILD-PLAN.md` → "SUPERSEDED av goal-51".

## Steg
1. **Branch + tag FÖRST.** `git checkout -b goal-51-baseline-reset`; `git tag pre-goal-51-<sha>` (rollback-ankare). Notera körande prod-worker-version.
2. **Läs `look-registry.ts`** → fastställ de exakta 13 keys/filer (sanningskälla).
3. **Verifiera DB-schema** före radering (`list_tables`): faktiska tabell/kolumn-namn (`templates.key`? `template_slots.template_key`? `content_slots`?). Skriv DELETE mot verifierade namn.
4. **Töm registret:** ta bort 13 imports + 13 `entry()` (agera på IDENTIFIERARE, ej radnummer). `LOOKS = []`.
5. **Radera** de 13 `templates/*.ts`, `manifest/*.ts`, `*.proof.test.ts`, och `public/sajtbyggare/<look>/`.
6. **Radera codemod-scripten.**
7. **Purge-migration:** skriv + applicera idempotent migration (DELETE `template_slots` → `templates`; städa orphan `content_slots`). Re-run = no-op.
8. **Tenant-säkerhet:** hitta tenants som pekar på en raderad look (test234rf, test-barber m.fl.) → sätt template-referens till null/baseline → storefront ger tomt/fallback, **ej 500**.
9. **Uppdatera tester till baseline:** `look-registry.test.ts` → förvänta **0** looks; tester som importerade en raderad look → uppdatera/ta bort. Parkerade engine-filer som blir oanvända → behåll, men håll typecheck/build/test gröna.
10. **Märk goal-36-doc:en SUPERSEDED.**

## Verifiering (mekaniskt 0 FAIL, oberoende — byggaren rättar ej sin egen läxa)
- [ ] `pnpm typecheck` = 0 fel
- [ ] `pnpm build` = grön (inga döda imports)
- [ ] `pnpm test` = grön (baseline-uppdaterade tester)
- [ ] grep: **0 träffar** på de 13 look-keys i aktiv kod (utanför git-historik/superseded doc)
- [ ] `look-registry` exporterar tom `LOOKS`
- [ ] galleriet/boxen renderar **tomt tillstånd utan krasch**
- [ ] en tenant utan giltig look → storefront **säker fallback, ej 500**
- [ ] DB: 0 rader kvar för de 13 i `templates`/`template_slots`; inga orphan `content_slots`
- [ ] **branch + tag finns FÖRE radering**
- [ ] **moduler + boka-väv orörda** (rök-test: en modul kan fortf. togglas på en tenant)

## Anti-patterns
- Radera ALDRIG `render-bridge/marker/resolve/manifest/sanitize` → parkeras vilande.
- Rör ALDRIG moduler, `content_slots`, editor, galleri, `verticals`, onboarding, storefront-skal.
- Ingen `bare wrangler deploy` / ingen deploy alls utan Zivar-OK.
- Agera på identifierare, inte radnummer.
- "Klart" = mekaniskt 0 FAIL + oberoende verify, aldrig "kod committad".

## Rollback (OBLIGATORISK)
- **Kod:** `git reset --hard pre-goal-51-<sha>` (eller checkout taggen).
- **DB:** re-applicera `0041_template_catalog_import.sql` (idempotenta INSERTs återställer look-raderna).
- **Deploy:** rulla tillbaka worker till noterad version om en deploy hann ske.

## Kopplingar
- Supersedes goal-36, goal-50 (import-väg). Föregår **goal-52** (native rebuild, kit + config).
- Licens-grind (CC-BY credit) blir **moot** när vendor-mallarna är borta.
- Deploy/domän-regler: kund-domäner i `wrangler.jsonc`, deploy via `scripts/deploy-prod.mjs` (ej bare wrangler).
