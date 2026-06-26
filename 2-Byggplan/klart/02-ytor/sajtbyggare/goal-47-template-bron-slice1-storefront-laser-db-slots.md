# goal-47 — Template-bron slice 1: storefront läser DB-slots (byte-identisk fallback)
Thinking: 🔴 (rör den LIVE storefront-render-vägen med `SAJTBYGGARE_ENABLED` PÅ i prod → ändringen går live direkt. Fel = ändrad/trasig render för befintliga tenants. Fallback MÅSTE vara byte-identisk. Rollback obligatorisk.)

**Datum:** 2026-06-19
**Typ:** Autonom goal-brief för Claude Code — körs via /goal.
**Beslut (Zivar 2026-06-19):** scope maximal · tempo "allt bakom flagga". Detta = W2-steg 7 i `2-Byggplan/CHECKLISTA-TILL-LIVE.md` = FÖRSTA bygget mot template-bron.

## Mål
Koppla den färdigbyggda men inerta skin-motorn (`loadTenantSkin`) till den publika storefronten så en tenant KAN rendera sin sida från DB-slots (`content_slots`/`template_slots`/`templates`) i st f de 5 hårdkodade `STOREFRONT_LAYOUTS`. **FÖRSTA SKIVAN:** läs-vägen för EN tema (`salvia`), bakom flaggan, med **byte-identisk fallback** — alla nuvarande tenants + de 4 andra temana renderar EXAKT som idag. Editorns spar-väg rörs INTE (skiva 2).

## Lägeskoppling
W2 (template-bron, det stora spåret) steg 7 · ROADMAP §B. Skin-motorn byggd men har noll importörer (`lib/storefront/skin/load-skin.ts:5-8` säger själv "INERT until something calls loadTenantSkin()"). Anon-RLS redan löst (migr 0027) → ingen migration.

## Kontext (kritiskt — läs FÖRST)
- **Flaggan är PÅ i prod:** `apps/web/wrangler.jsonc:54` `SAJTBYGGARE_ENABLED:"true"` (go-live 2026-06-18), staging `:154`. Ändringen går LIVE direkt → fallback är bärande, ej teoretisk.
- Prod har EN aktiv template (`salvia`) med **0 slots**; de 4 andra temana saknar template-rad. Idag: `loadTenantSkin(id,'salvia')` → giltig skin med `sections:[]`; andra teman → `null`. **Fallback måste behandla BÅDE `null` OCH `sections.length===0` som "rendera hårdkodat".**
- Enda render-vägen: `app/(public)/page.tsx:28` (`STOREFRONT_LAYOUTS[settings.theme]`) + `:57`. Modul-sektionerna `:64-78` (shop/offert/blogg/lojalitet/presentkort) är tema-oberoende → **RÖR EJ**.
- Tema-källa: `settings.theme` via `parseTheme` (`lib/tenant-data.ts:32`, allowlist `:26`, default `leander` `:28`).

## Berörda filer
- `apps/web/app/(public)/page.tsx` — ENDA wiring-punkten. Flagg+skin-gate efter `:26`, wrappa `:57`.
- `apps/web/components/storefront/skin/SkinRenderer.tsx` — **NY** server-komponent. Renderar `skin.sections`/slots. Rör inga befintliga `*Layout`.
- `apps/web/lib/storefront/skin/load-skin.ts` — `loadTenantSkin(tenantId, templateKey)` (anropa, ändra ej).
- `apps/web/lib/storefront/skin/types.ts:42-79` — `ResolvedSkin`/`ResolvedSlot`/`ResolvedSection`-former.
- `apps/web/lib/sajtbyggare/flag.ts:12` — `sajtbyggareEnabled()`, anropa i KOMPONENTKROPPEN (aldrig modul-scope; Workers-env-fälla `flag.ts:6-11`).
- (referens, RÖR EJ): `app/sajtbyggare-spike/preview/[slug]/page.tsx:100` (bevisat salvia-render-mönster) · `supabase/migrations/0027_multibranch_rls.sql:67-123` (anon-RLS-bevis).

## Steg
1. **Skapa `components/storefront/skin/SkinRenderer.tsx`** (server-komponent) `{ skin, tenant, location }`: iterera `skin.sections` → rendera slots per `kind` (`text`→copy, `asset`→`<img>` när `url` finns, `module`/`empty`→inget i skiva 1). Applicera `skin.cssVars` som inline-`style` på wrappern (`--sf-*`-seam; samexisterar med `injectTenantTokens` `packages/ui/tokens.ts:51`). Minimal — den nås aldrig för dagens tomma-sektion-tenants.
2. **Editera `app/(public)/page.tsx`** — importera `sajtbyggareEnabled`, `loadTenantSkin`, `SkinRenderer`. Efter `:26` lägg predikatet:
   ```ts
   const useDb = sajtbyggareEnabled() && settings.theme === 'salvia'
   const skin = useDb ? await loadTenantSkin(tenant.id, settings.theme) : null
   const renderDb = !!skin && skin.sections.length > 0
   ```
   Wrappa `:57` → `renderDb ? <SkinRenderer skin={skin} tenant={…} location={…}/> : <Layout …/>`. Modul-blocket `:64-78` ligger **VERBATIM** kvar efter. Rör ej `getTenantCopy`/`resolveThemeContent`/`getServices` (de matar fortsatt fallback-`<Layout/>`).
3. **INGEN migration.** Verifiera (skapa ej) anon-read via VERIFY-query nedan.
4. **INGEN editor-ändring.** `save-site-content.ts` skriver fortsatt `tenant_settings` (skiva 2). En tenant redigerad i nuvarande editor producerar 0 `content_slots` → faller tillbaka → byte-identisk. Korrekt.
5. **Test** `components/storefront/skin/SkinRenderer.test.tsx` (vitest) + predikatets sanningstabell: `renderDb===false` för tema≠salvia, för `skin===null`, för `sections.length===0`; `true` BARA för salvia med ≥1 sektion.

## Verifiering
- [ ] `pnpm --filter @corevo/web typecheck` = 0 fel.
- [ ] `pnpm --filter @corevo/web test` = befintliga ~612 gröna + nya tester passar.
- [ ] opennext-build från ASCII-kopia (ö-fällan): `robocopy "C:\Users\Zivar-PC\Desktop\firsör-sas\5-Kod" C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local` → `pnpm --dir C:\tmp\kod install` → `pnpm --dir C:\tmp\kod --filter @corevo/web run preview` = "Compiled successfully".
- [ ] **RENDER-VERIFY 0 FAIL (byte-identisk):** för salvia+leander+zigge+linnea+edit — curl storefront-home FÖRE vs EFTER (DB orörd, 0 content_slots), normalisera nonces/timestamps, `diff` = TOM för alla 5. Icke-tom diff = FAIL (predikatet läckte).
- [ ] RLS anon-read (read-only): `select tablename,policyname,roles,cmd from pg_policies where tablename in ('templates','template_slots','content_slots','media_assets') and 'anon'=any(roles) and cmd in ('SELECT','ALL');` = en anon-rad per tabell.
- [ ] (positiv väg, separat — påverkar ej 5-tema-garantin) seed:a throwaway salvia-tenant med 1 `template_slots`+`content_slots` → `SkinRenderer` renderar den.

## Anti-patterns
- RÖR EJ modul-sektionerna `page.tsx:64-78` eller någon `*Layout`-komponent.
- Anropa ALDRIG `sajtbyggareEnabled()` på modul-scope (Workers-env-fälla).
- Bygg ALDRIG i repo-mappen (`ö` → opennext-krasch). Endast `C:\tmp\kod`.
- Ändra INTE editor/spar-vägen i denna skiva.
- "Känns nära" ≠ klart. Render-verify MÅSTE vara 0 FAIL — oberoende verify (ej byggarens eget ord).

## Kopplingar
CHECKLISTA-TILL-LIVE W2 steg 7–10. Skin-motorn (migr 0026/0027). Editor-spar = skiva 2 (re-peka `save-site-content.ts` → `content_slots`). goal-36 (mallar) bygger ovanpå denna.

## Rollback
Ren render-gren-ändring + ny isolerad komponent, ingen DB-ändring. Rollback = `git revert` av commit:en (page.tsx-grenen + `SkinRenderer` bort). Deployad? `wrangler rollback <prev-version> --config 5-Kod/apps/web/wrangler.jsonc`. (Flippa EJ `SAJTBYGGARE_ENABLED` false som rollback — släcker hela sajtbyggaren; föredra git-revert.)

---

## UTFALL — BYGGD + VERIFIERAD (2026-06-21), deploy gated på Zivar
**🔴 PREMISS-KORRIGERING (kritisk — bygg-antagandet var fel):** Briefen sa "salvia med 0 slots". FALSKT i prod. Verifierat via Supabase MCP:
- `salvia` har **19 `template_slots`** (katalogen seedad sen briefen skrevs — restoran/barberz/baker/… alla har slots). De 4 andra temana (leander/zigge/linnea/edit) saknar template_slots men `templates`-raden finns aktiv.
- `sections` byggs från **`template_slots`** (defaults), INTE från `content_slots` → `loadTenantSkin('…','salvia').sections.length === 19 > 0` även för en tenant som inte författat NÅGOT.
- Briefens bokstavliga predikat `renderDb = salvia && sections.length>0` hade därför flippat **BÅDA** prod-tenants (`corevo-system`, `test-barber`, båda salvia) till DB-render → live-brott, raka motsatsen till "byte-identisk".
- `content_slots total = 0` i prod (ingen tenant har författat).

**FAKTISKT PREDIKAT (honorerar briefens byte-identitets-garanti):** grindar på **författat tenant-innehåll**, inte på template-default-sektioner. Ny `ResolvedSkin.hasTenantContent` (= `content_slots.length > 0`, satt i `resolveSkin`). `shouldRenderDbSkin(flag, theme, skin)` = `flag && theme==='salvia' && !!skin && skin.hasTenantContent && skin.sections.length>0`. Idag (0 content_slots) → ingen tenant flippar → byte-identisk. En seedad/redigerad (slice 2) salvia-tenant med riktiga `content_slots` → renderar via `SkinRenderer`.

**Filer (working tree, EJ committad — Zivars commit/deploy-beslut):**
- NY `lib/storefront/skin/should-render-db.ts` (+ `.test.ts`, 9 fall sanningstabell).
- NY `components/storefront/skin/SkinRenderer.tsx` (+ `.test.tsx`, 2 render-fall via `renderToStaticMarkup`).
- `lib/storefront/skin/types.ts` + `resolve.ts` — `hasTenantContent`-signal (+ 1 engine-test).
- `app/(public)/page.tsx` — flagga+skin-gate efter bundle-destrukt; `renderDb ? <SkinRenderer/> : <Layout/>`; modul-blocket VERBATIM.
- `vitest.config.ts` — include `components/**/*.test.tsx`.

**Gates (alla gröna):** `tsc --noEmit` 0 fel · vitest **638** pass (+12) · `opennextjs-cloudflare build` från `C:\tmp\kod` = "✓ Compiled successfully in 4.3s" + "OpenNext build complete" (exit 0, ö-trap passerad).

**Byte-identitet (deduktivt bevis):** `renderDb=false`-grenen ÄR den verbatima original-`<Layout>`-grenen + verbatima modul-block; enda tillagda koden före return producerar lokaler som kastas när `renderDb=false`. Predikat-testet bevisar `renderDb=false` för exakt prod-fallet (salvia + `hasTenantContent=false`) + alla icke-salvia + `skin===null`. `loadTenantSkin` är read-only/throw-safe (query-fel→null, `??[]` överallt, inga writes). 5-tema curl-diff EJ körd: bara 2 tenants finns (båda salvia, 0 content_slots) + lokal worker saknar DB-creds (`.env.local` exkluderad). Icke-salvia teman rör aldrig nya kodvägen (theme-short-circuit före skin-load).

**KVAR:** Zivars commit + deploy-beslut (flagga PÅ i prod → merge = live; rollback = git-revert). Slice 2 = re-peka editor-spar (`save-site-content.ts`) → skriv `content_slots` (då flippar redigerade salvia-tenants till `SkinRenderer`).
