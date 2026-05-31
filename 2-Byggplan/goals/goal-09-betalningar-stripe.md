## Goal 09 — Betalningar / Stripe Connect M8

**Spår:** F · **Beror på:** G04 · **Modul:** M8 (Betalningar)

**Mål:** Koppla Stripe Connect på den färdiga bokningsmotorn: varje salong (tenant) har eget Connect-konto, kunder betalar/depositionar vid bokning, plattformen tar ev. avgift, och webhooks håller `payments`/`bookings` i synk.

**Kontext:** G04 (bokningsmotor med `createBooking` som returnerar `requiresPayment`-krok), G02 (`payments`, `tenants.stripe_account_id`) klara. Stripe-env stubbad i G01. G07 har en stub-knapp för Stripe-onboarding.

**Omfattning (bygg detta):**
- **Stripe Connect onboarding** för salong: salon_admin startar onboarding (Express/Standard), `stripe_account_id` sparas på `tenants`. Färdigställ stub-knappen i G07.
- **Checkout vid bokning:** vid `createBooking` med `requiresPayment` → skapa PaymentIntent på tenantens Connect-konto (med ev. `application_fee`), kund betalar (Stripe Elements eller Checkout).
- **Webhook-endpoint** (`app/api/stripe/webhook/route.ts`): verifiera signatur, hantera `payment_intent.succeeded/failed`, `account.updated`; uppdatera `payments` + sätt `bookings.status` (confirmed vid betald).
- Stöd för deposition vs full betalning vs ingen (per tenant-inställning).
- Återbetalning vid avbokning (koppla till M4-avbokning, om policy tillåter).
- Visa betalningsstatus i M4 (kund), M6/M7 (personal/admin), och i G07-bokningsöversikt.

**Utanför scope:**
- Tenant-fakturering/abonnemang (Corevo→salong) — separat, senare.
- Komplex skatte-/momslogik utöver Stripes standard.
- Payout-rapporter (senare).

**Berörda områden/filer:** `5-Kod/lib/stripe/`, `5-Kod/app/api/stripe/webhook/route.ts`, `5-Kod/app/(admin)/installningar/betalningar/`, `5-Kod/app/boka/` (payment-steg).

**Steg:**
1. `lib/stripe/client.ts` (server-only) + types. Konfig av Connect-läge.
2. Onboarding-flöde: skapa Account Link, redirect, spara `stripe_account_id`, `account.updated`-webhook sätter "klar".
3. PaymentIntent-skapande kopplat till `createBooking`-kroken (på connected account, application_fee).
4. Betalsteg i `/boka` (Elements/Checkout) — bokning bekräftas först vid lyckad betalning eller pending tills webhook.
5. Webhook-route med signaturverifiering (raw body) + idempotens.
6. Återbetalning vid avbokning (policy-styrt).
7. Statusvisning i berörda portaler.
8. `pnpm build` + lint + Stripe CLI webhook-test.

**Verifieras (DoD):**
- Salong kan slutföra Connect-onboarding; `stripe_account_id` sparas och markeras klar via webhook.
- Testbokning med betalning: PaymentIntent skapas på tenantens konto, betalning i testläge lyckas, webhook sätter `bookings.status=confirmed` + `payments.status=succeeded`.
- Misslyckad betalning lämnar bokning ej bekräftad.
- Webhook avvisar fel signatur; dubbla events är idempotenta.
- Avbokning inom policy → återbetalning skapas.
- `pnpm build` grön.

**Tekniska noter:**
- Webhook MÅSTE läsa **raw body** för signaturverifiering — i App Router: läs `await req.text()`, ingen JSON-parse innan verify. På Cloudflare/OpenNext: säkerställ att routen kör i rätt runtime och får rå body.
- `payments` scoped på `tenant_id`; webhook (service-role) skriver, men validera tenant via `stripe_account_id`→tenant-lookup.
- Idempotens: lagra hanterade `event.id` (eller använd PaymentIntent-status) för att undvika dubbelbearbetning.
- Hemligheter (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`) som Cloudflare secrets i prod.
- application_fee_amount per plan (koppla mot tenant.plan).
