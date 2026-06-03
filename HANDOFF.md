# HANDOFF — Corevo Booking Platform

Klistra in detta i nästa Cowork-session så Nörden är ikapp direkt.

## ⭐ NÄSTA SESSION — GÖR DETTA FÖRST
**Planen för resten av bygget = `2-Byggplan/WORKFLOW-03-baseline-sakerhet-test.md`** (lager-djup orkestrering: recon-flotta → syntes → bygg → attack-flotta per fas; autonomt svep; går live + städar rot/git-träd på slutet). FreshCut-seed klar i `2-Byggplan/goals/freshcut-seed-data.md` (riktiga priser/öppettider/tel). Kör FAS 0 → VÅG 1 → … enligt dokumentet.

### 2026-06-03 (WORKFLOW-03 VÅG 1 — rollgränser) KLAR + LIVE-VERIFIERAD ✅ (worker `b2895b3f`)
- **Guard:** `middleware.ts` step-4b = app_metadata-only roll→yta-guard (bouncar `platform_admin` av tenant-scopade `/admin`+`/personal` → `/` platform-dashboard; INGEN DB-join — designen förbjuder roll-läs i middleware). `roles.ts` trösklar härdade mot verklig DB `{2,3,6,8}` (admin 5→6, platform 7→8; fantom-nivå-footgun bort). Nya `lib/auth/roles.test.ts` (3) + utökad `e2e/backoffice-routing.spec.ts` (rollmatris-celler).
- **Live-verifierat (Workflow `w4n6hq2t2`, 3 adversariella agenter): rollmatris 0 brytbara celler.** super_admin→/admin+/personal→**`/`** ✓ · staff→/personal, →/admin→/ingen-atkomst ✓ · salon_admin→/admin, →/salonger+/fakturering→/ingen-atkomst ✓ · http-edge 8/8 (POS 200, auth-gate på subpaths/trailing-slash, storefront-bounce) ✓ · code-adversary **`guardSound=true`** (7 vektorer, 0 bypass) ✓. Gates: typecheck+lint+**vitest 142/142**. opennext-build PASS, grep-guard byggd middleware = ren (ingen `localhost:3000`).
- **🔧 FIX (pre-existing regression):** `platform@corevo.se` kunde EJ logga in live (lösen-hash ≠ `Demo!1234`, samma symptom som `_klart/fix-G13-login.md`) → blockade super_admin-verifieringen. `admin@`/`klippare@` loggade in fint via SAMMA action → isolerat till det kontot. **Reseedat på molnet:** `update auth.users set encrypted_password = crypt('Demo!1234', gen_salt('bf')) where email='platform@corevo.se'` → loggar nu in. (VÅG 3 reseedar ändå allt.)
- **Residual (dokumenterat, ej hål):** guarden = GET-yta, ej action-POST (DAL re-fence:ar via `requirePortal`/`requirePlatformAdmin`); **väg B** (auth-hook → roleLevel i JWT → full matris i EN guard) = Zivars Dashboard-toggle, SQL+steg i `5-Kod/docs/ops/auth-hook-role-claims.md`; **om `/t/:slug/:path*`-rewrite nånsin läggs till MÅSTE den speglas i guarden** (annars HIGH platform_admin→/admin-bypass; idag 404, ej exploaterbar).
- **Rollback:** `git revert` (rent tillägg) + redeploy. POS orörd (corevo.se+/admin → 200 före+efter).

### 2026-06-03 (storefront-fix + Varumärke verifierat) — DÄR CODE STÅR NU
- ✅ **Storefront restaurerad + live-verifierad.** `freshcut.corevo.se` → 200, `x-corevo-tenant-kind: tenant`, salvia renderar (hero "Skarpt klippt. Skönt mottagen.", nav, footer m. öppettider, `/tjanster` listar Klippning 450 kr, `/om`). **Worker-ver `06a960c1`.** POS orörd (`corevo.se` + `/admin` → 200).
- ✅ **Varumärke §4.3-flaggskeppet live-verifierat** (som freshcut salon_admin): swatch-väljare (4 färgroller + egen färg), font-tiles, dirty→Publicera-gating, "ändrad"-pill, live browser-chrome-preview, Ångra rent. Hidden-input `color_primary` synkar work-state → `saveBranding` rätt värden. **Inga DB-muteringar** (testade klient-state + ångrade; freshcuts branding orörd).
- 🔧 **Grundorsak till nattens 404 hittad + härdad:** deploy lät dev-filen `.env.local` (localhost:3000) läcka in i bygget → Next inlinade localhost som root-domän → alla tenant-subdomäner 404. **Härdat:** `/XF .env.local` räcker INTE (robocopy `/PURGE` rör ej redan-kopierad fil) → måste **radera `.env.local` ur bygg-trädet** + **grep-guard på byggd `middleware.js` efter `localhost:3000`** innan deploy. Runbook + minne uppdaterat. Commit `82cb4ce`.
- 🧹 Skärmdumpar → `4-Dokument-Underlag/skarmdumpar-bygg/`, repo-roten ren.

### ⚠️ ÖPPET BESLUT (Zivar) — committat LOKALT, EJ pushat
Commits på main, **bara lokalt**: `5f7442e` (FAS0-docs), `34ce303` (Varumärke), `82cb4ce` (runbook). Live-fixen krävde ingen repo-ändring. **Ska Code pusha till GitHub?** Utåtriktad åtgärd → görs INTE autonomt, väntar på Zivars ja.

### 🐛 NY BUGG (2026-06-03, Zivar live) — Varumärke "Spara bilder & innehåll" kraschar vid bildborttagning
- **Symptom:** salon_admin (freshcut) → `/admin/varumarke` → ta bort en bild (closing-bild och/eller team-bild) → **"Spara bilder & innehåll"** → sidan kraschar med error-boundary **"Något gick fel / Sidan kunde inte laddas just nu"**. Spara UTAN att ta bort bild = funkar. (Code:s §4.3-verifiering täckte färg/font-vägen, INTE media-spar-vägen.)
- **Var:** `saveStorefrontMedia` i `apps/web/lib/admin/actions.ts` (~rad 689–818). Borttagning triggar `pruneRemovedImages` (rad 802) → `removedImageKeys`/`keyFromPublicUrl`/`deleteKeys` i `apps/web/lib/r2/upload.ts`.
- **Hypotes (Nörden):** removal-vägen kastar ett **ohanterat undantag** (troligast `new URL()` i `keyFromPublicUrl` på en icke-absolut/ogiltig lagrad URL — t.ex. när `R2_PUBLIC_BASE_URL` saknas — ELLER `getBucket()` i `deleteKeys` som kastar istället för null) → server-action rejectar → error-boundary. **VIKTIGT:** DB-upsert sker FÖRE prune (rad 794), så datan kan ha **sparats medan UI visar krasch = tyst halv-lyckat** — exakt den "data ser ut att försvinna"-klass Zivar oroar sig för.
- **Fix-riktning:** wrappa hela svansen (prune + revalidate) så en städ-/parsnings-miss ALDRIG kraschar en redan-lyckad save (best-effort, logga, returnera success). Härda `keyFromPublicUrl` mot null/relativa/redan-borttagna URL:er. Repro: ta bort closing_image + team-bild, spara. Samma princip som FX-14/B1 ("best-effort cleanup blockerar aldrig en lyckad save").
- **Prio:** hög — rör en kärnyta (Varumärke) + är i tyst-halv-lyckat-klassen. Lägg in i VÅG 2/VÅG 5-härdningen eller som egen liten fix-brief före.

### KÖORDNING (parkerat för säkra fönster — följer WORKFLOW-03)
1. **VÅG 1** rollgränser — bounce super_admin från `/admin` (liten middleware-stopgap → full guard).
2. **VÅG 2** migr `0013` (loyalty-earn + boknings-spårbarhet, additivt, efter PITR-koll) + ingen hård-delete av bokning.
3. **VÅG 3** destruktiv FreshCut-reset (goal-15) — **PITR-gated, kräver Zivars go** + goal-16 kunddomän.
4. **VÅG 4** realtime + multi-location.
5. **VÅG 5** djup säkerhets-/robusthet-svep (mangling).
- Doc-skuld: runbooken nämner fortf. `demo.corevo.se` på ställen (slug bytte demo→freshcut) — städa vid tillfälle.

**Äldre testlista:** `2-Byggplan/TESTA-DETTA.md` (natten 2026-06-02).

### 2026-06-02 (WORKFLOW-02 helsvep) — ALLA VÅGOR + M8 KLAR + DEPLOYAT LIVE ✅ (worker-ver `a4b6e1d2`)
Kör `2-Byggplan/WORKFLOW-02-helsvep.md` uppifrån. Adversariell multi-agent-orkestrering.
- **FAS 0 (plan vs kod):** 7 modul-granskare + fryst/våg-krock + bugg-verifiering, varje high-fynd adversariellt verifierat. Fynd → `2-Byggplan/FAS0-fynd.md`. Naming-frysen ren. 3 M-dok korrigerade (M3 "togs-av-annan" redan byggd; M4 nudge=bekräftelse-popup, betalnings-frikopplad; M7 §2.1A carve-out: basal token-branding=tillåten no-code). Zivar-beslut: M7 carve-out, lojalitet-ledger byggs nu, M2-copy/no-show i settings-JSON.
- **FAS 0.5 (kända buggar):** B1 savePlatformBranding-clobber FIXAD via delad `5-Kod/apps/web/lib/branding/merge.ts` (M6+M7 mergar `...prev`, aldrig ersätt jsonb; R2-prune bara logo) + regressionstest. B2 "Idag-krasch" REPRODUCERADE EJ (todayInTz ger giltig sträng) → defensiv try/catch-guard i `lib/personal/calendar.ts`. vitest 90/90.
- **VÅG 0 (frusen DB-grund, solo):** migration **0011 APPLICERAD** mot molnet (clylvowtowbtotrahuad, additiv, transaktions-atomisk) — nya tabeller `customers` (identitet+PII, status-anonymisering), `customer_favorites`, `loyalty_ledger` (append-only, härledd saldo), `customer_notes` (strikt internt klientkort), `working_hour_slots` (explicita starttider, samexisterar med working_hours-range; `seed_explicit_slots_from_hours`-fn opt-in) + `bookings.customer_id` + `staff/services.slot_step_min/buffer_min`. RLS på alla 5 via `private.tenant_id()`/`current_customer_id()`; **kund-roll-RLS bevisad live** (kund ser 0 i alla, särskilt `customer_notes`). Backfill 3 gäst-kunder, 7/7 bokningar länkade. `packages/db/types.ts` regenererad. GDPR `erase.ts` utökad (anonymiserar customers cross-tenant + via e-post-match, raderar favoriter, scrubbar notes via trigger + cross-tenant booking-notes; behåller payments/loyalty). Design-token-baseline (M2 §2.4) = redan runtime-tenant-drivet (inget rört). **Säkerhetsfix 0012 APPLICERAD:** `get_customer_contact` failade öppet för anon (NULL-identitet → fence blev SQL-NULL → ingen raise) → PII-läcka via anon-exponerad RPC; fixad (null-guard + `revoke execute from anon`), verifierad live (anon-anrop → `42501 permission denied`).
- **⚠️ KRITISKT DB-faktum:** `bookings.customer_profile_id` = lös uuid UTAN FK men ett LIVE-kontrakt (RLS 0010:49, app-filter, GDPR-nyckel) → RÖRS ALDRIG. `customer_id` är den NYA stabila identiteten parallellt. Live tenants nu = frisor3/studio/arsgw/kvikta (tidigare "en demo-salong"-not är STALE).
- **VÅG 1 KLAR + COMMITTAD** (`5773b69`; Våg 0 + FAS 0.5 = `65b63fb`). Parallellt, skilda revir: **M2 storefront** (SEO-svit sitemap/robots/JSON-LD/generateMetadata + ägar-copy via delad `settings.copy`-modell + token-audit ren), **M6 salon-admin** (kunddatabas-vy `/admin/kunder` + nav + explicit-slot-schema-editor `working_hour_slots` + branding-editor undo/preview/copy-fält + död SMS-toggle bort + bokningssök/dashboard/invite), **M7 platform** (operativ data-kontroll-UI Google-länk/lösenords-reset/redigera-tenant + boknings-vy-val `settings.booking.variant` + §2.1A carve-out). typecheck+lint+**vitest 108** grönt; granskningar minor-gaps; B1+carve-out verifierade korrekta (M6+M7 mergar båda branding). **EJ deployat** (ops/ASCII-väg).
  - **READ-sidan deferrad till Våg 3 (M3-kärna):** availability läser ej `working_hour_slots` än; storefront läser ej `settings.booking.variant` än (admin-UI ärligt labelat tills dess). Lågprio-gap kvar (og:image, branding-undo färg/font, visit-count framtida, "spegla verklig dag").
- **VÅG 2 KLAR + COMMITTAD (`49f5648`):** M4 kundportal (lojalitet via loyalty_ledger + favoriter via customer_favorites + snabb-rebook-länk + Google-nudge-popup) · M5 personalportal (klientkort via customer_notes + drop-in/walk-in; frisörens self-edit av baseline bort → M6 äger).
- **VÅG 3 (M3) + VÅG 4 + M8 + storefront gold-leak-fix KLAR + COMMITTAD (`11cdc66`, pushad) + DEPLOYAT LIVE.** wrangler domain-rekoncil = `2f6f04a`. Gate: typecheck+lint+**vitest 138/138**. **Live worker-ver `a4b6e1d2-fbfe-4656-bb83-55645cb57f12`; ROLLBACK = `5636e4e9-b185-4c3c-80cd-64146852a1cb`** (`wrangler rollback <id> --config 5-Kod/apps/web/wrangler.jsonc`). opennext-build PASSADE (riktiga grinden). Domains booking+freshcut re-asserted (FX-14 noll-churn), POS corevo.se orörd (200).
  - **M3 bokningsmotor (allt DORMANT i prod, deploy_safe):** per-staff/service slot_step/buffer (fallback ?? 15/0); working_hour_slots explicit-väg med OBLIGATORISK range-fallback (live whs=0 rader → alla frisörer tar range-vägen, samma slots som förr); settings.booking.variant (osatt→wizard). `lib/booking/holds.ts` = REN funktion, refererar ALDRIG slot_holds i runtime. Live-verifierat: freshcut/boka renderar riktiga tjänster + 5-stegs-wizard.
  - **M8 betalningar (Stripe-call-fritt, ingen live-charge):** `lib/stripe/rebook-payment.ts` carryBookingPayment re-pointar payments.booking_id old→new + flippar ny bokning pending→confirmed (succeeded-only; no-op utan payment-rad → prod har 0 → ingen live-risk). `lib/booking/no-show-refund.ts` = ren, DORMANT (wirad ingenstans). Connect-webhook/RPC/RLS/charge-gate orörda. **Rebook-vägen SHIPPAD men EJ live-klickad** (saknar verifierat kund-cred; effekten bevisat inert utan betalning). **FYND (pre-existing, ej M8-scope):** `app/avboka/actions.ts cancelByToken` (gäst-token-avboknng) refundar EJ till skillnad från kund/personal-vägarna — refund-paritetsglugg att täppa NÄR betalning aktiveras.
  - **Storefront gold-leak FIXAD:** storefront `--color-accent` → `var(--color-primary)` (temats färg, aldrig Corevo-gold) i `packages/ui/tokens.css` + 3 dark-on-dark-följdfixar. Back-office gold orört.
  - **Våg 4 responsivt:** 44px touch-targets `@media (pointer:coarse)` (desktop byte-identiskt) + portal-tabeller overflowX:auto.
- **🌿 freshcut.corevo.se = salvia-temat NU SYNLIGT.** Roten till "ser likadant ut": tenantens `branding.color_primary/bg/fg` injicerades INLINE och maskerade temat. Zivar-auktoriserade rensning av de 3 hexen (`update tenant_settings set branding = branding - 'color_primary' - 'color_bg' - 'color_fg'`); rollback = återställ #1f4636/#fff/#111. Nu driver salvia (sage #5E7361 + varmt papper #F6F4EE + oliv). Se `memory/corevo-storefront-theme-precedence.md`.
- **KVAR:** migration `0014_slot_holds.sql` committad men **EJ applicerad** (M3 holds dormant → safe; applicera när hold/release wiras). Migration `0013` (lojalitet-intjäning) **ej skriven** (skjuten till senare workflow). Live Stripe-verifiering gatad på Zivars test-nycklar (M8 oprovbar live utan dem). Övrigt pending-owner oförändrat (SERVICE_ROLE_KEY-secret).

### 2026-06-02 (goal-14 mejl egen SMTP) — KOD-KLAR, Edge Function deployad, Worker-deploy pending-owner
- **Resend → egen one.com-SMTP** via Supabase Edge Function (`send-email`, Deno+nodemailer, **deployad v1 ACTIVE, `verify_jwt=false`**, fail-closed x-relay-secret — verifierat live 401/405). Workern POST:ar renderat mejl till funktionen över HTTPS; klassisk SMTP går ej på Workers. Resend-koden helt borttagen.
- **Per-salong-mejl:** From-namn = salongens namn (adress kvar `booking@corevo.se` (två o) för SPF/DKIM-align — FX-14 rättade kodens default + dashboard till två o), **Reply-To = `settings.contact.email`** (utelämnas om tom, förfalskas aldrig), mall bär salongens accentfärg + logga (monogram-fallback) + temats tagline som slogan. Faller tillbaka på Corevo-guld när data saknas. Graceful no-op när relä-secrets saknas (precis som gamla Resend-vägen) → bokningar oförändrade.
- Commits på main: E1 `9f86927` (Edge Function), E2 `d529495` (transport), E3 `e462a4b` (brand-mall), E4 `81709a1` (orkestrering+call-sites), E5 (tester+docs). typecheck+lint+**vitest 56/56** gröna; OpenNext-bundle verifierad byggbar (ASCII-väg, `worker.js` skapad).
- **KVAR (Zivar):** (1) ✅ `booking@corevo.se` (två o) skapad i one.com; (2) sätt Edge Function-secrets (SMTP_HOSTNAME/PORT/USERNAME/PASSWORD + EMAIL_RELAY_SECRET); (3) sätt Worker-secrets (EMAIL_RELAY_URL + EMAIL_RELAY_SECRET + NOTIFICATIONS_FROM); (4) one.com SPF/DKIM på corevo.se; (5) **deploya Workern** (production-deploy gated — `robocopy → pnpm ... run deploy`). Full tabell + live-test: **`5-Kod/docs/ops/mejl-egen-smtp.md`**.

### 2026-06-02 (städ + finputs) — KLART + DEPLOYAT (worker ver `2e0affcf`)
- **Storefront-finputs (commit `9132cb8`):** `/om` + `/kontakt`-sektionerna (AboutSplit/StylistSpotlights/ClosingCta) drar nu `resolveThemeContent` — ägar-uppladdad about/closing/team-media vinner, stark per-tema-default fyller i — istället för statiska `images.ts`-platshållare. tsc+eslint rent, deployat, live-verifierat (a11y-snapshot: about+team+closing+italic alla i DOM på demo/leander).
- **"Tom About-sektion" = FELLARM, avskrivet.** Hemsidan + /om är FULLT ifyllda (hero, prislista, italic-citat, stats, team). Det "tomma" i nattens fullPage-screenshot var bara `Reveal`-scroll-animationen (opacity:0 tills man scrollar) som aldrig triggas i en statisk helsides-screenshot — inte saknad data. Jaga inte den igen.
- **Repo-städ (commit `792fc87`):** roten rensad enligt CLAUDE.md (bara HANDOFF/CLAUDE/config + numrerade mappar + Nörden). G13-goals → `_klart/`; screenshots → `4-Dokument-Underlag/skarmdumpar-bygg/` (gitignorad), design-briefer → `4-Dokument-Underlag/design-brief/` (trackad), 5.9M design-handoff gitignorad (lokal). Stray `Frisören/` + `.write_test_xyz` borttagna.

### 2026-06-02 NATTKÖRNING (autopilot) — KLART + DEPLOYAT (worker ver `3557ada6`)
Allt tsc+eslint-rent, byggt, deployat live, smoke 200. Commits på main `0f57670`→`ae8b66b`.
- **Säkerhet:** migr 0009 (RPC identitet+past-time-fence) + 0010 (roll-medveten RLS bookings/payments) APPLICERADE + AFTER-verifierade 6/6 (kund ser ej andras bokningar). 
- **FAS 3:** 13 adversarial-fixar (a11y focus-traps/ARIA/kontrast, in-drawer-bekräftelse #11, rebook-kompensation, webhook account-fence, staff_id-fence) + post-review.
- **Wire G:** admin notis-toggles + Google-recensions-URL-fält; pref-guards på bekräftelse/påminnelse.
- **SMS:** krok + per-salong-toggle (av; ingen leverantör än).
- **Gäst-avboka:** HMAC-token-länk i mejl + `/avboka/[id]` publik sida (token-gated, avboknings-fönster).
- **DESIGN (huvudgrejen):** 5 distinkta storefront-tema-layouter (Salvia/Leander/Zigge/Linnea/Edit) som `settings.theme`-presets; bokning Variant 3 (default) + Variant 4 (snabbboka) inbäddat, mobil bottom-sheet; back-office Corevo-reskin (forest sidebar + portal/ui-primitives, `[data-world=backoffice]`-scoped, kund/konto orörd); **två CSS-världar**; guld tenant-överstyrbart storefront/fryst back-office; **⭐ ägaren laddar upp egna storefront-bilder (R2)**; cookie-banner. Plan/partition: `2-Byggplan/WAVE-3-BUILD-PLAN.md`, logg `2-Byggplan/NIGHT-BACKLOG.md`.
- **KVAR (Zivar):** mejl-secrets ⇒ **uppdaterat av goal-14: Resend ersatt av one.com-SMTP-väg** (se 2026-06-02 goal-14-blocket ovan + `5-Kod/docs/ops/mejl-egen-smtp.md`); `R2_PUBLIC_BASE_URL` (bildvisning); (senare) `SMS_PROVIDER_API_KEY`. **Kända luckor:** multi-location-val i bokning (demo=1 ställe funkar), lojalitet/poäng-feature. (Den tidigare "tom About-sektion"-flaggan är avskriven — se 2026-06-02-städ-blocket ovan.) Se TESTA-DETTA.
- **Deploy-not:** robocopy till ASCII-väg MÅSTE ha **/PURGE** (raderade filer annars kvar → bygget bryts). `robocopy <5-Kod> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local` → `pnpm --dir C:\tmp\kod --filter @corevo/web run deploy`.

**Nästa stora steg:** bygg en plan med Zivar (custom-domäner/"egen domän", multi-location, staging, tema-finputs) innan kod.

## Vad projektet är
Multi-tenant, white-label boknings-SaaS för salonger. EN kodbas, ny kund = ny tenant + config (aldrig ny template). Funktioner identiska för alla — bara utseende varierar. Freshcut = första tenant. Arbetsnamn: corevoboking.

Stack: Next.js (App Router) + Supabase (Postgres+Auth) + Cloudflare (Workers/OpenNext + R2) + Stripe Connect.

## Var allt bor
Öppnad mapp: `firsör-sas/` (på desktop). Källunderlag = 14 PDF:er i `Nörden/`.
- `1-Planering/` — 00-modulkarta, 01-DB-schema, 02-onboarding-flode, 03-pengaflode-stripe, 04-domanstrategi, ADR/01-tenant-och-tema, moduler/M2–M7
- `2-Byggplan/` — 00-roadmap, 01-parallell-exekvering, 02-START-HÄR-prompts, goals/goal-01..11
- `5-Kod/` — koden (byggs av Claude Code)

## Spikade beslut
- Auth = Supabase Auth + egna tabeller (users.id=auth.users.id), tenant_id som JWT-claim i app_metadata, RLS via auth.tenant_id().
- Stripe Connect Express + DIRECT charges. Kund betalar FULLT belopp för TJÄNSTEN vid bokning → rakt till salongens connected account. **application_fee = 0 i v1** (Corevo tar inget snitt på transaktionen). Betalning vid bokning = per-tenant toggle (`payments_enabled`); av → betala i salongen. Avbokning → refund via Stripe. (Corevos egen intäkt = flöde 2, se nedan, utanför transaktionen.)
- **Prismodell (flöde 2, BESLUTAT):** salongen väljer EN modell vid onboarding, valet sätter startavgiften. `tenant_settings.billing_model` = `per_booking` (låg/ingen startavgift + X kr/bokning, månadsfaktura) ELLER `flat_monthly` (startavgift ~3500 + 399 kr/mån). Belopp = config (öre), ändras när som helst. Fakturering sker MANUELLT av Zivar utanför systemet; G08 visar bara underlag (antal completed-bokningar/månad per tenant). Inget Stripe-bygge för flöde 2.
- Tema 3 nivåer: config (logga/färg/font) → layout-variant → custom CSS scoped [data-tenant].
- Dubbelbokningsskydd = Postgres EXCLUDE-constraint (btree_gist).

## Domän
- corevo.se = marketing (separat). booking.corevo.se = admin/platform.
- Tenants test-live på frisor1.corevo.se, frisor2.corevo.se... via wildcard *.corevo.se → Worker.
- ⛔ INGEN riktig kunddomän, INGEN CNAME/custom hostname förrän Zivar godkänner. localhost OK för dev.

## Supabase
Nytt projekt "ZivarMahmod's Project" (ref clylvowtowbtotrahuad, eu-north-1), tomt, kopplat. INTE Sadaqah Sweden.

## Byggmetod
- Claude Code får `/goal` en drop i taget i chatten. Foundation först (ensam), sen flera parallellt.
- Parallellt = git worktrees (en mapp per goal, samma repo). Aldrig 2 CLI i samma mapp.
- Vågor: Våg 0 foundation (G01+G02 solo) → Våg 1: G03+G04+G08 (3 parallellt) → Våg 2: G05+G06+G07+G09 (4 parallellt) → Våg 3: G10+G11 härdning.
- Varje goal: bygg exakt din grej, rör bara ditt revir, frysta filer (packages/db, packages/auth, middleware.ts, root-config) rörs aldrig parallellt, rapportera KLAR + STANNA.
- **Mappstädning (regel):** roten `2-Byggplan/goals/` innehåller BARA ej-klara mål. När en goal verifierats KLAR → flytta dess `goal-NN-*.md` + `_DROP-GNN-*.md` till `2-Byggplan/goals/_klart/`. Nörden gör detta som sista steg i varje verifiering.

## NULÄGE (uppdatera detta varje gång)
- Planering: KLAR.
- Foundation (G01+G02): **KLAR** — committat på main (386d8f6), DoD grön med bevis (build/lint/dev grön, RLS-isolering bevisad, dubbelbokningsskydd bevisat). DB applicerad på molnprojektet (Docker saknas → ingen lokal db reset).
- 3 worktrees skapade: wt-publik (goal/g03-publik), wt-booking (goal/g04-booking), wt-platform (goal/g08-platform).
- Codex: **bortplockad.** Kör seriellt **på main**, en goal i taget. Worktrees (wt-*) parkerade — ignoreras tills ev. parallellt igen. Nörden verifierar varje goal.
- G03 publik webbplats: **KLAR** (commit 181eb21 på main, ovanpå foundation 386d8f6). DoD grön: tema nivå 1/2/3, RLS-scoping, 404 okänd/reserverad subdomän, frisor1 vs frisor2 på samma kodbas. Migration 0004 (härdning + public-read RLS) applicerad. workers.dev-preview-tillägg kör.
- **G4.5 + G04: KLAR** — committat + pushat till ZivarMahmod/Frisor-sas main (aaea931 G045 + 821dd3e preview-worker). Bevis: auth login/logout/roll-guard Playwright-verifierat (klippare L3 nekas admin/platform; platform_admin L8 når båda tenants tvärs via RLS); bokning 17 enhetstester gröna + samtidighet (en lyckas, en 23P01) + e2e boka→bekräftelse (tz/RLS/location_id korrekt). Migration 0005 applicerad på molnet. build+lint+typecheck+test gröna.
  - Avvikelser (godkända): service-role-nyckel tom → booking byggd på anon + 3 SECURITY DEFINER-RPC:er (ingen nyckel behövs, men DEFINER-yta som **G10 måste säkerhetsgranska**). Auth-hook fortf. AV — login/RLS/cross-tenant funkar via inbakade raw_app_meta_data-claims. Gästkontakt sparas i `note` (egen customers-tabell senare → påverkar G05-koppling). Fix: hand-seedade auth.users hade NULL token-kolumner → GoTrue 500, fixat på moln + seed.sql.
  - ÅTERSTÅR (Zivar kör): publik workers.dev-preview-deploy → `cd 5-Kod && pnpm --filter @corevo/web run deploy` (elevad terminal / Developer Mode på pga EPERM symlink). Uppdaterar bokningsplatformen.zivar68.workers.dev. Lokalt klickbart nu på frisor1.localhost:3000.
- **G07 salon-admin (M6): KLAR.** (sekventiellt på main, samma done-mönster.)
- **G06 personalportal (M5): KLAR.**
- **G05 kundportal (M4): KLAR.**
- **G08 platform-admin (M7): KLAR** (2026-06-01, 4 commits på main: a229d1f db billing · d84965f platform lib + 16 tester · 702906a platform UI · 2fc3503 review-fixar). DoD live-bevisad: skapa tenant+slug+settings+roll atomiskt, branding→publik, onboarding-stege, steg 5 domän SPÄRRAD, salon_admin nekas platform, suspend→publik blockeras, faktureringsunderlag (flöde 2). Adversarial 4-agent review: 0 high/critical, 3 medium/low fixade. Migration 0006 (tenant_settings billing-fält) på molnet. ⚠️ invite-vägen code-complete men OVERIFIERAD (SERVICE_ROLE_KEY tom → behöver Worker-secret i prod). ⚠️ tenant_domains saknar status-kolumn → steg 5 UI-only.
- **NULÄGE-rad: G01–G12 KLAR (kod). G13 go-live LIVE + verifierat** — `booking.corevo.se` + `demo.corevo.se` live (Custom Domains på Worker `bokningsplatformen`). **Login funkar live, alla 3 roller Playwright-verifierat** (platform@→ren `/` plattform-dashboard, admin@→/admin, klippare@→/personal). Storefront live (Frisör Demo + tjänster + /boka + /registrera-formulär). Moln-DB konsoliderad (frisor1→`demo`, frisor2 raderad). **POS oförändrad (corevo.se + admin.corevo.se 200).** **KVAR (Zivar, 2 saker):** (1) `SUPABASE_SERVICE_ROLE_KEY` som Worker-**secret** → kund-register `/registrera` (annars 500; resten funkar utan); (2) radera `frisor3` (owner-SQL, append-only-guard) → ren `/salonger`. Se **`5-Kod/docs/ops/go-live-G13.md`**. ⚠️ **2 bugg-fixar denna session:** (a) `ö` i mappnamnet kraschar OpenNext-bygget (esbuild ENOENT, INTE EPERM) → bygg från ASCII-väg / döp om mappen; (b) NEXT_PUBLIC_* inlinas inte konsekvent av OpenNext → lade dem som `vars` i `wrangler.jsonc` (publika värden).
- **G09 stripe/betalning (M8): KOD-KLAR** (2026-06-01, 6 commits på main: 47140cf migr 0007 · ffe6dbf Connect-onboarding · f979b91 booking-checkout · 9cddb8c webhook · a3bb16e refund+kvitto+gate · docs). Flöde 1: kund→salong DIRECT charge, **application_fee = 0** (utelämnad). Connect Express + Account Links; gate `payments_enabled && stripe_charges_enabled` (enda gaten, default av → oförändrat flöde). Webhook /api/stripe/webhook: rå body + constructEventAsync + SubtleCryptoProvider (Workers), idempotent state-set, account.updated→tenants.*. Refund vid avbokning. Migration 0007 på molnet (payments_enabled, tenants.stripe_*, payments unique(booking_id)+session_id, get_public_booking utökad). build+lint+typecheck+test (38) gröna; payments-RLS tenant-scoped verifierad; 0 nya security-advisors. ⚠️ **Stripe-runtime-DoD OVERIFIERAD** — kräver Zivars TEST-nycklar (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` som Worker-secrets) + deployad webhook-endpoint. Onboarding-länk, betalning-landar/app_fee=0, refund-i-Stripe, webhook-idempotens = kör i test-mode efter secrets satta.
  - ⚠️ **Webhook MÅSTE vara en Stripe _Connect_-endpoint** (inte standard account). Direct-charge-events (payment_intent.*, charge.refunded) genereras på det connected account:t och når bara en Connect-endpoint. Fel typ → betalning lyckas i Stripe men bokningen flippar ALDRIG till confirmed (payment-raden fastnar `pending`), utan synligt fel. `STRIPE_WEBHOOK_SECRET` = den Connect-endpointens secret. Prenumerera: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, account.updated.
  - OpenNext/Workers-bundle (`opennextjs-cloudflare build`) gick INTE att köra lokalt: **samma EPERM symlink-spärr** som deploy (Windows — kräver elevad terminal / Developer Mode). `next build` är grön (stripe kompilerar in); Workers-koden använder bara Workers-säkra API:er (createFetchHttpClient, constructEventAsync, createSubtleCryptoProvider, req.text()). Zivar verifierar bundlen vid deploy i elevad terminal.
  - FÖLJDSKULD (ej i G09-DoD): bokning skapas `pending` FÖRE betalning och no_double_booking-EXCLUDE håller slot:en på pending → övergiven checkout låter en pending-bokning ockupera tiden tills någon avbokar. G09 gör övergivning vanligare → bygg pending-expiry/slot-release senare.
- **G10 säkerhet/compliance/drift (M9-ops): KOD-KLAR + verifierat** (2026-06-01). Migration **0008** (bookings.reminded_at + `private.rate_limit_hits` + `public.check_rate_limit` RPC) applicerad på molnet. Levererat:
  - **RLS-revision:** `supabase/tests/rls_coverage_test.sql` (alla public-tabeller har RLS+≥1 policy) + `rls_cross_tenant_test.sql` (dynamisk loop över ALLA `tenant_id`-tabeller → 0 cross-tenant-rader). Båda körda via **Supabase MCP på molnet → PASS**. `get_advisors(security)`: 0 NYA fynd. Befintliga DEFINER-booking-RPC:er (create_public_booking m.fl.) granskade = **avsiktliga/härdade** (`search_path=''`, tenant-scopade, ingen PII). leaked-password fortf. medvetet av.
  - **Säkerhetsheaders** i `next.config.ts` `headers()` (CSP + HSTS + X-Frame DENY + nosniff + Referrer + Permissions). **Verifierat via `next start` + curl** (alla 7 headers närvarande). CSP tillåter Stripe + Supabase. ⚠️ Workers-runtime-emission = deploy-tid-verifiering.
  - **GDPR:** självservice export (`GET /api/gdpr/export`) + radering (`/konto/profil`, skriv RADERA) → anonymiserar bokningar (note→null, customer_profile_id→null), **behåller payments** (Bokföringslagen ~7 år), raderar auth-user (cascade), **PII-fri** audit-post. Admin-funktioner (`eraseCustomerData`/`collectCustomerData`) lib-redo (ingen kundadmin-vy denna våg). Känd lucka på protokoll: rena gästbokningar (note-sömmen, ingen profil) nås ej av self-erase.
  - **Notiser:** ~~Resend-över-fetch~~ **[superseded av goal-14 → one.com SMTP via Edge Function-relä; se 2026-06-02-blocket överst]** (`lib/notifications/*`) — bekräftelse vid bokning/ombokning, avbokning, **kvitto** (webhook, gäst-mejl parsas ur note), **påminnelse-cron** (`/api/cron/reminders` bearer `CRON_SECRET` + `bookings.reminded_at`, filtrerar pending+confirmed). ⚠️ kräver one.com-relä-secrets (`EMAIL_RELAY_URL` + `EMAIL_RELAY_SECRET`) + `NOTIFICATIONS_FROM` (committad var i `wrangler.jsonc`, FX-14) + CF Cron Trigger. **Inte längre `RESEND_API_KEY`.**
  - **Rate-limiting:** Postgres-backad `check_rate_limit` (**Workers-säker** — in-memory funkar ej över isolat) på login (8/5min/IP) + publik bokning (12/5min/IP+tenant), **fail-open**. CF WAF dokumenterat men **EJ applicerat** (G11-spärr + Zivars ja).
  - **Observability:** `lib/observability` — strukturerad JSON-logg (hemlighets-redigering) + `captureException` → Sentry-envelope via fetch (valfri `SENTRY_DSN`). Inkopplat i webhook-felvägar.
  - **Secrets-skan:** `next build` + skanning av `.next/static` → **inga** server-secret-namn / `service_role`-JWT i klientbundle (service-role-nyckeln tom lokalt). Doc: **`5-Kod/docs/ops/backup-restore.md`** (backup/PITR, R2-versioning, WAF, GDPR-retention, secrets-inventering, advisor-granskning, header-deploy-verify).
  - **Verifierat NU:** build + lint + typecheck + **test (43)** gröna; RLS via MCP; headers via curl; secrets-skan. **OVERIFIERAD (kräver ops/secrets + deploy):** riktig e-postleverans (~~Resend~~ **superseded av goal-14 → one.com SMTP**), Sentry-leverans, GDPR auth-radering utan service-role-nyckel, headers på Workers-runtime, CF WAF/Cron-aktivering.
- **Doc-skuld:** G05/G06/G07/G08-briefer ligger INTE i `_klart/` (städregeln eftersläpar) — flytta dem dit vid nästa städ. _klart/ har bara G01–04.
- Repo: ETT privat Frisor-sas-repo, kod i 5-Kod/ (Code fäller in 5-Kod, gör repot privat, kopplar CF mot 5-Kod/apps/web).
- Efter denna: **sekventiell körning på main, en goal i taget** (worktrees/kloner slopade). Kvarvarande ordning: **G09 → G10 → G11**. EN fil per mål: `2-Byggplan/goals/goal-NN-*.md` (klistra hela filen i Code). Roten = bara ej-klara mål; klara → `_klart/`.
- Deploy/compute: booking = **Cloudflare Workers** (OpenNext, scaffold satt). POS = **Pages** (befintligt, apex corevo.se). Olika produkter, rörs ej ihop.
- Cloudflare: Code har full access. Read-only inventering KLAR → `1-Planering/cloudflare-nulage.md` (POS äger apex+www+admin+kiosk+superadmin+dev; booking/app/api/frisorN fria). INGEN live-DNS/route förrän G11 + Zivars ja (POS-risk).
- G03 slutar med en **workers.dev-preview** (fristående, rör ej corevo.se/POS) så Zivar kan klämma live; ?tenant=frisor1/frisor2 växlar salong.
- Efter G03 v1: **G03b designtrohet** (`2-Byggplan/goals/_DROP-G03b-designtrohet.md`) — scrapa freshcut.se + tofifi via Playwright/devtools → designspec → höj v1 → 2–3 val-bara temamallar (= ADR nivå 2).
- Ekonomi: infra billig + delad (Cloudflare gratis ~133 salonger, sen $5 flatt; Supabase ~$30 fast). Avgiften är en värde-spak, inte kostnadsspak. Riktiga rörliga kostnader/bokning = SMS-notiser + Stripe-avgift, INTE hosting.

### Avvikelser från plan (godkända)
- `auth.tenant_id()` heter **`private.tenant_id()`** — Cloud nekar CREATE i auth-schemat (specen tillät auth/private). ALLA framtida goals/briefs ska referera `private.tenant_id()`, ej `auth.`.
- Tabell/kolumn heter **`staff`/`staff_id`** (ej `barber_id`) genomgående, inkl. EXCLUDE-constraint. `start_ts`/`end_ts`.

### Beslut tagna denna session
- leaked-password-protection (HIBP) **uppskjuten** — 2FA blir riktiga skyddet, svagt kundlösen = kundens risk. Revideras före produktion om 2FA glider. Advisor flaggar tills påslaget.
- location-lager byggs in i G04 (multi-store gratis sen). Franchise = grupp över tenant → separat beslut (parkerat, se nedan).
- Google-recension: nudge fyrar EFTER besöket (status=completed), ej vid bokning. Krok lämnas i G04, byggs i notisgoal.

### Parkerat — tas i nästa planeringspass
- **Prismodell-djupdyk: BESLUTAT** (flyttat till Spikade beslut ovan). Två modeller salongen väljer mellan, valet sätter startavgift: per-bokning (X kr/bokning, månadsfaktura, låg startavgift) vs fast 399 kr/mån (startavgift ~3500). Korsar ~133 bokningar/mån → positionera som segment, ej "välj fritt". Lagras som `tenant_settings.billing_model`. Fakturering manuell (Zivar), G08 ger underlag. Belopp = config, kan tunas senare mot salongens verkliga kostnad.
- **Multi-store + franchise:** location-lager (G04) täcker multi-store. Franchise = grupp/parent över flera tenants = eget designbeslut.
- **Verktygsval + super-enkel onboarding:** Zivars tes — bygg EN gång, världens enklaste klickflöde att sälja in. Välj rätt verktyg/upplägg som minimerar admin. Egen planeringssession.
- **G03b designtrohet** (Playwright-scrape freshcut.se + tofifi → temamallar).

### ⚠️ Väntande manuell åtgärd (Zivar, i Supabase Dashboard)
- Authentication → Hooks → aktivera "Customize Access Token (JWT) Claims" → `public.custom_access_token_hook`.
- Behövs för riktig inloggning. RLS funkar redan nu eftersom seed-users bär `app_metadata.tenant_id` direkt.

## Snabbstart nästa session
"Läs HANDOFF.md. Ge mig nästa mål." (HANDOFF = enda ingången + nuläge. Mål ligger i 2-Byggplan/goals/goal-NN-*.md, klara i goals/_klart/.)
