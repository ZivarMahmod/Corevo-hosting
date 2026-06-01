# HANDOFF — Corevo Booking Platform

Klistra in detta i nästa Cowork-session så Nörden är ikapp direkt.

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
- **NULÄGE-rad: G01–G09 KLAR (kod). Kvar: G10 → G11.**
- **G09 stripe/betalning (M8): KOD-KLAR** (2026-06-01, 6 commits på main: 47140cf migr 0007 · ffe6dbf Connect-onboarding · f979b91 booking-checkout · 9cddb8c webhook · a3bb16e refund+kvitto+gate · docs). Flöde 1: kund→salong DIRECT charge, **application_fee = 0** (utelämnad). Connect Express + Account Links; gate `payments_enabled && stripe_charges_enabled` (enda gaten, default av → oförändrat flöde). Webhook /api/stripe/webhook: rå body + constructEventAsync + SubtleCryptoProvider (Workers), idempotent state-set, account.updated→tenants.*. Refund vid avbokning. Migration 0007 på molnet (payments_enabled, tenants.stripe_*, payments unique(booking_id)+session_id, get_public_booking utökad). build+lint+typecheck+test (38) gröna; payments-RLS tenant-scoped verifierad; 0 nya security-advisors. ⚠️ **Stripe-runtime-DoD OVERIFIERAD** — kräver Zivars TEST-nycklar (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` som Worker-secrets) + deployad webhook-endpoint. Onboarding-länk, betalning-landar/app_fee=0, refund-i-Stripe, webhook-idempotens = kör i test-mode efter secrets satta.
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
