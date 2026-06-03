# M8 — Betalningar & Stripe (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** ingen gammal modul-spec (M8 fanns bara i modulkartan).
**Läs först:** `HANDOFF.md` + `CLAUDE.md` + `1-Planering/03-pengaflode-stripe.md`. POS-guardrail.

> **Röd tråd:** M8 kopplar på färdig M3. Gate vid bokning, refund vid avbokning, completion vs betalning (M3/M5), Payflow-nudge (M4), aktiveringstoggle per tenant (M7). Faktureringsunderlag (flöde 2) = separat, manuellt (M7).

---

## 0. Vad modulen ÄR

Pengaflöde 1: kund betalar för **tjänsten** vid bokning → rakt till salongens egna Stripe-konto. Corevo tar inget snitt på transaktionen.

---

## ⭐ ÖVERGRIPANDE LÅS: byggs helt, ligger VILANDE
**Betalningslagret byggs klart men aktiveras INTE nu.** Default `payments_enabled = false` ⇒ allt går som idag (betala i salong, gratis flöde). **Zivar aktiverar per salong i M7-admin** när han är redo. **Betalning får ALDRIG störa dagens bokningsflöde.** Detta gäller hela modulen.

---

## 1. Ytor — byggt / verifierat / saknas

| Yta | ✅ Kod-klart | ⚠️ Overifierat | ❌ Saknas |
|---|---|---|---|
| **Connect + charges** | Express + DIRECT charges, `application_fee = 0` | runtime kräver Zivars test-nycklar | — |
| **Gate** | `payments_enabled` AND `stripe_charges_enabled` (default av) | — | — |
| **payments-tabell** | tenant-RLS, UNIQUE(booking_id) idempotens, status pending/succeeded/failed/refunded | — | — |
| **Webhook** | succeeded/failed/refunded/account.updated, idempotent, Workers-säker | **MÅSTE vara Connect-endpoint (§2.1)** | — |
| **Refund** | refund vid avbokning | — | flytt-av-betald-bokning (§2.3) |
| **Onboarding** | Account Links, StripeConnectCard (M6) | — | — |
| **Kvitto/nudge** | kvitto-mejl + Payflow Google-nudge | — | — |

---

## 2. Spikade beslut (M8)

### 2.1 🔬 Connect-webhook — den pengkritiska (ej beslut, hård regel)
Webhooken **MÅSTE vara en Stripe _Connect_-endpoint**, inte en vanlig. Direct-charge-events (`payment_intent.*`, `charge.refunded`) fyrar på det connected kontot → når **bara** en Connect-endpoint.
> Fel typ ⇒ betalning lyckas i Stripe men **bokningen flippar ALDRIG till bekräftad**, payment fastnar `pending`, inget synligt fel. Värsta tysta buggen.

`STRIPE_WEBHOOK_SECRET` = **Connect-endpointens** secret. Prenumerera: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. **Verifieras live i test-mode** innan M8 kan kallas klar.

### 2.2 Full betalning, ingen deposit
Kund betalar **fullt belopp** för tjänsten vid bokning. Ingen deposit. SEK i v1.

### 2.3 Refund vid avbokning — default, ej hugget i sten
- **Default:** full refund **inom** avbokningsfönstret (M3 §2.6), ingen utanför.
- **Inte rigid:** en **betald bokning ska kunna flyttas/ombokas** — betalningen **följer med** till ny tid (ingen refund-rundgång). Misstag ska kunna hanteras.

### 2.4 No-show när förbetalt — per salong, byggs men aktiveras inte nu
- Salongen ställer in (behåll som no-show-avgift vs refund).
- ⚠️ **Byggs men aktiveras inte nu** — kommer när Zivar vet hur **Stripe tar sin del vid refund**. Får **inte** skapa problem i bokningsflödet idag.

### 2.5 Slot-squat — löst av M3
Övergiven checkout som låser tiden `pending` = M8:s följdskuld. **Löses av M3:s 5-min-hold** (M3 §2.2). Ingen ny lösning här.

---

## 3. Röd tråd — kopplingar

| Koppling | Vad M8 gör | Var det andra bor |
|---|---|---|
| **M3 ↔ M8** | gate vid bokning; 5-min-hold löser squat; flytt av betald bokning; ej falskt betald på no-show | M3 äger bokning/hold |
| **M5 → M8** | completion-gate mot betalning | M5 markerar klar |
| **M8 → M4** | betalning lyckad → lojalitetspoäng + Payflow-nudge | M4 äger lojalitet |
| **M8 → M7** | aktiveringstoggle per tenant; (underlag flöde 2 = separat/manuellt) | M7 äger aktivering + fakturering |
| **M6 → M8** | StripeConnectCard (onboarding), `payments_enabled`-toggle i settings | M6 äger settings |

---

## 4. Bygg-items (vad Code faktiskt gör i M8)

**Rör INTE** (kod-klart): Connect/charge-flödet, gate, payments-tabell + idempotens, webhook-handlern, refund-vägen. **Bygg/verifiera, riv inte.**

1. **Verifiera Connect-webhook live i test-mode (§2.1)** — #1-prioritet. Betalning lyckad → bokning bekräftad. Kräver Zivars test-nycklar (pending-owner).
2. **Håll lagret vilande (⭐):** default av; verifiera att dagens gratis bokningsflöde är **oförändrat** med betalning av.
3. **Flytt av betald bokning (§2.3):** omboka bär betalningen, ingen refund-rundgång.
4. **No-show-refund (§2.4):** bygg logiken, **aktivera ej**; får ej störa flödet.
5. **Full betalning, ingen deposit** (§2.2).

---

## 5. Pending-owner (Zivar, out-of-band — Code rör ej)
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (Connect-endpointens) som Worker-secrets.
- Skapa **Connect**-webhook-endpoint i Stripe, prenumerera rätt events (§2.1).
- Verifiera OpenNext-bundle vid deploy (ASCII-väg / elevad terminal — `ö`-fällan).

---

## 6. Parkerat (planerat, byggs inte / aktiveras inte först)

- **Hela betalningslagret aktiverat** — av tills Zivar flippar per salong (M7).
- No-show-refund-aktivering — senare (Stripe-fee-fråga).
- Sparade betalmetoder (kund) — v2 (M4).
- Deposit — slopat.

---

## 7. Öppet kvar

Inget blockerande för bygge. Den verkliga grinden är **Zivars test-nycklar + Connect-webhook** (§5) för live-verifiering — allt annat är kod-klart och vilande tills aktivering.
