# WORKFLOW-02 Våg 3 + Våg 4 — exakt byggspec (autonom natt-körning)

Datum: 2026-06-02. Skapad efter read-only recon. Källa-of-truth för Våg 3 (M3 + M8) + Våg 4
om sessionen compactas över natten. **Hårda regler: aligna inte bygg om; riv aldrig grön yta;
additivt-med-fallback.** Live tenants = frisor3 / studio / arsgw / kvikta.

## GATES (gäller hela natten — Zivar sover, FÅR EJ kringgås)
- ✅ Tillåtet: commit per våg, `git push` EN gång på slutet efter typecheck+lint+vitest grönt.
- ⛔ EJ tillåtet (skriv som färdig artefakt + not, applicera/kör INTE):
  - **Migration 0013** (lojalitet-intjäning-trigger + poäng-policy) — produktbeslut, Zivar-gatad,
    varje migration i projektet har per-gång-godkänts. Skriv filen, märk "READY — apply pending Zivar".
    M3 read-wiring läser 0011-tabeller, INTE 0013 → att skjuta 0013 blockerar inte våg-färdigt.
  - **Prod-deploy** (Cloudflare Workers) — utåtriktat mot LIVE tenants; ö-path kraschar
    `opennextjs-cloudflare build` oövervakat. "push commit" = bara git. Deploy = Zivar-gate.
  - **Live Stripe-verifiering** — kräver pending test-nycklar → M8 = bygg + mock-test mot
    befintligt Connect-webhook-kontrakt, ingen live-charge.
- `git add` SPECIFIKA paths (`5-Kod` + `HANDOFF.md` + egna filer), ALDRIG `-A` — trädet har en
  pre-existing docs-reorg (raderade `2-Byggplan/goals`, untracked `M*.md`) som INTE är mitt jobb.
- Verifierings-grind = typecheck + lint + **vitest**. ALDRIG opennext-build (ö-path kraschar).

## M3 — bokningsmotor read-wiring (additivt-med-fallback)

### 3a. Per-staff/service slot-step + buffer (additivt)
- `computeSlots` (`lib/booking/availability.ts:53`) tar redan `slotStepMin` param (default 15).
  Kolla om den även tar/behöver `bufferMin`; lägg till additivt om saknas (default 0/befintligt).
- Call-site: `app/boka/actions.ts:39` (`const SLOT_STEP_MIN = 15`) + anrop `:143–151`.
  - Läs `services.slot_step_min` / `services.buffer_min` (migr 0011) för vald tjänst.
  - Läs `staff.slot_step_min` / `staff.buffer_min` per frisör.
  - **Fallback-ordning:** service-värde ?? staff-värde ?? nuvarande konstant (15 / 0).
    NULL i DB (default för befintliga rader) → faller tillbaka till exakt dagens beteende.

### 3b. working_hour_slots som explicit-slot-väg (OPT-IN, fallback obligatorisk)
- `working_hour_slots` (migr 0011) läses INGENSTANS av storefront idag. Seeding är opt-in per
  frisör → de FLESTA live-frisörer har NOLL slots.
- **KRITISKT:** Om frisören HAR rader i `working_hour_slots` för dagen → använd de explicita
  starttiderna. ANNARS → fall tillbaka till nuvarande `working_hours`-range-väg (`actions.ts:109`
  selectar `staff_id,start_time,end_time`). Aldrig tom availability för range-frisörer.
- **OBLIGATORISKT TEST** (annars går live availability tom över natten): i
  `lib/booking/availability.test.ts` (efter rad ~35) — bevisa: (1) frisör utan explicit-slots →
  range-vägen ger samma slots som idag; (2) frisör med explicit-slots → de används; (3)
  service/staff slot_step_min override appliceras, NULL → default 15.

### 3c. Storefront läser settings.booking.variant
- Seam: `app/boka/page.tsx:45` `<BookingWizard services={...} />` (ingen mode → default 'wizard').
- Injicera `mode={readBookingVariant(bundle.tenant.settings)}` (`lib/platform/booking-variant.ts:44`).
  Variant osatt → default = nuvarande wizard (Variant 3). Additivt, ingen befintlig yta rivs.
- Verifiera BookingWizard faktiskt respekterar mode-propen för alla varianter (1/2/3).

### 3d. 5-min hold/release (om i M3-scope per WORKFLOW-02)
- Kolla om hold-mekanism finns; om byggs, gör den additiv mot create_public_booking-RPC
  (`actions.ts:193–199`). Bygg inte om RPC-kontraktet.

## M8 — betalningar (bygg + mock-test, INGEN live-charge)
- Connect-webhook `app/api/stripe/webhook/route.ts:49` — signatur (`constructEventAsync`,
  WebCrypto) + `accountOwnsTenant()` (:35) finns. Bygg vidare additivt, riv inte verifieringen.
- Payment-skapande: `app/boka/actions.ts:260` `startBookingCheckout` (direct charge på
  `tenant.stripe_account_id`).
- Rebook-bär-betalning: seam i create-path (`actions.ts:166–245`). No-show-refund: dorm/seam i
  webhook-handlers (`route.ts:89–241`) + status-transition. Bygg logik + mock-test mot kontraktet.

## Migration 0013 (SKRIV, APPLICERA EJ)
- `5-Kod/supabase/migrations/0013_*.sql` — lojalitet-intjäning: trigger på booking→completed som
  appendar `loyalty_ledger` (reason='earn_completed', unik-index `loyalty_ledger_earn_once on
  (booking_id)` finns redan i 0011 → idempotent). Poäng-policy/tier-trösklar i settings-JSON.
- Header: "READY — APPLICERA EJ utan Zivar-OK (produktbeslut: poäng-policy)". RLS på loyalty_ledger
  är select-only by design → intjäning MÅSTE ske via denna trigger (SECURITY DEFINER).

## Våg 4 — tablet/responsivt + slutverifiering
- Långlivade sessioner (tablet i salong), responsiv layout-pass över alla portaler.
- Slut-e2e LOKALT (vitest + ev. @readonly-harness). INGEN live-deploy-verify (gate).
- Final: typecheck+lint+vitest grönt → commit → push.

## Sekvens (UPPDATERAD 2026-06-02 — Zivar bad om live-deploy av icke-M8 FÖRE M8)
Våg 2 KLAR + committad `49f5648`. NY ordning: M8 flyttad SIST så icke-betal-bygget kan gå live separat.
1. Workflow `wc3aprruu` = M3 read-wiring + Våg 4 (M8 EXKLUDERAD). M3-granskning = HÅRD deploy-grind.
2. M3-granskning grön + slutverifiering grön → commit (M3+Våg4+wrangler-fix) → push.
3. **LIVE-DEPLOY** (icke-M8) — se nedan.
4. Verifiera live (riktiga ytor).
5. Separat workflow: M8 betalningar → granska → commit → push. M8-deploy gatad på Stripe-nycklar (saknas live).
6. Skriv migration 0013 (READY, applicera EJ). Uppdatera HANDOFF + memory.

## LIVE-DEPLOY (icke-M8, Zivar-auktoriserad 2026-06-02)
**CF-auth finns** (wrangler whoami: OAuth zivar68, workers write, konto 0be2655be66efbfa5d9b36721ddae008).
**Rollback-baslinje:** nuvarande live ≈ version `9e277e14` (skapad 06:57Z). RE-LISTA exakt id före deploy:
`wrangler deployments list --config <apps/web/wrangler.jsonc>`. Rollback = `wrangler rollback <id> --config <...>`.

**Domän-rekoncilierad (KLAR):** live worker-domains (API, service=bokningsplatformen) = `booking.corevo.se`
+ `freshcut.corevo.se`. wrangler.jsonc routes ändrad till EXAKT det (släppt döda `demo.corevo.se` som ej
resolvar + lagt till dashboard-only `freshcut.corevo.se` som annars DETACHATS av deploy = FX-14-fällan).
Nu config == live → deploy = noll domän-churn. **Vars rena** (alla 8 plaintext i config), **secrets kvar**
(SERVICE_ROLE_KEY + EMAIL_RELAY_*; INGA Stripe-secrets live → betalning ej live, M8 gatad — ingen regress).

**M3-risk EMPIRISKT minimal:** prod-query: working_hour_slots=0, staff/services slot_step_min+buffer_min ALLA
NULL, inga tenant_settings.booking.variant. → ALLA nya M3-grenar DORMANT i prod. Risk = bara "range-vägen =
dagens slots" (täckt av obligatoriskt fallback-test). 4 tenants, 10 working_hours-rader.

**Deploy-steg (ö-path → ASCII-kopia, KÖR VIA PowerShell-verktyget, ej Bash — Bash manglar ö):**
1. Från COMMITTAD+pushad träd: `robocopy <5-Kod> C:\tmp\kod /E /PURGE /XD node_modules .next .open-next .git /XF .env.local`
2. Skriv `C:\tmp\kod\apps\web\.env.local` från wrangler.jsonc PUBLIKA vars (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY,
   ROOT_DOMAIN=corevo.se, PLATFORM_HOST=booking.corevo.se, SITE_URL, RESERVED_SUBDOMAINS) — alla publika, ej secrets.
3. `pnpm --dir C:\tmp\kod install --frozen-lockfile` (FRESH — robocopy med node_modules dödar pnpm-symlänkar → dubbel React).
4. `pnpm --dir C:\tmp\kod --filter @corevo/web run deploy` (= opennextjs-cloudflare build && deploy). Tar minuter.
**HÅRD GRIND:** deploya BARA om M3-granskning grön (additive_fallback_ok + mandatory_test_present) + slut-go.
**Build failar i C:\tmp\kod → STOPP, rapportera, hacka inte. Live står kvar på gammal kod (fail-safe).**

**Smoke EFTER deploy (riktiga ytor, ej bara 200):** login 3 roller på booking.corevo.se; en tenant `/boka`
renderar faktiska slots; freshcut.corevo.se ej 5xx; `corevo.se` POS = 200 (orörd). Trasigt → `wrangler rollback`.
