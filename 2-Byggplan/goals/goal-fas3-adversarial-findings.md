# FAS 3 — Adversarial review findings + remediation plan

Källa: workflow `corevo-fas3-adversarial-review` (31 agenter, 5 dimensioner, varje fynd adversariellt verifierat). 26 råa → **17 bekräftade**, 9 avfärdade (välgrundat). Kör-build vid review: worker `0fef5009` (commit `c2f66d9`).

E2E + branding-DoD redan verifierat live denna FAS (boka inbäddat → personal ser → personal Genomförd m. M9-nudge best-effort → admin ser → branding-byte syns → revert). Storefront-benchmark (desktop+mobil): redaktionell klass, responsiv. OK.

## Bekräftade fynd (17)

### KRITISK
1. **`create_public_booking` anon-anropbar utan tid/identitet-validering** — `0005:251-252 grant execute to anon`; klienten har anon-nyckeln → direkt PostgREST-anrop förbi hela server-action. RPC:n saknar `p_start >= now()`, arbetstids-/stängt-koll, slot-alignment (de finns BARA i läs-pathen `availability.ts`). `p_customer` litas på (förfalska attribution), `p_tenant_slug` är fri param (rikta vilken tenant som helst). Impact: cross-tenant kalender-spam/DoS + förfalskad attribution + skräpbokningar. **Fix: flytta invarianter in i RPC:n; härled kund från `auth.uid()`; avvisa förflutet/utanför öppettid/fel-alignment; låt 23P01 propagera.** → DB-migration.

### HÖG
2. **bookings/payments RLS är tenant-bred, inte roll-medveten** — `0002:56-73 for all to authenticated using (tenant_id = private.tenant_id())`. En kund (lvl 2) bär samma tenant-claim → kan via egen JWT + anon-nyckel läsa/UPDATE/DELETE VARJE booking/payment i tenanten (andra kunders data). App-lagrets `.eq('customer_profile_id')` är enda staketet; RLS ger ingen backstop. Verifieraren: **exploaterbart NU** (browser anon-nyckel + kund-JWT i cookies). **Fix: roll-medveten RLS (helper `private.role_level()`/claim) som pinnar lvl-2 till `customer_profile_id = auth.uid()`, behåller tenant-bred för staff/admin.** → DB-migration.
3. **Guld `#f5a623` som liten text på cream/vitt = WCAG AA-fail (~2:1)** — `.eyebrow/.menuNum/.stylistRole/.sectionEyebrow/.hero3Eyebrow`. **Fix: rendera dessa i forest `--color-primary` (9.96:1); guld kvar för CTA-fyllning/dekor.** → CSS.

### MEDIUM
4. Admin kontakt-epost/telefon sparas men visas aldrig för kund (write-only) — exponera `settings.contact` i `parseSettings` + LocationHours/kontakt.
5. **Rebook steg-2 (släpp gamla) är inte fel-kollad** — `kund/actions.ts:229-234` → kund kan hålla två aktiva bokningar. `cancelBooking` kollar identiska UPDATE. **Fix: fånga resultat, kompensera (avboka nya) vid fel/0 rader.** → logik.
6. Gallery-lightbox saknar focus-trap/restore (BookingDrawer har mönstret). → a11y.
7. Carousel-prickar missbrukar tablist/tab-ARIA (inga tabpanels/roving). **Fix: `role=group` + `aria-current`.** → a11y.
8. Hero-prickar ~11px tap-targets (<24px WCAG 2.5.8). → a11y CSS.
9. Mobil-nav-overlay saknar focus-trap/restore. → a11y.
10. Hero-carousel auto-advance utan synlig paus-kontroll (WCAG 2.2.2). → a11y.
11. **Bekräftelse INTE in-page** — `BookingWizard.tsx:144 router.push('/boka/bekraftelse/[id]')` lämnar storefront-skalet för en avskalad `app/boka/layout.tsx` (ingen nav/footer/drawer). Bryter ⭐ KÄRNKRAV (`design-referens-storefront.md:84`: "Bekräftelse sker också in-page"). Same-domain+tenant-temad (inte värsta-fall portal). **Fix: rendera bekräftelse som steg-5 i drawern; behåll route som delbar djuplänk men ge den fullt skal.** → design-fidelity.
12. **Guld tvångsmålat på storefront, ej tenant-överstyrbart** (`tokens.ts` mappar bara primary/bg/fg/font; accent frozen). Bryter storefront-brief ("salongens identitet, inte Corevos"). **DOC-KONFLIKT:** `design-system.md §5` fryser guld medvetet; `design-referens-storefront.md:15` förbjuder det. → **Kräver Zivar-beslut** (brief bör vinna = white-label-värdet).

### LÅG
13. `setStaffServices` litar på klient-`staff_id` (cross-tenant integritets-write) — lägg `.eq('id',staffId).eq('tenant_id',ctx.tenant.id)`-koll (som `addStaffWorkingHours` redan gör). → logik.
14. Stripe-webhook verifierar inte `event.account` mot tenantens `stripe_account_id` (service-role write litar på metadata). → härda.
15. Admin "Betalning"-dropdown (inkl "kommer snart") sparas men har noll kund-effekt — koppla eller ta bort.
16. LocationHours/AboutSplit visar påhittade öppettider/statistik som fakta (cream-honesty) — driv från tenant-data eller märk "Visas snart".
17. Död `.hero3*` CSS (Hero3 renderar foto-carousel) — ta bort blocket + uppdatera stale-kommentar.

## Avfärdade (9, korrekt) 
get_public_booking (oguessbar UUID-capability, host-filter = no-op), cancel-during-checkout (onåbar: betalda bokningar har NULL customer), rebook-paid (onåbar, latent), admin status-övergångar (avsiktlig override, EXCLUDE skyddar), payment_failed pending (avsiktlig system-design), nav-h reserve (avsiktlig), 44px (AAA, ej krav), alt-text (OK), reduced-motion (OK).

## Remedieringsordning (förslag — pending advisor + Zivar)
1. **Säkerhet (DB-migration 0009):** #1 RPC-härdning + #2 roll-medveten RLS. Högst risk (live multi-tenant DB; får inte bryta bokningsflödet). Verifiera E2E-boka efter.
2. **Säkerhet (kod, låg risk):** #13 staff_id-koll, #14 webhook account-bindning.
3. **Korrekthet:** #5 rebook two-active.
4. **a11y-batch:** #3 (kontrast), #6–#10 (focus-trap, tap-target, ARIA, paus).
5. **Design-fidelity:** #11 in-page bekräftelse.
6. **Polish/dead-UI:** #4, #15, #16, #17.
7. **Zivar-beslut:** #12 guld-på-storefront (brief vs design-system.md).

## STATUS (uppdaterad efter remedierings-start)

### Säkerhet — migrationer SKRIVNA, BLOCKERADE på prod-apply
- `5-Kod/supabase/migrations/0009_booking_rpc_identity_hardening.sql` — fixar #1 (identitet: anon→`p_customer` NULL, auth→`=auth.uid()`; + past-time-guard). Working-hours/alignment = medveten follow-up.
- `5-Kod/supabase/migrations/0010_role_aware_booking_rls.sql` — fixar #2 (`private.role_level()` + roll-medveten RLS på bookings+payments; staff/admin ≥3 tenant-bред, kund egna rader).
- **BEFORE-test (SQL-simulering av JWT-context) BEVISADE hålet:** simulerad kund (role_level 0) ser 1 bokning som inte är hens (gäst-E2E:n); admin (lvl 6) ser 1 (korrekt).
- **BLOCKERARE:** `apply_migration` mot live multi-tenant prod-DB nekades av auto-mode (kräver Zivars uttryckliga OK). AFTER-verifiering väntar på apply.

### NY BLOCKERARE (ej i review — review läste kod, inte live-config)
- **Kundregistrering 500 i prod.** `signUpCustomer` (`kund/actions.ts:42`) använder service-role admin-API (`createAdminClient`); workern saknar `SUPABASE_SERVICE_ROLE_KEY`-secret (kod-kommentar: "only in .env.local today") → null-klient → 500. Bryter även reminder-cron, GDPR-export, platform-invite. **Kräver: sätt `SUPABASE_SERVICE_ROLE_KEY` som wrangler-secret (Zivar har värdet).**

### Verifierat live denna FAS (build 0fef5009)
E2E (boka inbäddat→personal Genomförd m. M9-nudge→admin ser→branding-byte syns→revert), 3-roll-login, benchmark (desktop+mobil redaktionell), 0 console-fel på storefront.
