# Arbetslogg — prestandaplanen steg 1–4

## ✅ ALLA 4 STEG KLARA + DEPLOYADE (2026-07-15, tag v1.31.3)

Commits på main: steg1 `8e65c38`, steg2 `8e1752a`, steg2b `6fbeeab`, steg3 `caee157`,
steg4 `e69714f`, slutfix `4f75551`. Pushade + deploy **v1.31.3 grönt** (CI/OpenNext på
Linux, 2m9s). Codex slut-GO (0 blockerare). Migration 0067 på prod.

**Prod-rök (curl):** /login 200 "Logga in" · freshcut.se storefront 200 "FreshCut" · /boka 200
"Boka tid" · /om,/tjanster,/kontakt,/shop 200 · /admin,/salonger,/admin/kunder → 307 login-gate
(ingen 500). **Steg 1 bekräftad live: /login 13 → 3 stylesheets** (+ 3 små inline palett-`<style>`);
storefront behåller sina 14 (korrekt isolerade till publika rutter), data-theme intakt.
Ingen regress på login/storefront/bokning/admin.

## Step 6 — MÄT OM (2026-07-15 06:02Z, ~4,5h efter deploy)

Mät-skript: `5-Kod/apps/web/scripts/cf-exceeded.mjs` (Cloudflare GraphQL, `workersInvocationsAdaptive`).

| Fönster | requests | exceededResources | andel |
|---|---|---|---|
| 6 dygn (baslinje) | 15 490 | 69 | 0,445 % |
| 24h (mest före deploy) | 2 552 | **47** | **1,842 %** |
| sedan deploy (~4,5h) | 23 | 0 | 0 % |

**Slutsats: FÖR TIDIGT.** Baslinje bekräftad. Krascherna ACCELERERADE före deployen (24h-takt 4×
6-dygnssnittet — 47/69 kom senaste dygnet, stämmer med minneshypotesen). Post-deploy 0/23 crashes
men 23 requests är statistiskt meningslöst (väntat ~0,4 vid gammal takt). **Ingen kodändring behövs.**
Kör om `scripts/cf-exceeded.mjs` om ~2-3 dygn och jämför 24h-takten mot 1,842 %. Sjunker den tydligt
→ steg 1-3 bet. Gör den inte → mät minnet direkt (auditens plan B).

Kvar (utanför loopens 4 steg): step 5 "resten" (Suspense i admin, lazy mall-uppslag A2, font-
tokens B6, C6 realtids-gating, död kod), step 6 "mät om" (6 dygns prod-data → jämför
exceededResources). Följdfixar: steg 2b metadata-registry (admin/plattform-sidor), B5-svep för
ekonomi-zentums egna `<img>`, getCustomerLoyalty-konsistens (gjord).

---


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

## Steg 2 — vattenfallsfixar (C1,C2,C3) — KLAR ✅

**C2** `lib/tenant-data.ts`: `currentTenant()` → React `cache()` (anropades i generateMetadata
+ PublicLayout + barnsidor; headers()+override kördes om varje gång). Request-dedupe.

**C3** `lib/auth/session.ts` `getCurrentUser`: två seriella frågor (users→roles) → EN FK-embed
`roles:role_id(level,name)`. FK `users_role_id_fkey` bekräftad; join-data verifierad mot prod
(salon_admin=6/staff=3/kund=2). Defensiv array-eller-objekt-normalisering. Fail-closed (null→level 0).

**C1** `app/(public)/layout.tsx`: 6 seriella await → ETT `Promise.all` (copy, moduleStates, wizard-trio,
staffNoun, rawPrimaryCta, teamCount, kurserCount). Modul-derivationer (booking/shop/nav-grindar/CTA-gate)
körs efteråt, ren sync. `/team` + `/kurser`-länkarna gatas på nya count-hjälpare
(`countTeamMembers`/`countUpcomingEvents` i load-team/load-kurser) i stället för fulla list-laddningar.

**Codex-granskning:** C3/parallellisering/wizard-gating OK. Fann EN regress: `countTeamMembers`
räknade blanksteg-titlar som loadTeamMembers trimmar bort → risk för /team-länk till tom sida.
**Rättad:** hämtar bara `title`, filtrerar trim i app-lagret = exakt render-villkoret.

**Verifiering:** build exit 0 (rot-/layout fortf. 4 css → steg 1 orört) · `tsc` rent · 1083 tester ·
lint 0. P99-vinsten kan bara mätas i prod (steg 6) — här bevisat: färre seriella hopp, gating oförändrad.

**Filer:** tenant-data.ts, auth/session.ts, (public)/layout.tsx, storefront/team/load-team.ts,
storefront/kurser/load-kurser.ts.

## Steg 3 — minnesbovarna kunder/statistik (C4,C5) — KLAR ✅ (väntar Codex innan commit)

**C4 `/admin/kunder`** (den farligaste; korrekthetsbugg vid 1000+ kunder). Laddade ALLA kunder
med inbäddad bokningshistorik + HELA loyalty_ledger → JS-aggregering; PostgREST kapar vid taket
→ TYST fel. Kunddetaljsidan drog HELA listan för EN kunds poäng.
- **Ny migration `0067_admin_customer_rows_rpc.sql`**: RPC `admin_customer_rows(p_tenant, p_customer?)`,
  SECURITY INVOKER (samma RLS), aggregerar visits/last_visit/loyalty_points i SQL. **Applicerad på
  prod** (create-or-replace = idempotent) + **paritetsverifierad: 7 freshcut-kunder, 0 avvik** mot
  manuell count/sum/max.
- `lib/admin/data.ts`: `listCustomers` → RPC (maskering/nivå kvar i JS). Ny `getCustomerLoyalty`
  (en kund, returnerar null för icke-aktiv/skrubbad → ärlig tom-text, aldrig 0/Ny).
- `kunder/[id]/page.tsx`: `listCustomers(hela listan)` → `getCustomerLoyalty` (en kund).
- `packages/db/types.ts`: RPC-typ handlagd (ingen full-regen).

**C5 `/admin/statistik`** (`lib/admin/stats.ts`). Laddade HELA kundtabellen (kapas 1000+ → tyst
newCustomers-fel). Fix: hämta first_seen_at BARA för periodens boknings-kund-id:n (`.in()`),
aggregateStats-matten **oförändrad** → identiska siffror, utan taket, utan hela tabellen i isolatet.
**Medvetet EJ gjort:** portat boknings-fönstrets aggregering (occupancy/trend) till SQL — testad
ren logik, tidsbunden (12-24 mån), kan ej paritetsverifieras mot freshcups lilla dataset. Ärligt
dokumenterat; boknings-fönstret är tidsbundet, inte kund-antals-skalande.

**Codex-granskning → 3 fixar applicerade:**
1. Grant-bugg: `revoke from anon` tog inte bort PUBLIC:s default-EXECUTE → nu `revoke from public`
   före grant. Verifierat: `has_function_privilege('anon',…)` = **false**, authenticated = true.
2. C4 1000-rads-tak: `listCustomers` sidhämtar nu RPC:n i block om 1000 (`.range`-loop) + RPC:n
   fick unik tie-break (`order by last_seen_at, id`) → svansen tappas aldrig vid 1000+ kunder.
   (Projektet har f.ö. INGET `pgrst.db_max_rows` satt — men loopen är korrekt oavsett.)
3. C5 `.in()`-tak: chunkar kund-id:n i block om 1000 + kastar på fel (svalde det förut).

**Verifiering:** `tsc` rent · 1083 tester · lint 0 (app) · build exit 0 · RPC-paritet 0 avvik ·
grant verifierad (anon=false/authed=true) · rpc_rows=7.

## Steg 2 — GAMMAL PLAN (klar, historik)

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
## Steg 4 — klientvikt: lazy realtid/kalender + bild-srcset (B3,B4,B5) — KLAR ✅ (väntar Codex)

**B3** RealtimeBookings (osynlig, drar hela Supabase-browserklienten ~55-70 kB gzip på VARJE
back-office-sida) → ny klient-wrapper `RealtimeBookingsLazy.tsx` med `next/dynamic(ssr:false)`.
De 3 server-layouterna (admin/personal/platform) renderar wrappern → realtidsklienten laddas i
egen chunk EFTER hydrering, av kritiska JS-vägen. (ssr:false kräver klientkomponent → wrappern.)

**B4** `CalendarBoard.tsx`: NewBookingDrawer/BlockDrawer/CalendarHelp/CancelledLog → `next/dynamic`
(visas bara vid klick → egna chunks, ~40-50 kB av initialladdningen). BookingDrawer lämnad STATISK
(delar modul med synkrona render-hjälpare dayKey/isAvbokad/… som behövs eagerly).

**B5** Ny hjälpare `components/storefront/img.ts` `unsplashSrcSet()` — genererar 480/800/1200/1600-
srcset ur Unsplash-URL:ens `w=`, undefined för icke-Unsplash (R2-uppladdningar orörda). Appliceras på
de DELADE render-punkterna (HeroCarousel, Gallery grid+lightbox, sections AboutSplit) + `sizes`.
Tema-`.theme.ts` BYGGER bara URL:er, renderar inte — de går genom dessa delade komponenter.
**Kvar (dokumenterat):** ekonomi ZentumLayout/zentum.pages har egna direkta `<img>` (Unsplash) utanför
delade komponenter; module-vyer (shop/galleri/team) renderar mest R2-uppladdningar (hjälparen = no-op).
Följdsvep vid behov. Test: `img.test.ts` (2 nya, 1085 totalt).

**Verifiering:** `tsc` rent · lint 0 · 1085 tester · build exit 0 · rot-/layout fortf. 4 css.

## Steg 4 (gammal placeholder) — klientvikt: lazy realtid/kalender + bild-srcset (B3,B4,B5)
