# goal-49 — Webshop: komplett köp-räls + admin-paritet + Stripe Connect

Thinking: 🔴 (arkitektur, flera filer, nytt flöde, pengar + compliance → rollback OBLIGATORISK + Zivar-OK före varje live-migration. Bygg HELA modulen; live-betalning bakom flagga tills compliance-gaten är grön.)

**Datum:** 2026-06-26 · **Typ:** Autonom goal-brief, körs av Code i FÄRSK context med alla verktyg (advisor/reviewer-linser, render-bevis). Grundad i `3-Bakgrund-Research/gap-analys-webshop-2026-06-26.md` (research-runda) + `1-Planering/05-multibransch-bygge/moduler/shop.md`.

## Mål

Gör webshop-modulen **lika komplett som boknings-modulen** — inget halvt. Kund handlar end-to-end (katalog → produktsida → varukorg → kassa → order → orderhistorik). Merchant driver shopen (admin-paritet: variant/lager/order/fulfilment/refund/rabatt/frakt/moms). Betalning via Stripe Connect **byggd komplett**, live-aktiverad bakom flagga (`payments_enabled`) när compliance-gaten är grön.

## Lägeskoppling

Template-bron klar (salvia live). Detta = **Task 5 / första modulen** i "moduler störst-först" (webshop → blogg → lojalitet → presentkort). Webshop byggs FÖRST så den är redo när mallarna (goal-36) kommer. Bär render-disciplinen från template-bron (0 FAIL).

## Kontext (research-runda 2026-06-26 — läs gap-analysen FÖRST)

**Shop är HALV, inte tom.** Finns: `shop_products` (variant-stock), `shop_orders` (fulfilment-enum snapshotad), `shop_order_items`, full produkt-CRUD-admin (`ShopAdmin.tsx`), storefront-katalog (`ShopSection.tsx`), modul-register + `shop.fulfilment`-variant. **Saknas = HELA köp-rälsen:** ingen varukorg, ingen checkout, ingen `create_shop_order`-RPC, ingen anon-INSERT-policy på orders, ingen betal-räls för orders, ingen moms-per-rad.

**Boknings-modulen = baren att spegla:** server action → SECURITY DEFINER-RPC (`create_public_booking`) → bekräftelse → status-historik → cron-städ → kund-självservice; atomärt i DB; `slot_holds` för reservation. Webshop-kassan ska följa exakt det.

**Datamodell (från Medusa/Saleor/Vendure):** Cart == Order (en entitet + state-machine), variant-grain (pris/SKU/lager/bild per variant), **rad-snapshots** (pris/titel på line items, så produkt-edit ej muterar historik), adjustment-lines (rabatt) + tax-lines (moms) per rad. SKIPPA channels/region-engine/multi-location (tenant_id = vår "channel"; en valuta per tenant), edits/exchanges/claims. BEHÅLL `reserved_qty` (oversell-skydd).

**UX-krav (Baymard/NN-g — 70% snitt-avhopp):** gäst-checkout mest framträdande + konto EFTER köp; ≤8 fält; full kostnad (frakt+moms+total) FÖRE betalsteg; trust-signaler + adaptiv inline-validering; qty-steppers; PDP m. zoom/variantval/lager/feedback; wallets (Apple/Google Pay).

**Stripe (förläng boknings-rälsen, INTE ny modell):** DIRECT charge till merchantens connected account, `application_fee=0` (Corevo tar ingen cut — flat SaaS-billing). Generalisera `payments` `booking_id` → även `order_id`. PaymentIntents + Stripe.js `confirmPayment` → SCA/3DS automatiskt. 7 webhooks + idempotens (outbound key + inbound `event.id`-dedupe). Workers: `constructEventAsync` (sync kastar).

## Berörda filer

**DB (nya migrationer, additiva):** `5-Kod/supabase/migrations/00NN_shop_cart_order_rail.sql` (NY) · `00NN_shop_payments_generalize.sql` (NY — payments `booking_id`→polymorf/`order_id`). Mönster från `0005`/`0014` (RPC+holds), `0026` (modul-core), `0007` (payments).
**Storefront:** `5-Kod/apps/web/components/storefront/ShopSection.tsx` + `ShopCta.tsx` (idag inert → koppla varukorg) + NYA: produktsida, varukorg, kassa-flöde, bekräftelse.
**Kund-yta:** `5-Kod/apps/web/app/(kund)/konto/` → NY orderhistorik (spegla `konto/bokningar/[id]`).
**Admin:** `5-Kod/apps/web/components/admin/ShopAdmin.tsx` + `app/(admin)/admin/webshop/page.tsx` (utöka: variant, lager, order+fulfilment+spårning, refund, rabatt, frakt, moms, kunder, analytics).
**Stripe:** `5-Kod/apps/web/app/api/stripe/webhook/route.ts` (utöka events), ny PaymentIntent-create-action.
**Spec:** `1-Planering/05-multibransch-bygge/moduler/shop.md` (bygg PÅ den, re-härled inte).

## Steg (faser — en delfas → verifiera → nästa. PAUSA före varje live-migration för Zivars OK.)

**Fas 0 — DB-rälsen** (migration, additiv, rollback-fil. ⛔ PAUSA före apply.)
1. Cart==Order-modell: `shop_orders` får `status`-FSM (`cart→active→awaiting_payment→paid→fulfilling→shipped→completed`/`cancelled`) + side-status `payment_status` + `fulfillment_status`. Lägg `shop_order_items` adjustment + tax (moms-sats + momsbelopp per rad).
2. Variant-grain på `shop_products` (eller `shop_product_variants` om varianter): pris/SKU/lager/bild per variant. `reserved_qty`.
3. `create_shop_order(...)` SECURITY DEFINER-RPC: summerar totaler SERVER-SIDE (trusta aldrig klient), atomär stock-reserve (mönster `place_slot_hold`), gapless order-nr (RPC, fail-closed — bokföring), returnerar order. Anon kan INSERT order ENDAST via denna RPC (ingen direkt anon-INSERT-policy).
4. RLS: storefront läser produkter/varianter (anon SELECT, tenant-filtrerat); order-skapande bara via RPC; merchant ser egna orders.

**Fas 1 — Kund-storefront** (render-disciplin, 0 FAIL)
5. Produktsida (PDP): bild+zoom, variantval (tydligt), lager, add-to-cart m. feedback, skimbar text.
6. Varukorg: persistent, qty-steppers (ej fri textruta), rad+total, ta bort/ändra, frakt/moms-estimat eller "beräknas i kassan".
7. Kassa: **gäst mest framträdande**, ≤8 fält (kombinerat namn, auto-stad-från-postnr, dölj Adress-rad-2, default billing=shipping), **full kostnad FÖRE betalsteg**, ordersammanfattning synlig, trust-signaler vid kort, adaptiv inline-fel (namnger sub-felet, raderar ej data), wallets. → `create_shop_order` → bekräftelse.
8. `/konto` orderhistorik (spegla bokningar/[id]).

**Fas 2 — Merchant-admin-paritet** (utöka `ShopAdmin.tsx`)
9. Variant-hantering · lager (reserve/release-vy) · order-lista+detalj med fulfilment-status + **spårningsnummer** · refund (full/del, restock) · rabatter (%/fast + fri frakt, kod+auto, gräns/utgång) · frakt-config (zon/flat) · moms-config (sats per land/produkt) · kunder + orderhistorik · enkel analytics (försäljning/ordrar/toppprodukter).

**Fas 3 — Stripe Connect** (förläng `0007`, ⚫ live bakom flagga)
10. Generalisera `payments` (`booking_id` → polymorf `entity_type`+`entity_id` eller parallell `order_id`), behåll idempotens.
11. PaymentIntent-create server-action: DIRECT charge till `tenants.stripe_account_id`, `application_fee=0`, `IdempotencyKey`. Client: `confirmPayment` (auto-SCA/3DS, hantera `next_action`).
12. Webhooks (utöka route): `payment_intent.succeeded`→fullfölj order/markera paid, `payment_intent.payment_failed`→släpp reserverad stock, `charge.refunded`, `charge.dispute.created/closed`, `account.updated`→capability-gates. Signatur-verify (`constructEventAsync`), dedupe på `event.id`.
13. Live-betalning bakom `tenant_settings.payments_enabled` + compliance-gate — AV tills SCA/3DS + dispute-webhooks + refund-paritet bevisade (⚫ Zivar-OK före första live-charge).

## Verifiering

- [ ] Manuellt: handla end-to-end som GÄST (katalog→PDP→varukorg→kassa→order); order syns i admin + /konto. Variant-pris/lager rätt. Reserve släpps vid avbryt.
- [ ] Stripe test (på staging/flagga): `4242…` (no-auth) + `4000 0025 0000 3155` (kräver 3DS); webhook landar; refund funkar; dedupe vid retry.
- [ ] Auto (Vitest): `create_shop_order` (server-side totaler, atomär stock, anon kan EJ INSERT utan RPC), webhook-dedupe, moms-per-rad-summa.
- [ ] Render-bevis 0 FAIL på storefront-ytorna (template-bron-disciplin).
- [ ] Compliance-checkpoint (HANDOFF §9): moms-sats-per-rad korrekt, kvittofält redo vid pickup/betala-på-plats, gapless order-nr (bryts aldrig vid race/rollback).
- [ ] Oberoende reviewer (Code rättar ej egen läxa) på Fas 0 (RPC/RLS) + Fas 3 (pengar).

## Anti-patterns

- ALDRIG client-side order-INSERT eller klient-trustade totaler → allt via `create_shop_order`-RPC, summera server-side.
- ALDRIG ny Stripe-modell — förläng boknings-rälsen (direct charge, fee=0), generalisera `payments`. Inga destination charges/application_fee (Corevo tar ingen cut).
- ALDRIG halv kassa — bygg hela (gäst-prominent, ≤8 fält, transparent kostnad, trust, inline-fel, wallets).
- Bygg INTE channels/region-prisengine/multi-location-lager (tenant_id = vår channel; en valuta/tenant). Inga edits/exchanges/claims i v1.
- Live-betalning INTE på förrän compliance-gaten grön + Zivar-OK.
- ALDRIG bransch-`if` — allt via `shop.fulfilment`-variant + config.

## Kopplingar

`shop.md` (modul-spec, baseline) · `booking.md` (rälsen att spegla) · `0007_payments_stripe_connect.sql` (Stripe-rälsen att förlänga) · **goal-39** (billing = Corevos flat-avgift, ej transaktions-cut) · **goal-42** (Stripe-golive/compliance-gate ⚫) · `0031/0032` (shop-DB) · gap-analys-webshop-2026-06-26.md.

## Rollback

Varje migration har rollback-fil (`*_rollback.sql`): drop nya tabeller/kolumner/RPC — additivt → säkert. Flagga `webshop_checkout_enabled` AV → storefront-CTA inert (som idag, byte-identiskt). `payments_enabled` AV → ingen charge möjlig. Inget i Fas 0–2 rör pengar; Fas 3 är gated.
