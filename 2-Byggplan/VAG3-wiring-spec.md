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

## Sekvens
Våg 2 (kör nu, wmyso2lob) klar → verifiera → commit. Sedan ETT workflow: Våg 3 (M3+M8 solo,
seriellt — delad bokningskärna, ingen parallell-skrivning) → Våg 4 → verifiera → skriv 0013 →
commit → uppdatera HANDOFF + memory → push EN gång.
