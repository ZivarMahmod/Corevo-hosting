# PayPal — så tänds det (goal-64)

PayPal-integrationen är **byggd och klar**, men **avstängd** tills nycklarna finns.
Ingen kod behöver skrivas den dag Zivar skaffar kontot — bara secrets sättas.

**Gaten:** `lib/payments/paypal.ts → paypalReady()` returnerar `false` så länge
`PAYPAL_CLIENT_ID` eller `PAYPAL_SECRET` saknas. Då:

- PayPal visas **aldrig** som betalsätt i kassan (`availablePaymentMethods` filtrerar bort det),
- `startPaypalCheckout()` svarar `{ unavailable }`,
- `/api/paypal/webhook` svarar tyst 200 (`skipped: paypal_not_configured`) — ingen 5xx-loop.

Kunden kan alltså kryssa i "PayPal" i kundkortet redan idag; kassan visar det ändå inte
förrän rälsen finns. Hellre färre val än en knapp som ljuger.

---

## 1. Vad Zivar måste skaffa

| # | Steg | Var |
|---|---|---|
| 1 | **PayPal Business-konto** (privatkonto duger inte för att ta emot betalningar) | paypal.com |
| 2 | **App i PayPal Developer Dashboard** → ger `Client ID` + `Secret` | developer.paypal.com → Apps & Credentials |
| 3 | **Webhook** på appen → ger `Webhook ID` | samma app → Add Webhook |

**Webhookens URL:** `https://<kundens-domän>/api/paypal/webhook`
**Event att prenumerera på:** `PAYMENT.CAPTURE.COMPLETED` (den enda vi agerar på).

Börja i **Sandbox** (samma dashboard, flik "Sandbox") — `PAYPAL_ENV` styr vilken miljö
koden pratar med, och den defaultar till sandbox. **Fail-safe:** en glömd `PAYPAL_ENV`
betalar aldrig med riktiga pengar.

---

## 2. Secrets som ska in

Sätts som **Cloudflare Worker secrets** (samma väg som `STRIPE_SECRET_KEY`):

```bash
cd 5-Kod
npx wrangler secret put PAYPAL_CLIENT_ID
npx wrangler secret put PAYPAL_SECRET
npx wrangler secret put PAYPAL_WEBHOOK_ID
npx wrangler secret put PAYPAL_ENV        # 'live' i produktion; utelämnad/annat = sandbox
```

| Variabel | Krävs för | Utan den |
|---|---|---|
| `PAYPAL_CLIENT_ID` | allt | PayPal helt dolt |
| `PAYPAL_SECRET` | allt | PayPal helt dolt |
| `PAYPAL_WEBHOOK_ID` | signaturverifiering av webhooken | webhooken **avvisar allt** (400). Returen fungerar ändå — men nätet under den saknas |
| `PAYPAL_ENV` | produktion | kör mot **sandbox** (låtsaspengar) |

Lokalt: samma namn i `5-Kod/apps/web/.env.local` (gitignorad).

---

## 3. ⚠️ Pengaflödet skiljer sig från Stripe — läs innan påslag

| | Stripe | PayPal (v1) |
|---|---|---|
| Konto som tar emot | **Kundens** (Connect, direct charge) | **Plattformens** (Zivars) |
| Plattformsavgift | 0 (`application_fee` utelämnas) | — |
| Utbetalning till kunden | automatisk | **manuell** |

PayPal Partner/Connect-onboarding (pengarna direkt till kundens eget PayPal) kräver ett
godkänt partneravtal som inte finns. Tills det finns landar PayPal-betalningar på
**plattformens** konto och måste vidarebefordras till kunden manuellt.

**Konsekvens:** slå bara på PayPal för en kund där det är ett medvetet val (t.ex. Zivar
själv). För externa kunder är Stripe-rälsen den som stämmer ekonomiskt.

---

## 4. Övriga betalsätt (Stripe-rälsen)

Alla fyra går via **kundens befintliga Stripe-koppling** — inga nya nycklar.
Krav: `tenant_settings.payments_enabled = true` **och** `tenants.stripe_charges_enabled = true`
(annars döljs de i kassan).

| Betalsätt | Vad som krävs |
|---|---|
| **Kort** | Fungerar direkt när Stripe-kontot är godkänt. |
| **Swish** | Måste aktiveras i **kundens** Stripe Dashboard (Settings → Payment methods → Swish). Endast SEK. |
| **Klarna** | Aktiveras i kundens Stripe Dashboard (Payment methods → Klarna). |
| **Apple Pay** | Ingen egen `payment_method_type` — rider på `card`. Krävs: **domänverifiering** i kundens Stripe Dashboard (Settings → Payment methods → Apple Pay → Add domain) för varje domän kassan körs på (t.ex. `<slug>.corevo.se` **och** kundens egna domän). Utan verifierad domän visar Stripe helt enkelt inte Apple Pay-knappen — kassan kraschar inte, valet blir bara ett vanligt kortköp. |

Ett betalsätt som kunden slår på men inte aktiverat i Stripe → Stripe avvisar
Checkout-sessionen → kassan visar "Kunde inte starta betalning. Försök igen." Kontrollera
kundens Stripe Dashboard först.

---

## 5. Snabb rökkontroll efter påslag

1. Kundkortet → **Webshop** → Betalsätt: PayPal-raden ska INTE längre visa badgen "PayPal-nycklar saknas".
2. Lägg en order i butiken, välj PayPal → du ska skickas till PayPal (sandbox: `sandbox.paypal.com`).
3. Godkänn → du landar på `/bekraftelse/<id>?betald=1` och ordern står som **Betald**.
4. PayPal Developer Dashboard → Webhooks → Event logs: `PAYMENT.CAPTURE.COMPLETED` ska ha svarat **200**.
5. Skicka om samma event manuellt (Resend) → ordern ska **förbli** betald, lagret ska **inte** dras igen (idempotens).
