# Arbetslogg — prestandaplanen steg 1–4

Löpande logg för /loop-körningen. Källa: `00-PRESTANDA-AUDIT.md` §5.

## Steg 1 — dela tema-data från React-komponenterna (A1) — KLAR ✅

**Resultat (mätt ur `.next/app-build-manifest.json`):** rot-`/layout` 13 → **4 stylesheets**
(auditens exakta mål). De 4 kvar = globals+tokens (2), booking-global, portal-global — **noll
tema-CSS-moduler**. Storefront-temagrafen är ute ur login/admin/404/api-isolatet. Palett-`<style>`
ligger kvar inline via genererad sträng (ingen modulgraf). `/(public)/layout` bär nu de 10
storefront-CSS-modulerna — korrekt isolerade till storefront-rutter.

**Verifiering:** `next build` exit 0 · `tsc --noEmit` rent · hela vitest-sviten **1083 pass/90 filer**
(storefront-render/foton/kontrast oförändrade + 2 nya vakter) · lint 0 errors.

**Codex-granskning:** SUND. Kvar-not (ej steg-1-scope): admin/plattform-SIDOR (`CreateTenantForm`,
`theme-palettes/content/capabilities`, `SidaStudio`) drar fortfarande hela registry→React-grafen.
Sällan-rutter, ej varje request → **följdfix** (lean metadata-registry), ej nu. Deploy-scriptet
kör nu drift-vakten före build (npm run deploy skippade tester).



**Mål (mätbart):** `app/layout.tsx` (kör på varje request) ska inte längre dra in
storefront-modulgrafen. `/login` från 13 stylesheets → 4.

**Beslut / avvikelse från auditen:** Auditen föreslog att splitta 13 `.theme.ts` i
data+komponent (26 handredigeringar i bokningskritisk storefront, "medel risk").
Valde i stället **codegen** — lägre risk, samma mätbara utfall:
- `components/storefront/layouts/theme-css.generated.ts` — rena string-konstanter, **noll imports**. `app/layout.tsx` importerar därifrån.
- Genereras UR registryn (enda sanningen) via `theme-css.sync.test.ts` med `GEN=1` (`npm run gen:theme-css`). Vitest kan importera tema-grafen vid build/test-tid; Workern gör det aldrig.
- Vakt-test 1: committad fil === färsk render ur registryn (drift omöjlig utan att testet faller).
- Vakt-test 2: genererade filen har noll `import`/`require` (auditens grep-test, som riktig invariant).
- **Tema-filerna orörda → storefront-render byte-identisk.**

**Filer:**
- Ny: `components/storefront/layouts/theme-css.generated.ts`
- Ny: `components/storefront/layouts/theme-css.sync.test.ts`
- Ändrad: `app/layout.tsx` (importrad 37-39 → generated-filen)
- Ändrad: `apps/web/package.json` (script `gen:theme-css`)

**Baslinje (mätt):** FLORIST_THEME_CSS 5320 tecken/27 block, EKONOMI 420/1, SALONG 1754/9.
Codegen-output byte-identisk mot baslinjen (samma JSON.stringify av samma registry-strängar).

**Tester körda:** `theme-css.sync.test.ts` (2 pass: drift-guard + no-imports). `tsc --noEmit` rent.

**Codex:** granskar avvikelsen + att ingen annan root/admin/login-graf-fil importerar registryt.

**Kvar innan commit:** full `next build` + inspektera `/login` emitterade stylesheets (13→4);
lint; render-/kontrast-vakter; login/admin/storefront/bokning-rök.

**Nästa åtgärd:** läs build.log när bygget klart → räkna /login-stylesheets.

## Steg 2 — vattenfallsfixar (C1,C2,C3) — PLANERAD, redo att implementera

Steg 1 committad: **8e65c38**. Working tree rent. Nästa = implementera C1→C2→C3.

### C1 — `app/(public)/layout.tsx` seriellt vattenfall (bästa vinst/risk)
Efter `currentTenant()` (rad 58) körs SERIELLT: `getTenantCopy` (78) → `getTenantModuleStates`
(88) → Promise.all services/locations/prefs (102, redan parallell) → `resolveStaffNoun` (113)
→ `resolvePrimaryCta` (123) → `loadUpcomingEvents` (156, inne i navLinks) → `loadTeamMembers`
(184, inne i navLinks). Alla behöver bara tenant.id/slug/vertical_id ur bundlen.
**Fix:** slå ihop de oberoende i ETT `Promise.all` direkt efter bundlen:
`getTenantCopy, getTenantModuleStates, resolveStaffNoun, resolvePrimaryCta(raw),
[services,locations,prefs], teamCount, kurserCount`. `primaryCta`-GATEN och navLinks-
modulgrindarna använder `moduleStates` → beräknas EFTER Promise.all (rent sync, ingen I/O).
`loadUpcomingEvents`/`loadTeamMembers` inne i navLinks byts mot COUNT: lägg
`countTeamMembers()` + `countUpcomingEvents()` (nya, `head:true, count:'exact'` eller
`.select('id',{count,head})`) i `lib/storefront/team/load-team.ts` resp `.../kurser/load-kurser.ts`
(båda redan `unstable_cache`, samma tenant-tag). Kurser-count körs i Promise.all men
DISPLAY gatas ändå av `moduleState(kurser)` i navLinks (som idag).
⚠️ Bevara EXAKT: modul-gatarnas villkor (live/paused), bokning-gaten (`bookingLive`),
tenant-isolering (app-lager `.eq('tenant_id')` i counts). navLinks-ordlearning oförändrad.

### C2 — `cache()` på `currentTenant` (+ ev. admin-läsare)
`currentTenant()` anropas 2×/storefront-request (generateMetadata + PublicLayout) + barnsidor.
Wrap i React `cache()` (request-scoped dedupe). Läs `lib/tenant-data.ts` `currentTenant` först
— kolla om redan `cache()`/`unstable_cache`. Lågt risk. Samma för admin-läsarna auditen nämner.

### C3 — join i `getCurrentUser`
Läs `@corevo/auth` getCurrentUser — auditen: undviker dubbel tenant/roll-hämtning via en join.
Läs innan ändring; bevara roll-nivå-semantik (`private.role_level()`), ingen behörighetsregress.

**Verifiering steg 2:** build, `tsc`, `npm test` (1083+), lint, mät P99-relevant (kan ej mäta
prod-P99 lokalt → verifiera i stället: färre seriella await, oförändrad navLinks-output via
render-test/manuell). Commit avgränsad. INGEN push/deploy förrän alla 4 steg klara (loop-order).

**Nästa exakta åtgärd efter compact:** läs `lib/tenant-data.ts` (currentTenant) +
`@corevo/auth` getCurrentUser, implementera C2 (minst risk) → C1 → C3.

## Steg 2b (följdfix, ej blockande) — metadata-registry för admin/plattform-sidor
Codex-not: `CreateTenantForm`, `theme-palettes/content/capabilities`, `SidaStudio` drar
fortfarande registry→React-grafen på sina rutter. Ej varje-request. Gör EFTER steg 1–4 om tid.
## Steg 3 — minnesbovarna kunder/statistik (C4,C5) — EJ STARTAD
## Steg 4 — klientvikt: lazy realtid/kalender + bild-srcset (B3,B4,B5) — EJ STARTAD
