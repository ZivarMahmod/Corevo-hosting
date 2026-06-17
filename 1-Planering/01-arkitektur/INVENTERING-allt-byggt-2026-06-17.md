# INVENTERING — allt byggt + alla goals + funktioner (2026-06-17)

Tvärgående karta över HELA Corevo Booking: varje levererad goal, varje öppen goal, kod-moduler + deras funktioner, samt konkreta maxnings-/optimerings-möjligheter per del. Källa: 3 oberoende read-only inventerings-agenter (öppna goals, klart-goals, kod) + HANDOFF + MEMORY. Detta är kartan; maxnings-batcherna loggas i slutet (§E/§F).

**Stack:** Next.js 15 (App Router) → Cloudflare Workers (OpenNext) · Supabase (Postgres + RLS, `private.tenant_id()`-claim) · R2 media · multi-tenant (domän-routad). 4 portaler i en kodbas + plattforms-admin.

> **⚠️ Tillförlitlighet (läs detta):** §A (status) + §C (öppna goals) lästa direkt ur filerna. **§B/§D (kod-moduler + optimering-kandidater) = FÖRSTA-PASS-karta** från en kod-läsande agent som hade nonzero felmarginal — 3 premiss-fel rättades mot primärkälla nedan (refund-paritet, observability, dubbelbok-race ⚠️). Behandla okontrollerade §B/§D-påståenden (dubbel modul-state-läsare, SMS-stub, stale-branding-cache, migrations-syften härledda ur filnamn) som **verifiera-före-handling**, ej fakta. Maxnings-edits (§C) + delmål goal-41–44 är **författade + spot-kontrollerade** mot primärkälla, ej rad-för-rad-granskade.

---

## §A — BYGGDA / LEVERERADE GOALS (`2-Byggplan/klart/`)

| ID | Funktion | Live-status |
|---|---|---|
| **01-grund** | | |
| goal-01 | Scaffold (Next+Supabase+CF/OpenNext+R2+tenant-resolution-stub) | Live (grund) |
| goal-02 | Multi-tenant schema + RLS + dubbelboknings-EXCLUDE-constraint | Live |
| goal-11 | E2E (Playwright) + CI/CD deploy-pipeline | Kod-klar; deploy/Stripe/seed ops-gatad |
| goal-12 | Inloggningsmodell: back-office-zon vs storefront-zon split | Live |
| goal-13 | Go-live merge G1–G12 → deploy → login (3 seed-konton) | Live |
| goal-15 | FreshCut demo-baseline (1 tenant + 4 roller, ren slate) | Live |
| goal-16 | Kunddomän→tenant white-label-resolution (RPC + middleware) | Kod-klar, DORMANT/ops-gatad |
| goal-23 | DomänPanel self-serve (CF-for-SaaS add/verify/remove hostname) | Kod-klar, flag-off, ej deployad |
| freshcut-seed-data | Seed-underlag (priser/tider riktiga, team/copy/bild platshållare) | Live |
| **02-ytor** | | |
| goal-03 / M2 | Publik white-label storefront (3-nivå theming, public-read RLS) | Live |
| goal-04 / M3 | Bokningsmotor (tjänst→personal→tid→bekräfta; slot-matte) | Live |
| goal-05 / M4 | Kundportal (login, egna bokningar, av-/ombok, lojalitet) | Live |
| goal-06 / M5 | Personalportal (eget schema, frånvaro→slots, status) | Live |
| goal-07 / M6 | Salong-admin (tjänster, personal, branding+logo R2) | Live |
| goal-22 | "Lägg till kund"-drawer → `createPlatformCustomer` | Live (worker 474e1768) |
| goal-08 / M7 | Plattforms-admin / Corevos kontrollcenter | Live |
| goal-19 | Ärlighetspass (döda falska knappar, härledda badges) | Live (worker 562c09ad) |
| goal-20 | Tenant-data & onboarding (stad, ägar-namn; migr 0024) | Live; populerad läsväg ej render-bevisad |
| goal-31 | Sajtbyggare S0 spike (render-bron bevisad på Workers) | Spike bakom flagga (staging) |
| goal-34 | Sajtbyggare S1 (regioner + override-kaskad + data-editable) | Kod-klar, flag-off (worker 16735d4f); ingen editor-UI |
| **03-betalning** | | |
| goal-09 / M8 | Stripe Connect (kund→salong, webhook, refund, app_fee) | Kod-klar; TEST-mode, live-spärrad |
| **04-sakerhet-drift** | | |
| goal-10 | Säkerhet/compliance/ops (RLS, GDPR, rate-limit, CSP) | Kod-klar; Resend/Sentry/WAF ops-pending |
| goal-18 | RLS på `rate_limit_hits` (migr 0023) | Live (DB) |
| goal-21 | RBAC behörighetsmatris (migr 0025) | Live (worker 474e1768); enforcement ej live-körd |
| goal-fas3 | Adversarial findings + remediation (17/26) | Mest live; 1 blocker kvar (signup 500) |
| **05-design** | | |
| goal-17 | Design-trohet make-it-match (v3-retrofit + 5 teman) | Live (worker c74a3390) |
| WAVE-3-DESIGN-PLAN / VAG0-design | Design-planer (uppgångna i goal-17 / migr 0011) | Historiska plan-docs |
| **06-mejl-notiser** | | |
| goal-14 | Mejl via egen one.com SMTP (Edge relay) + per-salong-brand | Live (no-op utan relay-secrets) |
| **08-fixar** | | |
| fix-24 | Ombygg efter .env.local-läcka (404-fix) | Live (`fc546fc8`) |
| fix-G13 | Login + storefront tenant-resolution | Live |
| fix-goal-14 | Mejl-durabilitet + deploy-säkerhet (FX1–FX5) | Live |

*Historik (ej byggda features): `07-workflows-faser/` (roadmaps/run-loggar), `_DROP*`/`_ERSATT*`/`_gamla-modulspecar/`.*

### Top enhancement-möjligheter på byggt (kondenserat)
- **goal-04/22 kund-dedup:** gäst-bokning + manuellt tillagd kund + senare bokning = SEPARATA rader (ingen `contact_hash`-dedup). Prime follow-up.
- **goal-09 Stripe go-live:** TEST-mode (carry no-op utan payment-rader). ⚠️ RÄTTAT 2026-06-17 (primärkälla): `cancelByToken` anropar REDAN `refundBookingPayment`, webhooken gör raw-body-sig + pending→confirmed → go-live = VERIFIERA (fix-26-gaten), ej bygg-om. Verklig blocker = `SUPABASE_SERVICE_ROLE_KEY`-secret (ops) → låser ÄVEN upp signup-500/cron/GDPR/invite. Se goal-42.
- **goal-fas3 blocker:** customer signup 500 i prod (worker saknar `SUPABASE_SERVICE_ROLE_KEY`) → bryter ÄVEN reminder-cron, GDPR-export, platform-invite. WCAG: guld `#f5a623` på cream = AA-fail.
- **goal-16/23 domän-ops:** dormant; aktivering = ren ops (CF-secrets + flagga). `verifyCustomDomain` är poll-baserad (ingen webhook).
- **goal-34→S2:** ingen editor-UI byggd (klick-overlay/TipTap/R2-picker) = nästa bygge.
- **goal-05 lojalitet:** earn-only, ingen redemption-UX; ingen väntelista vid frigjord slot.
- **goal-10/14 ops-aktivering:** Resend/Sentry/WAF/relay-secrets osatta → tyst no-op.
- **Återkommande deploy-footguns:** `.env.local`-inline · prod-deploy DETACHAR kunddomäner (2-fas publish) · runtime-secret vs build-inline.

---

## §B — KOD-MODULER → FUNKTION (`5-Kod/apps/web/`)

| Modul | Path | Gör | Nyckel-funktioner |
|---|---|---|---|
| Bokningsmotor | `lib/booking/` | Slot-beräkning, holds, betal-gate, refund, tz | `computeSlots()`, `filterHeldSlots()` (dormant), `canBook()`, `zonedTimeToUtc()`, `applyNoShowPenalty()` |
| Auth & roller | `lib/auth/` | Session, roll→portal, MFA, host-routing | `getCurrentUser()`, `PORTAL_MIN_LEVEL` (2/3/6/8), `verifyTotp()`, `resolveTenantByHost()` |
| Admin CRUD | `lib/admin/` (+blogg/offert/presentkort/shop/lojalitet/media) | Salong-admin-ytor + modul-admin | `getAdminModuleStates()`, `isModuleActivated()` |
| Plattform | `lib/platform/` (35 filer) | Super-admin: tenants/domäner/roller/verticals/billing/audit | `setModuleState()`, `createTenant()`, `updateRolePermissions()`; **`actions.ts` = 39 KB monolit** |
| Tenant/modul-state | `lib/tenant*.ts`, `tenant-modules.ts` | Multi-tenant-resolution, modul-livscykel off/draft/live/paused | `getTenantBySlug()`, `moduleState()`, `isModuleLive()` |
| Sajtbyggare render-bron | `lib/sajtbyggare/` | HTML→React + `<corevo-module>`-markör-swap | `renderTemplate()` (html-react-parser) |
| Supabase-klienter | `lib/supabase/` | Auth'd + public + middleware tenant-gate | `server.ts`, `public.ts`, `middleware.ts` |
| CF kunddomäner | `lib/cloudflare/` | Provisionera custom hostname, DCV | `createCustomHostname()`, `getDcvRecords()` |
| Notiser | `lib/notifications/` | Mejl + SMS (**SMS = TODO-stub**), påminnelse/avbok | `sendBookingEmail()`, `sendBookingReminder()` |
| Stripe | `lib/stripe/` | Connect-balans, rebook, refund | `canBook()`, `processRebookPayment()` |
| Lojalitet / GDPR | `lib/kund/loyalty.ts`, `lib/gdpr/` | Poäng earn/burn; export/anonymisering | `earnPoints()`, `exportUserData()` |

**Routes:** storefront `/` · `/konto/*` (kundportal) · `/personal/*` · `/admin/*` (salong) · `/platform/*` (super: salonger/kunder/roller/domaner/fakturering/drift-och-logg) · `(auth)` login/registrera.

**Migrationer:** 0001–0038 (schema→RLS→auth-hook→betalning→multibransch K10–K20→sajtbyggare-defaults). `0014_slot_holds` = dormant. `rate_limit_hits` finns live men saknas i 0001–0022 (drift).

**Tester:** 67 filer (59 vitest + 8 e2e/playwright). Luckor: sajtbyggare render-path, `platform/actions.ts`, CF custom-domains, booking-concurrency (dubbelbokning).

---

## §C — ÖPPNA GOALS (`2-Byggplan/goals/`, 14 filer)

| ID | Titel | Status | Syfte |
|---|---|---|---|
| fix-25 | Onboarding-steg5 speglar flaggan | planerad (kosmetisk) | Statisk "SPÄRRAD" → flagg-/data-styrd |
| fix-26 | Refund-paritet gäst-avbok (verifiera) | planerad (läsning) | Bevisa/täpp refund-hål före betalning |
| fix-29 | superbooking-krasch + login-churn | ⚠️ shipped-ej-flyttad | Fix krasch + churn, deploy m. goal-28 |
| fix-33 | Domän 530 om-bevisa | ⚠️ ersatt av fix-35 | Diagnos 530 (token-rotorsak motbevisad) |
| fix-35 | Kund-subdomäner i wrangler (deploy-safe) | planerad (Zivar-OK) | DB→committad wrangler + instant-attach, noll flimmer |
| goal-27 | Admin-split 3 dörrar | ⚠️ SHIPPED LIVE | Host-baserade inloggningsdörrar |
| goal-28 | Wildcard `*.boka.corevo.se` | ⚠️ delvis-shipped (cert blockad) | EN wildcard-route salong-storefronts |
| goal-30 | Fixa git → deploy multibransch | ⚠️ SHIPPED LIVE | (git var ej korrupt) deploy K10–K20 |
| goal-32 | Auto-domän + aldrig nere | ⚠️ NO-GO (bruten deploy-proof) | DB-routes + Domäner-lista |
| goal-36 | Sajtbyggare 100 templates (autorun) | planerad (run-spec klar) | Autonom loop bygg+optimera ~100 templates |
| goal-37 | Sajtbyggare S2 visuell editor | planerad (nästa stora bygge) | Klick-WYSIWYG (overlay+TipTap+R2+tokens) |
| goal-38 | Sajtbyggare S3 onboarding-integration | blockerad (S2 oskriven) | Montera S2-editor i onboarding |
| goal-39 | Fakturering plattforms-billing (Swish v1) | planerad | 399 kr/mån-faktura super→salong |
| goal-40 | Booking bransch-medveten + restaurang-kapacitet | planerad (kräver advisor) | Config-driven booking (`object:table`+party_size) |

### Maxnings-punkter per öppen goal (3 var, från fil-läsning)
- **fix-25:** + testfall flagga-AV + tenant-utan-domän · enhetstest på status-härledning · definiera query-återbruk (ingen N+1).
- **fix-26:** definiera vad som räknas som "hål" (avgörandekriterium) · edge: partiell refund / redan-refunderad-i-Stripe / webhook-race · koppla blockerar-relation till goal-39/betal-gate.
- **fix-35:** kontinuerlig proba UNDER deploy-fönstret (ej bara före/efter) · explicit **paused**-salong-testfall (RLS-fällan) · definiera delad infoga-funktions-kontrakt nu (signatur+anropsplats).
- **goal-36:** assertera katalogens faktiska count + hantera trasiga/dubbla mappar · template-specifik render-proof (regioner/booking-variant/kanon-mall) · eskaleringsväg vid schema-utökning (hoppa+flagga vs hård stopp).
- **goal-37:** konkret motor-timebox + go/no-go-metrik (LoC/dagar) · XSS **fuzz-svit** (srcset/style-expression/data-URI/nästlad markör), ej bara script/onerror · spar-semantik (draft vs direkt-publik, samtidighet).
- **goal-38:** HÅRD gate: S3 får ej börja förrän S2-editor-API dokumenterat · deterministisk STEPS-flagg-växling testad BÅDA grenar · regressions-snapshot på orörda steg (Moduler/Ägare&roll/booking-floor).
- **goal-39:** gapless-nr **concurrency-test** (parallella anrop) · status-felgrenar (avvisad/kredit/makulering/utebliven — gapless aldrig raderas) · momssats **datadriven** (kolumn), gata mot riktiga pengar bakom compliance.
- **goal-40:** migrations-test-matris (staff-only/table-only/hybrid — constraint-overlap) · kapacitets-aritmetik (1-bord-1-bok vs riktig kapacitet/party_size) · hold-race-test för bord-resurs.

---

## §D — KOD-OPTIMERING-KANDIDATER (read-only-fynd)

**Struktur/dead code:** `holds.ts` + migr 0014 helt byggda men OANVÄNDA → wira in (⚠️ RÄTTAT 2026-06-17: dubbelbok-KORREKTHET skyddas REDAN av `no_double_booking` EXCLUDE-constraint, `23P01`→`slot_taken`; holds = UX-contention + concurrency-TESTtäckning, EJ race-fix; se goal-43) · `platform/actions.ts` 39 KB monolit → splittra per concern (goal-44) · dubbel modul-state-läsare (`admin/modules.ts` vs `tenant-modules.ts`) → konsolidera · `platformMetrics` dormant/död.

**RLS/säkerhet:** publik klient filtrerar `tenant_id` app-side (ej RLS) → RLS-vy om volym växer · ingen e2e för CF custom-hostname-integration.

**Perf:** holds saknar caching (100+ rader/iteration vid aktivering) · `getTenantBySlug` unstable_cache-tagg beroende av korrekt revalidate → stale-branding-risk · OpenNext cold-start ingen warmup.

**Test-luckor:** render-bron (trasig HTML/saknad modul) · booking-concurrency (hold-contention + EXCLUDE-backstop-regression — korrektheten skyddad, testet saknas) · Stripe-webhook edge (partiell refund/failed rebook) · `actions.ts` minimal testyta.

**Obs/ops:** SMS-provider = TODO-stub · observability ⚠️ RÄTTAT 2026-06-17: EJ stub — `lib/observability` har redan `log`/`captureException`/Sentry-envelope (~10 filer) + `drift-och-logg` visar riktig `audit_log`; lucka = ingen `SENTRY_DSN` + obevisad sink + `actions.ts`-fel ej routade genom `captureException` + 4 health-pills platshållare (se goal-44) · plattform→storefront cache-invalidering beror på manuell `revalidateTag` (glöms → stale 1h+).

---

## §E — TVÄRGÅENDE TEMAN + MAXNINGS-PLAN

**Tre kedjor som hänger ihop:**
1. **Domän-kedjan** goal-32→fix-33→fix-35 = 3 lager på samma bug. Bara **fix-35** bär giltig modell. goal-32 UTFALL var falsk; fix-33:s token-rotorsak motbevisad.
2. **Sajtbyggar-kedjan** S1(klar)→36/37/38 har **odefinierat delat kontrakt** (`manifest/types.ts` + editor-API). goal-38 snubblar redan (S2 oskriven).
3. **Betal/secret-kedjan** Stripe-go-live + `SUPABASE_SERVICE_ROLE_KEY`-secret låser upp signup-500 + cron + GDPR + invite samtidigt.

**Maxnings-batcher (inkrementellt, en visas → du styr nästa):**
- **Batch 1 (DENNA körning):** vassa de 8 genuint öppna goal-specerna i fil (fix-25/26/35, goal-36/37/38/39/40) med maxnings-punkterna ovan + status-korrigering på de 6 fel-placerade (§F). Doc-edits, reversibla, ingen kod/deploy.
- **Batch 2 (KLAR 2026-06-17):** 4 nya förbättrings-delmål skapade ur byggd kod — **goal-41** kund-dedup (en identitet) · **goal-42** Stripe-go-live + `SERVICE_ROLE`-secret · **goal-43** aktivera slot-holds (UX-contention + concurrency-test) · **goal-44** observability + `actions.ts`-split. Alla grundade i primärkälla (rättade 3 premiss-fel — se §A/§D ⚠️). Kvar för ev. batch 2b: deploy-footgun-pipeline-fix (`.env.local`-inline + domän-detach vid 2-fas-publish).
- **Batch 3 (du styr):** städa goals/ → flytta shipped till klart/ (git-skuld, HANDOFF-spårad).

---

## §F — STATUS-KORRIGERINGAR (fel-placerade/överspelade)

Enligt CLAUDE.md "verifierad klar → flytta till klart/". Dessa läser som öppna planer men är det inte:
- **goal-27** SHIPPED LIVE 2026-06-14 (worker `1cb807ce`) → flytta klart/ (ev. 1 rad kvar: logged-in role-rejection-test).
- **goal-28** delvis-shipped 2026-06-14; **cert blockad** (Free plan, ~$10/mo ACM) + förbigången av `<slug>.corevo.se`-modellen → markera delvis, flytta ej rakt av.
- **goal-30** SHIPPED LIVE 2026-06-15 (worker `769c55aa`); git var ej korrupt → flytta klart/ (freshcut-render overifierbar = 0 tenants).
- **fix-29** shipped m. goal-28 (churn-fix live) → flytta klart/.
- **goal-32** NO-GO (deploy-proof bruten, test-barber 530) → stannar i goals/, UTFALL rättad av fix-33/35.
- **fix-33** ersatt av fix-35 (token-rotorsak motbevisad) → markera superseded.
