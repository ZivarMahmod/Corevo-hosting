# goal-42 — Stripe go-live + SERVICE_ROLE-secret (en blocker som låser upp FYRA saker)
Thinking: ⚫ (riktiga pengar i andra änden + en saknad worker-secret bryter FYRA prod-flöden i tysthet → 500/no-op. Secret-sättningen är OPS och deploy-gatad; ingen riktig charge förrän compliance-checkpoint passerats. advisor-consult på webhook→confirmed-grenen + refund-paritet INNAN live-betalning slås på.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. Två spår: **(A) ops-secret** (litet, låser upp fyra flöden) + **(B) Stripe Connect go-live** (kod + ops, hårt compliance-gatat). ⚫ kräver advisor-consult på webhook-grenen + refund-paritet innan riktig betalning aktiveras.
**Beslut som behövs av Zivar/ops:** sätta `SUPABASE_SERVICE_ROLE_KEY` som worker-secret (spår A) + uttryckligt "kör live"-go på Stripe (spår B) + compliance-checkpoint innan första riktiga charge.

## Mål
1. **Spår A — secreten (rotorsak):** worker SAKNAR `SUPABASE_SERVICE_ROLE_KEY`-secret i prod. `createServiceClient()` (`lib/platform/service.ts`) returnerar då `null`, och ALLA fyra service-role-flöden degraderar/500:ar i tysthet. **Sätt secreten → bevisa att alla fyra funkar.** Detta är EN ops-åtgärd som låser upp:
   - **Kund-signup** — `signUpCustomer` (`lib/kund/actions.ts`, auth.admin via service-role) → utan secret = 500 i prod.
   - **Reminder-cron** — `lib/notifications/reminders.ts` (`createServiceClient`, driven av `app/api/cron/reminders/route.ts`) → utan secret = tyst no-op, inga påminnelser.
   - **GDPR-radering/export** — `lib/gdpr/erase.ts` (`createServiceClient`) → utan secret = `{ unavailable }`, "rätten att bli glömd" funkar inte.
   - **Plattforms-invite** — salong-admin-invite via `lib/platform/actions.ts` (auth.admin) → utan secret = skippas med felmeddelande, ingen salong kan onboardas med inloggning.
2. **Spår B — Stripe Connect go-live:** lyft från TEST-mode till live-redo (utan att tvinga fram en riktig charge): `payments_enabled` på per tenant + Connect-onboarding klar (`stripe_charges_enabled`), Connect-webhook (RÅ body) flippar bokning `pending → confirmed`, refund-paritet bevisad i `cancelByToken` (referera **fix-26**), Stripe-domäner i CSP, secret-rotation på Stripe-nyckeln. **INGA riktiga charges förrän compliance-checkpoint passerats.**

## Lägeskoppling
Fas 3 / go-live i `2-Byggplan/ROADMAP-2026-06-17-hela-vagen.md`. Bygger på **G09** (`klart/03-betalning/goal-09-betalningar-stripe.md` — Connect Express, DIRECT charge, application_fee=0, webhook) som är KOD-klar men live-spärrad. Rotorsaks-blockern är dokumenterad i `klart/04-sakerhet-drift/goal-fas3-adversarial-findings.md`. Refund-paritetens verifiering ägs av **`goal-42`s syskon `fix-26-refund-paritet-verifiera.md`** (FINSLIP-TODO #39, F5-blockerare) — goal-42 KONSUMERAR fix-26 som gate, dubblar inte dess jobb.

## Kontext
- **Secreten är rotorsaken.** `createServiceClient()` byggs bara om BÅDE `SUPABASE_SERVICE_ROLE_KEY` OCH `NEXT_PUBLIC_SUPABASE_URL` finns, annars `null` (graceful degrade speglad från R2/Stripe-mönstret). Nyckeln finns i `apps/web/.env.local` lokalt men är (per fas3-fyndet) INTE satt som worker-secret i prod → därav 500/no-op live. **Detta är OPS, inte kod** — koden hanterar redan båda fallen korrekt.
- **Stripe i TEST-mode, live-spärrad** (G09 LIVE-SPÄRR). `carry`/betal-rader = no-op tills betalning aktiveras → inga moms/kvitto-effekter förrän payments_enabled+charges_enabled.
- **Webhook RÅ-body-kravet är REDAN korrekt löst** (`app/api/stripe/webhook/route.ts`): läser `await req.text()` FÖRE all parse, verifierar via `constructEventAsync` + `Stripe.createSubtleCryptoProvider()` (WebCrypto, Workers-runtime), Stripe-klienten kör `createFetchHttpClient()`. Det finns även en **account-fence** (`accountOwnsTenant`) som stoppar cross-account-spoof innan någon write. → **VERIFIERA att detta håller live, bygg inte om.**
- **`payment_intent.succeeded`-grenen flippar redan** `bookings.status` `pending → confirmed` (WHERE status='pending'), markerar `payments.status='succeeded'` med `.neq('status','refunded')`-guard (idempotent state-set, ingen events-tabell). → verifiera med en TEST-betalning end-to-end.
- **Refund-paritet:** `app/avboka/actions.ts` (`cancelByToken`, gäst-token) kallar redan `refundBookingPayment(bookingId, b.tenant_id)` efter cancel-guarden — i PARITET med admin-vägen (`lib/admin/actions.ts`) och kund-inloggad (`lib/kund/actions.ts`). `lib/stripe/refund.ts` har Stripe-`idempotencyKey: refund_${bookingId}` + läs-guard (`status==='succeeded'`). **Primärsignalen "saknat refund-anrop i gäst-vägen" är alltså FRÅNVARANDE — men måste BEVISAS med test, inte antas** (fix-26s avgörandekriterium). goal-42 kräver att fix-26 är grön innan live.
- **`avboka cancelByToken` hade tidigare ingen refund-paritet enligt äldre logg** — motstridig uppgift; fix-26 finns just för att avgöra det mekaniskt. goal-42 låser fast: refund-paritet MÅSTE vara bevisad (fix-26 grön) som hård gate före go-live.

## Berörda filer
- **Spår A (OPS, ingen kod):** worker-secret `SUPABASE_SERVICE_ROLE_KEY` (+ verifiera `NEXT_PUBLIC_SUPABASE_URL`). Runbook: `5-Kod/docs/ops/`. Ingen källkodsändring krävs — koden läser redan `process.env`.
- `5-Kod/apps/web/lib/platform/service.ts` — `createServiceClient()`/`hasServiceRole()` (sanningskälla för "secret finns?"). Rör ej; använd som verifieringspunkt.
- `5-Kod/apps/web/lib/kund/actions.ts` (`signUpCustomer`), `lib/notifications/reminders.ts`, `app/api/cron/reminders/route.ts`, `lib/gdpr/erase.ts`, `lib/platform/actions.ts` (invite) — de fyra konsumenterna; verifiera grönt efter secret.
- `5-Kod/apps/web/app/api/stripe/webhook/route.ts` — Connect-webhook (RÅ body + account-fence + pending→confirmed). VERIFIERA, bygg ej om.
- `5-Kod/apps/web/lib/stripe/client.ts` · `connect.ts` · `refund.ts` · `lib/booking/payment-gate.ts` (`canTakeOnline = payments_enabled && stripe_charges_enabled`) — go-live-ytan.
- `5-Kod/apps/web/app/avboka/actions.ts` (`cancelByToken`) — refund-paritet (referera fix-26; rör bara om fix-26 hittar ett okompenserat hål).
- **CSP** (middleware/next-config där `content-security-policy` sätts) — lägg Stripe-domäner (`js.stripe.com`, `api.stripe.com`, `*.stripe.com` för frames/connect). *(grep fram exakt CSP-källa före ändring.)*
- `5-Kod/docs/ops/` — secret-sättning + secret-rotation (Stripe live-nyckel) + go-live-checklista.

## Steg
### Spår A — secreten (ops, snabbt, hög utdelning)
1. **Sätt `SUPABASE_SERVICE_ROLE_KEY` som worker-secret** (ops; via `wrangler secret put` / pipeline-secret). Verifiera att `NEXT_PUBLIC_SUPABASE_URL` också är satt i worker-env. **Markerat OPS — deploy-gatat, Zivar/ops kör.**
2. **Bevisa de fyra flödena live** (render-bevisat, inte ögonmått):
   - Signup: skapa ett kundkonto i prod → 200, auth-user skapas, ingen 500.
   - Cron: trigga `app/api/cron/reminders` → `ReminderRun` scannar/sänder (inte tyst no-op).
   - GDPR: kör radera-mitt-konto-flödet → `{ ok: true }`, inte `{ unavailable }`.
   - Invite: skapa/onboarda en testsalong-admin → invite skickas, inte "skippad (no service role)".

### Spår B — Stripe Connect go-live (kod-verify + ops, compliance-gatat)
3. **VERIFIERA webhook-signatur på RÅ body live** (⚫ advisor-consult på just denna gren): TEST-event mot prod-endpoint → `constructEventAsync` + `SubtleCryptoProvider` passerar; manipulerad body → 400 "Invalid signature". account-fence avvisar mismatch (logga + 200 no-op, ingen retry-loop). Bygg INTE om — bevisa.
4. **TEST-betalning end-to-end:** tenant med `payments_enabled=on` + `stripe_charges_enabled=on` → boka → Stripe Checkout (TEST-kort) → `payment_intent.succeeded` → `payments.status='succeeded'` + `bookings.status` flippar `pending → confirmed`. Idempotens: dubbel webhook-leverans = en effekt.
5. **Refund-paritet (referera fix-26):** kör fix-26 till grönt FÖRST. Bevisa: gäst-avbok via `cancelByToken` med en betald `payments`-rad → `refundBookingPayment` kallas exakt 1 gång; utan betalning → inget refund-anrop; dubbel-avbok → ingen dubbel refund (idempotencyKey + status-guard). Paritet med inloggad/admin-väg dokumenterad (fil+rad).
6. **CSP:** lägg Stripe-domäner i `content-security-policy` (script/connect/frame). Bevisa: Checkout/Payment Element laddar utan CSP-block i prod-headers.
7. **Secret-rotation:** dokumentera + verifiera rotation av Stripe live-nyckeln (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`) i `docs/ops/` — rotation utan nedtid (graceful degrade om nyckel saknas → "betala på plats").
8. **Compliance-checkpoint (HÅRD gate):** ingen riktig (live-mode) charge förrän Zivar/ops bekräftar: Connect-konto verifierat, villkor/återbetalningspolicy, moms/kvitto-hantering. TEST-mode bevisar mekaniken; live-flippen är ett separat ägar-go.

## Verifiering (klar när — mekaniskt 0 FAIL, bevisat live, ingen regression)
### Spår A
- [ ] Worker-secret `SUPABASE_SERVICE_ROLE_KEY` satt; `hasServiceRole()` sant i prod (verifierat indirekt via de fyra flödena).
- [ ] **Signup-500 borta** — render-bevisad: nytt kundkonto skapas i prod utan 500.
- [ ] **Cron grön** — reminder-körning scannar/sänder (loggat `ReminderRun`, inte no-op).
- [ ] **GDPR-radering/export grön** — `{ ok: true }`, inte `{ unavailable }`.
- [ ] **Plattforms-invite grön** — salong-admin onboardas med inloggning (invite skickad, inte skippad).
### Spår B
- [ ] **Webhook RÅ-body-signatur bevisad:** giltigt TEST-event → 200; manipulerad body → 400; account-mismatch → no-op 200 (ingen write). ⚫ advisor-consult kvitterad på grenen.
- [ ] **TEST-betalning flippar bokning:** PaymentIntent succeeded → `payments.status='succeeded'` + `bookings.status` `pending → confirmed`. Dubbelleverans = en effekt (idempotent).
- [ ] **Refund-paritet (fix-26 grön):** gäst-avbok betald → refund 1×; obetald → 0 refund-anrop; dubbel-avbok → ingen dubbel refund. Paritetstabell (gäst/kund/admin) ifylld med fil+rad.
- [ ] **CSP** tillåter Stripe-domäner — Checkout/Payment Element laddar i prod utan CSP-block.
- [ ] **Secret-rotation** dokumenterad + verifierad (Stripe live-nyckel + webhook-secret) i `docs/ops/`.
- [ ] **Compliance-checkpoint:** explicit Zivar/ops-go innan första LIVE-mode-charge. Inga riktiga charges utförda i denna goal.
### Gates (båda spåren)
- [ ] vitest grönt (nya refund-paritet-tester + befintliga), tsc 0, lint 0, opennext build (ASCII-build-path), grep-guard ren.
- [ ] Worker-version + rollback-id noterade. Ops-steg (secret-sättning, live-flip) tydligt avgränsade som **Zivar/ops-gatade**, ej autonomt körda.

## KOD vs OPS (explicit avgränsning)
- **OPS (deploy-gatat, Zivar/ops kör — INTE autonomt):** sätta `SUPABASE_SERVICE_ROLE_KEY`-secret; Stripe TEST→LIVE-mode-flip; Connect-konto-verifiering; secret-rotation; compliance-go.
- **KOD (Claude Code, autonomt fram till gate):** CSP-domäner; ev. refund-paritet-fix OM fix-26 hittar okompenserat hål; verifierings-/smoke-tester; runbook-dokumentation i `docs/ops/`.
- Koden för de fyra service-role-flödena + webhook + refund är REDAN korrekt — goal-42 verifierar, den bygger inte om dem.

## Anti-patterns
- Sätt ALDRIG secreten autonomt — det är ops/deploy-gatat (`wrangler secret put` av Zivar/ops). Koden ändras inte för spår A.
- Bygg ALDRIG om webhook-signaturen, account-fencen eller pending→confirmed-grenen — de är korrekta; verifiera live.
- "Fixa" ALDRIG korrekt pengarkod på spekulation (status-honesty: en grön test bevisar inte att en guard saknas) — följ fix-26s avgörandekriterium (HÅL = okompenserad signal med fil+rad).
- Utför ALDRIG en riktig (live-mode) charge före compliance-checkpoint. TEST-mode räcker för mekanik-beviset.
- Logga/exponera ALDRIG service-role- eller Stripe-nyckeln (server-only; aldrig till browser).
- Säg "klart" BARA när mekaniskt render-verifierat (0 FAIL) — annars rapportera bara KVAR, terst.

## Kopplingar
`klart/03-betalning/goal-09-betalningar-stripe.md` (G09-grunden), `klart/04-sakerhet-drift/goal-fas3-adversarial-findings.md` (rotorsaks-blockern), `goals/fix-26-refund-paritet-verifiera.md` (refund-paritet-verifiering — gate), `ROADMAP-2026-06-17-hela-vagen.md` (Fas 3 / go-live). Webhook G10-TODO (rate-limit på endpoint) kvarstår som separat finslip.

## Rollback
Spår A: ta bort secreten återställer graceful degrade (no-op/`unavailable`), ingen data rörd. Spår B: CSP-/kodändring `git revert` + `wrangler rollback <förra-version-id>`; Stripe live→test-flip = ops; refunds dedupas av Stripe `idempotencyKey` (ingen dubbel pengarörelse vid revert). Inga raderingar av boknings-/betal-data.
