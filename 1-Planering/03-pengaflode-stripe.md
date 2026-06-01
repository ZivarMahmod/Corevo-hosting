# 03 – Pengaflöde (Stripe Connect)

**Corevo Booking Platform** · multi-tenant boknings-SaaS för salonger
Stack: Next.js + Supabase + Cloudflare + Stripe Connect
Status: PLANERING (ingen kod). Senast: 2026-05-31.

> Grundregel: **Pengar går aldrig juridiskt genom Corevo.** Stripe håller och splittar.
> Corevo tar bara en service-avgift (application fee). Ingen manuell fakturering.

---

## 1. Modellen (ASCII)

Exempel: klippning **350 kr** + service-avgift **5 kr** = kund betalar **355 kr**.

```
                          KUND betalar 355 kr
                                  |
                                  v
                       +---------------------+
                       |       STRIPE        |   <-- håller + splittar pengarna
                       |  (connected account |       Corevo rör dem aldrig
                       |    = SALONGEN)      |
                       +----------+----------+
                                  |
              split sker hos Stripe (inte hos Corevo)
                                  |
            +---------------------+----------------------+
            |                                            |
            v                                            v
   +-----------------+                        +----------------------+
   |  SALONG         |                        |  COREVO              |
   |  350 kr         |                        |  5 kr                |
   |  (tjänstpris)   |                        |  (application fee)   |
   |                 |                        +----------------------+
   |  - Stripe-avg.* |
   +-----------------+
   * Stripe-avgiften (kortavgift) dras från salongens del.
     Salongen bär den. Kunden betalar service-avgiften ovanpå.
```

Kort: **Kund -> Stripe -> Salong (350)**, och **Stripe -> Corevo (5 som application fee)**.

---

## 2. Val: kontotyp + charge-typ (motiverat)

### Kontotyp: **Stripe Connect — Express**

| Krav (Zivar) | Express löser det |
|---|---|
| Varje salong eget Stripe-konto | Ja, eget connected account per tenant |
| Billig/enkel start för salongen | Stripe-hostad onboarding, ingen kod att bygga |
| Corevo slipper känslig data / KYC | Stripe sköter KYC + identitetsverifiering |
| Salongen ser sina pengar | Egen Express-dashboard |

Verifierat (Stripe docs): Express = Stripe-hostad onboarding, Stripe gör KYC, connected
account får Express Dashboard. Standard = salongen sköter allt eget (mer jobb för salongen).
Custom = Corevo bygger hela UI:t + bär allt (för tungt nu).
**Express = rätt balans** för en SaaS där varje salong har eget konto men inte ska behöva
bygga något. (Stämmer med underlag 08.)

### Charge-typ: **Direct charge** (på salongens connected account) med `application_fee_amount`

| Alternativ | Vem är merchant | Vem bär Stripe-avgift | Passar Zivars modell? |
|---|---|---|---|
| **Direct charge** | Salongen | **Salongen** | **JA** – matchar "Stripe-avgiften bär salongen" |
| Destination charge | Corevo (plattform) | Corevo (default) | Nej – Corevo skulle bli merchant + bära avgift |

**Motivering (verifierat, Stripe docs):**
- Direct charge skapas direkt på salongens konto (via `Stripe-Account`-headern). Salongen
  blir **merchant of record** och **betalar Stripe-kortavgiften** — exakt vad Zivar vill.
- `application_fee_amount` på betalningen flyttar Corevos del (5 kr) till plattformskontot.
- Destination charge gör Corevo till merchant och Corevo bär Stripe-avgiften by default —
  fel modell här (pengar skulle gå "genom" Corevo).
- Direct charge stärker även principen "pengar går aldrig genom Corevo".

> Beslut: **Express-konton + Direct charges + application_fee_amount.**

---

## 3. Avgifts-konfig: fast kr ELLER procent (per tenant)

Fältet måste stödja **båda**. Lös med två kolumner + en typ-flagga, inte ett enda fält.

| Kolumn | Typ | Betydelse |
|---|---|---|
| `fee_type` | enum `fixed` \| `percent` | vilken modell tenanten kör |
| `fee_fixed_amount` | integer (öre) | används om `fixed`. Ex: 0 / 300 / 500 / 1000 öre = 0/3/5/10 kr |
| `fee_percent` | numeric (t.ex. 2.50 = 2,5 %) | används om `percent` |

**Beräkning av `application_fee_amount` (öre) vid bokning:**
```
om fee_type = fixed   -> application_fee_amount = fee_fixed_amount
om fee_type = percent -> application_fee_amount = round(tjänstpris_öre * fee_percent / 100)
```
- Allt i **öre** (heltal) — aldrig flyttal på pengar.
- Avgiften läggs **ovanpå** tjänstpriset för kunden (350 + 5 = 355). Kunden betalar avgiften,
  inte salongen.
- **Lagras på tenant-nivå** (salongens inställningar), t.ex. tabell `tenant_payment_settings`
  eller kolumner på `tenants`. Default vid onboarding: `fixed`, 5 kr (konfigurerbart).

---

## 4. Betalflöden (steg-för-steg)

### (a) Betala online (kort)
1. Kund väljer tid -> bokning skapas i DB med `payment_status = unpaid`.
2. Backend räknar `application_fee_amount` (se §3) + total = tjänstpris + avgift.
3. Backend skapar PaymentIntent/Checkout Session **på salongens konto** (`Stripe-Account`
   header), med `application_fee_amount`. Aldrig från frontend.
4. Kund betalar 355 kr i Stripe.
5. Stripe splittar: 350 -> salong, 5 -> Corevo. Salongen bär kortavgiften.
6. **Webhook** `payment_intent.succeeded` -> backend sätter `payment_status = paid`.
   (Bokningen bekräftas av webhook, inte av frontend-redirect.)

### (b) Betala på plats (utan Stripe)
1. Kund väljer "betala på plats" -> bokning skapas direkt, `payment_status = pay_on_site`.
2. **Ingen Stripe-anrop.** Bokning bekräftas direkt.
3. Salongen tar betalt i kassan på plats (kontant/egen terminal).
4. Regel: **bokning får ALDRIG blockeras av betalning.** Detta flöde måste funka även om
   salongen saknar Stripe-konto eller Stripe ligger nere.

### (c) Återbetalning
1. Salong/admin trycker "återbetala" på en `paid` bokning.
2. Backend skapar Refund på salongens konto med **`refund_application_fee: true`**
   (så Corevos 5 kr också återförs proportionellt). Verifierat: gäller direct charges.
   `reverse_transfer` används INTE (det är för destination charges).
3. **Webhook** `charge.refunded` -> backend sätter `payment_status = refunded`
   (eller `partially_refunded` vid delåterbetalning).
4. Pengar tillbaka till kundens kort via Stripe.

---

## 5. Webhooks (sanningen kommer härifrån, aldrig frontend)

> **Varför aldrig lita på frontend:** frontend kan stängas, krascha, eller manipuleras.
> En redirect "till tack-sidan" betyder INTE att betalning gick igenom. Endast Stripes
> signerade webhook (verifierad signatur) får ändra `payment_status`.

Connect-events kommer in med ett `account`-fält (vilken salong). Lyssna på:

| Webhook | Vad den gör | Varför |
|---|---|---|
| `payment_intent.succeeded` | Sätt `paid` | Bekräftar att pengarna faktiskt drogs |
| `payment_intent.payment_failed` | Sätt `failed` / behåll `unpaid` | Kunden kom inte igenom |
| `checkout.session.completed` | Bekräfta Checkout-betalning | Om vi kör Checkout istället för rå PI |
| `charge.refunded` | Sätt `refunded` / `partially_refunded` | Återbetalning klar |
| `account.updated` | Uppdatera salongens onboarding-status (charges_enabled, payouts_enabled) | Vet när salong får ta emot betalning |
| `application_fee.refunded` | Logga att Corevos avgift återförts | Avstämning av Corevos intäkt |

Krav: **verifiera webhook-signatur** (Stripe signing secret) på varje event. Idempotens
(samma event kan komma flera gånger -> hantera utan dubbelbokföring).

---

## 6. Betalstatusar + hur de uppdateras

| Status | Betyder | Sätts av |
|---|---|---|
| `unpaid` | Bokning skapad, online-betalning ej klar | Backend vid bokning |
| `pending` | Stripe-betalning startad, väntar | Backend när PI skapas |
| `paid` | Pengar drogs OK | **Webhook** `payment_intent.succeeded` / `checkout.session.completed` |
| `failed` | Betalning misslyckades | **Webhook** `payment_intent.payment_failed` |
| `pay_on_site` | Ska betalas på plats | Backend (flöde b) — ingen Stripe |
| `refunded` | Helt återbetald | **Webhook** `charge.refunded` |
| `partially_refunded` | Delvis återbetald | **Webhook** `charge.refunded` (delbelopp) |

Regel: alla övergångar TILL `paid`/`refunded`/`failed` görs **endast av webhook**, aldrig
av frontend eller redirect.

---

## 7. Vad lagras i DB (kopplas till `payments`-tabellen)

> **ALDRIG kortdata.** Inga kortnummer, CVC, utgångsdatum. Det är Stripes ansvar (PCI).
> Corevo lagrar bara **referenser (Stripe-ID:n) + status + belopp**.

`payments` (förslag, koppla mot 02-datamodell-db-schema):

| Kolumn | Typ | Notering |
|---|---|---|
| `id` | uuid (PK) | |
| `booking_id` | uuid (FK -> bookings) | vilken bokning |
| `tenant_id` | uuid (FK -> tenants) | vilken salong |
| `stripe_payment_intent_id` | text | Stripe-ID, ingen kortdata |
| `stripe_charge_id` | text | för refunds-koppling |
| `stripe_account_id` | text | salongens connected account |
| `amount_total` | integer (öre) | t.ex. 35500 |
| `amount_service` | integer (öre) | tjänstpris, t.ex. 35000 |
| `application_fee_amount` | integer (öre) | Corevos del, t.ex. 500 |
| `currency` | text | `sek` |
| `payment_status` | enum | se §6 |
| `payment_method` | enum `online` \| `on_site` | |
| `created_at` / `updated_at` | timestamptz | |

Supabase: skydda med **RLS** så en tenant bara ser sina egna `payments`-rader.

---

## 8. Swish-läget (verifierat)

**Stripe STÖDJER Swish i Sverige.** Verifierat mot Stripes live-dokumentation
(`docs.stripe.com/payments/swish`, 2026). Swish är en app-baserad betalmetod med 8+ miljoner
användare; kund godkänner via Swish-appen + BankID (redirect eller QR-kod).

Konsekvens för Corevo:
- Via Stripe kan kund betala online med **Swish, kort, Klarna, Apple Pay, Google Pay, Link**
  (alla stöds i Sverige).
- Swish slås på i **Stripe Dashboard** och funkar med Checkout / Payment Element.
- **OBS – verifiera mot Connect direct charges:** Swish är "single-use" och har egna regler.
  Innan MVP: bekräfta att Swish funkar med **direct charges + application_fee_amount** på
  Express-konton (vissa lokala metoder har begränsningar i Connect). Se öppen fråga 4b nedan.
- Oavsett Stripe-Swish kvarstår **"betala på plats"** (salongen kan köra egen Swish i kassan).
- Rekommendation MVP: erbjud **Swish + kort** online via Stripe; Klarna som tillval.

---

## 9. Öppna frågor (max 4)

1. **Betalmetoder MVP?** Swish + kort räcker för start, eller även Klarna direkt? (Stripe stödjer alla tre i SE.)
   - **4b (Swish + Connect):** verifiera att Swish funkar med direct charges + application_fee på Express-konton innan vi lovar Swish online.
2. **Vem betalar refund-Stripe-avgiften?** Vid återbetalning får salongen inte tillbaka
   Stripes kortavgift. Ska Corevos 5 kr alltid återföras, eller behållas vid avbokning?
3. **No-show / avbokningsavgift:** ska vi ta del-avgift vid sen avbokning (kräver delvis
   capture / separat charge)? Påverkar status-modellen.
4. **Express onboarding-block:** om salong inte slutfört Stripe-onboarding (`charges_enabled=false`)
   — visa bara "betala på plats" tills onboarding klar, eller blockera online-knappen helt?
