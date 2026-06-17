# FIX-26: Refund-paritet gäst-avbokning — VERIFIERA, täpp om hål
Thinking: 🟡 · Svårighet: 2/5 (mest läsning/test; kod bara om hål finns)

## Mål
Motstridiga uppgifter: VÅG 2-loggen säger "refund-paritet i `cancelByToken` (avboka) + webhook cancelled-gren" = BYGGD; ROADMAP listar "refund-paritet gäst = lös tråd". Avgör vilket som stämmer, bevisa det med test, täpp hålet om det finns. MÅSTE vara stängd innan onlinebetalning slås på.

## Lägeskoppling
FINSLIP-TODO #39. Blockerare för betal-rails-aktivering (FRÅGOR-TILL-ZIVAR F5).

## Berörda filer
- `5-Kod/apps/web/app/avboka/**` + lib-funktionen `cancelByToken`
- Stripe-webhookens cancelled-gren
- `lib/admin/actions.ts` admin-avbokningens refund-väg (paritetsreferensen)

## Steg
1. Läs alla tre avbokningsvägar (gäst-token, kund inloggad, admin) — lista exakt vad var och en gör vid `status='cancelled'` när en betald `payments`-rad finns.
2. Skriv en paritetstabell i briefen som körlogg: väg × (status-byte, history, audit, refund-anrop, idempotens).
3. OM gäst-vägen saknar refund-anropet: spegla admin-vägens refund-logik EXAKT (samma idempotencyKey-mönster som webhook-grenen, `.neq('status','refunded')`-guard).
4. Unit-test: avbokning med betald payments-rad → refund kallas exakt 1 gång; utan betalning → inget refund-anrop; dubbel-avbok → ingen dubbel refund.

## Verifiering
- [ ] Vitest grönt (nya tester + befintliga).
- [ ] Paritetstabellen ifylld med fil+rad-referenser — inga antaganden.
- [ ] Om kod ändrats: bygg via C:\tmp\kod + grep-guard + innehålls-smoke.

## Anti-patterns
- Anta INTE att VÅG 2-loggen stämmer — bevisa med kod-läsning (det är hela poängen).
- Aktivera INTE Stripe-nycklar som del av detta (separat ägar-steg).

## Rollback
Ren verify = ingen. Vid kodändring: `git revert` + wrangler rollback.

## ⬆️ Maxning 2026-06-17 (skärpt acceptans)
Skärper rigor — samma SCOPE (verifiera paritet, täpp ev. hål, rör inte Stripe-nycklar). Tillägg nedan = bindande DoD ovanpå befintlig Verifiering.

### A. Avgörandekriterium — vad räknas som ett refund-"HÅL" (inte en åsikt)
Ett HÅL = en signal nedan SOM INTE redan kompenseras av en likvärdig guard. Lista varje signal MED sin ev. kompenserande mekanism (fil+rad) — utfallet blir då mekaniskt, inte tyckande. Endast okompenserade signaler = HÅL som måste täppas.
- [ ] **Saknat refund-anrop i en avboknings-väg.** = HÅL utan kompensation (inget annat kallar refunden åt den vägen). Verifiera: kallar varje väg (gäst-token, kund inloggad, admin, ev. no-show-transition) `refundBookingPayment(bookingId, tenantId)` efter att `status='cancelled'` satts? Känd nuläges-observation att BEVISA: `app/avboka/actions.ts` (`cancelByToken`) kallar redan `refundBookingPayment` efter `.neq('status','cancelled')`-guarden → primärsignalen är frånvarande i gäst-vägen; bevisa med test, anta inte.
- [ ] **Saknad idempotens-guard.** = HÅL ENDAST om varken Stripe-`idempotencyKey` NÅGON DB-statusguard finns. Kompenserande mekanismer i `lib/stripe/refund.ts`: (1) Stripe `idempotencyKey: refund_${bookingId}` (dedupar pengarörelsen i Stripes 24h-fönster), (2) läs-guarden `if (!payment || payment.status !== 'succeeded' …) return` (en redan `refunded`-rad är ej `succeeded` → tidig retur). Saknas BÅDA → HÅL.
- [ ] **Saknad `.neq('status','refunded')` på DB-uppdateringen i `refund.ts`.** ⚠️ Klassas som **EJ HÅL** så länge läs-guarden (`status !== 'succeeded'`) + `idempotencyKey` finns — den ovillkorliga `payments`-update:n nås bara när raden var `succeeded` vid läsning, och dubbel pengarörelse blockeras ändå av Stripe-nyckeln. (Webhook-grenen i `app/api/stripe/webhook/route.ts` har `.neq('status','refunded')` — bra som referens, men frånvaron i `refund.ts` är försvarad-i-djupet, inte ett pengarhål.) → Driv ALDRIG en "fix" på korrekt pengarkod (status-honesty: en grön test är inte bevis för att en guard saknas).
- [ ] **Verdikt-rad i briefen:** för var och en av de fyra signalerna ovan → `HÅL` / `EJ HÅL (kompenseras av: <fil:rad>)`. Inga rader utan fil+rad-belägg.

### B. Edge-case-testfall (det är pengar — varje fall förankrat i faktisk mekanism)
- [ ] **Partiell refund.** `refundBookingPayment` är full-refund-only (inget `amount`-arg till `stripe.refunds.create`). Test/DoD: dokumentera att partiell återbetalning EJ stöds idag; om en framtida väg skickar `amount` ska den gå via en uttalad, testad gren — inte tyst falla tillbaka på full refund. (Bara dokumentera + assert nuläge; bygg inte partiell refund i denna fix.)
- [ ] **Redan-refunderad-i-Stripe-men-ej-i-DB.** Out-of-band refund i Stripe → vår `refunds.create` kastar → fångas tyst i `catch` → DB står kvar `succeeded` tills `charge.refunded`-webhooken sätter `refunded`. Test: (a) `idempotencyKey`-dedup ger ingen andra pengarörelse; (b) webhook-reconciliation sätter DB→`refunded`. Verifiera att avbokningen ändå lyckas (catch får inte blockera `status='cancelled'`).
- [ ] **Webhook-race (avbok + Stripe `charge.refunded` samtidigt).** Båda vägarna skriver mål-status `refunded`; `idempotencyKey: refund_${bookingId}` garanterar EN pengarörelse oavsett ordning. Test: samtidig avbok-refund + inkommande `charge.refunded` → exakt 1 faktisk refund, slut-DB = `refunded`, ingen dubbel.

### C. Blockerar-relation — spårbar koppling (VAR betal-aktiveringen gatas)
- [ ] **Konkret chokepoint:** online-betalning gatas i `5-Kod/apps/web/lib/booking/payment-gate.ts` — `canTakeOnline = payments_enabled (tenant_settings) && stripe_charges_enabled (tenants)`. "MÅSTE stängas innan onlinebetalning slås på" = denna fix måste vara 0-HÅL INNAN någon tenant får `canTakeOnline=true` (dvs. innan `payments_enabled`/`stripe_charges_enabled` öppnas).
- [ ] **Policy-koppling:** betal-rails (kund→salong) är PAUSADE per **beslut 14.2** (se `goal-40`, rad 18/48/54) och hänger på **FRÅGOR-TILL-ZIVAR F5** (`2-Byggplan/FRÅGOR-TILL-ZIVAR.md:31`) + FINSLIP-TODO #27. Denna fix är en hard gate på den aktiveringen.
- [ ] **goal-39-disambiguering:** `goal-39-fakturering-billing.md` = **plattform→salong-billing (Swish v1)**, EXPLICIT skild från kund→salong-betal-rails (goal-39 rad 12/48). fix-26 blockerar kund→salong-betal-rails-gaten (`payment-gate.ts` + F5/14.2), INTE goal-39:s billing-scope. Blanda inte ihop (samma varning som goal-39 rad 48).

### D. Extra DoD ovanpå befintlig Verifiering
- [ ] Paritetstabellen (Steg 2) utökad med kolumn **HÅL-verdikt + kompenserande mekanism (fil:rad)** per väg.
- [ ] Edge-fallen B1–B3 har körda vitest-assertions (eller, om vägen är dormant/ej aktiverbar utan Stripe-nyckel, ett uttalat "dormant — testas vid aktivering"-not med kod-referens).
- [ ] Ingen kodändring om alla signaler = EJ HÅL — rapportera "paritet finns, inget strukturellt hål, tester bekräftar". Ändras kod ändå: bygg via C:\tmp\kod + grep-guard + smoke (befintlig regel), och Stripe-nycklar förblir inaktiverade.
