# goal-49 — WEBSHOP: köp-rälsen (modul "på riktigt")

> **Task 5 i kön** (moduler störst-först: **webshop** → blogg → lojalitet → presentkort).
> Gör webshop-modulen lika komplett som boknings-modulen: bästa köpupplevelse + merchant-admin, multi-tenant, hostat.
> **Canon/underlag:** `3-Bakgrund-Research/gap-analys-webshop-2026-06-26.md` (forskning + källor) · `1-Planering/05-multibransch-bygge/moduler/shop.md` (baseline-spec) · `booking.md` (klass-baren = mönstret kassan speglar) · `0007_payments_stripe_connect.sql` (betal-räls att förlänga) · DB `0031`/`0032`.

## §0 Scope-lås
- **EN goal** byggd OVANPÅ det redan byggda. Bygg INTE om: produkt-CRUD (`ShopAdmin.tsx`), storefront-katalog (`ShopSection.tsx`/`load-shop.ts`), modul-register (`0031`), DB-tabeller (`0032`).
- **Kärnan som fattas = hela köp-rälsen** (varukorg → kassa → order). Allt annat hänger på den.
- **Universal motor + variant per bransch — ALDRIG fork.** Skillnad uttryckbar som data → variant; kräver ny tabell → additiv migration (build-once-never-delete).
- 🟡 i gap-analysen (reviews, wishlists, buy-X-get-Y, abandoned-cart, Stripe Tax, collections…) = **EJ v1**. Egna kort senare bakom per-tenant-toggle. Kläm inte in.

## §1 Nuläge (kod-verifierat)
**Finns:** `shop_products` (pris/lager/bild/active/sort), `shop_orders` (header: kund + fulfilment-snapshot `ship|pickup_within_days|order_in_then_pickup` + status + `payment_status` ren statuskolumn), `shop_order_items` (produkt-snapshot name/price + qty). Full produkt-CRUD-admin. Storefront-katalog-render. `shop.fulfilment`-variant i registret. Stripe Connect-räls (direct charge, `application_fee=0`) finns för bokning.

**Fattas (köp-rälsen):**
- Ingen varukorg, ingen kassa, ingen `create_shop_order`-RPC.
- `shop_orders` saknar **anon-INSERT-väg** → gäst kan inte lägga order alls (RLS: bara authenticated skriver).
- Ingen variant-grain (pris/SKU/lager/bild **per variant**) — schemat är en-rad-per-produkt.
- Ingen moms-sats-per-rad. Ingen order-historik i `/konto`. Ingen refund/rabatt/frakt/moms-config i admin.

## §2 Hårda lagar (icke förhandlingsbart)
- **🔒 INGA out-of-band live-DB-ändringar.** Allt schema via migration i `5-Kod/supabase/migrations/` → **pausa före apply för Zivars OK** → applicera. (Lärt dyrt: template-bron-driften.)
- **🔒 POS `corevo.se` + de 3 fasta hostarna (booking/superbooking/minbooking) får ALDRIG gå ner** vid deploy.
- **🔒 Betal-compliance-gate (⚫):** SCA/3DS + `charge.dispute.*`-webhooks + refund-paritet MÅSTE vara gröna FÖRE en riktig charge. Bygg HELA rälsen; live-betalning = EN switch (`payments_enabled`) — defaulta AV.
- **Kassaregister/kvitto:** online-betalt = inget krav. `pickup`/betala-på-plats = försäljning på plats → kassaregister + kvittoplikt (XML-journal 2027). Moms-sats-per-rad additivt (blommor 25%, fika-to-go 6% fr 2026-04-01).
- **Status-ärlighet:** "klart" = mekaniskt render/test-verifierat 0 FAIL, aldrig "kod committad".

## §3 Slices — störst-först, EN klar → verify → nästa
> Varje slice med migration: skriv → **pausa för Zivars OK** → applicera → verifiera. Deploy-first: bevisa på prod (inga kunder → prod = testmiljö) bakom flagga.

**Slice 1 · KÖP-RÄLS KÄRNA** (gap 🔴1–5) — *det allt hänger på*
- Migration (additiv): `create_shop_order` **SECURITY DEFINER**-RPC (summera totaler **server-side**, aldrig lita på klient-pris), anon-INSERT **bara via RPC** (spegla `create_public_booking`). Atomär lager-decrement för spårat lager (second-hand `stock=1`-racet → hold/decrement à la `slot_holds`).
- Varukorg: klient-state (localStorage). `ponytail:` ingen cart-tabell i v1 — lägg till om cart==order-state-machine behövs (gap 🟠9).
- Kassa: **gäst-checkout mest framträdande** (konto EFTER order), **full kostnad synlig FÖRE betalsteget** (frakt+moms+total), **≤8 fält**, inline-validering + trust-signaler.
- Orderbekräftelse + **order-historik i `/konto`**.
- Gate: vitest grön (RPC-total + anon-INSERT-isolering), render-verify kassa→order på prod-testtenant.

**Slice 2 · VARIANT-GRAIN** (gap 🟠8,10) — *designa rätt tidigt*
- Migration (additiv): `shop_variants` (pris/SKU/lager/bild **per variant**), line-items snapshottar redan pris/titel. Behåll header+items (cart==order = senare-option, ej v1).
- Admin + PDP läser varianter; add-to-cart per variant.

**Slice 3 · MERCHANT-ADMIN PARITET** (gap 🟠7,11,12) — *känns som riktig shop*
- Utöka `ShopAdmin.tsx`: lager-spårning (reservera vid order/släpp vid avbokning), order + fulfilment-status + **spårningsnummer**, rabatter (%/fast + fri frakt, kod+auto), frakt-config (zon/flat), moms-config, kunder + orderhistorik, enkel analytics.
- PDP-essentials: bild m. zoom, variant-val tydligt, lager, add-to-cart-feedback, qty-stepper.

**Slice 4 · STRIPE-BETALNING** (gap 🔵) — *bakom `payments_enabled`, compliance-gate grön före live*
- Migration: generalisera `payments` `booking_id` → **även `order_id`** (additivt). Behåll **direct charge** till merchantens connected account, **ingen `application_fee`** (Corevo tar ingen cut — flat SaaS via goal-39).
- PaymentIntents + Stripe.js `confirmPayment` (**SCA/3DS auto** = EES-lagkrav). 7 webhooks: `payment_intent.succeeded/payment_failed`, `charge.refunded`, `charge.dispute.created/closed`, `account.updated`. Idempotens 2 ställen (outbound `IdempotencyKey` + inbound dedupe på `event.id`). **Workers: `constructEventAsync`** (sync `constructEvent` kastar). Refunds via PaymentIntent.

**Slice 5 · MOMS + KVITTO** (gap 🔴6) — *när rälsen öppnas*
- Migration: moms-sats-per-rad på order-items (additivt). Kvittofält för pickup/betala-på-plats.

## §4 Definition of Done
- Gäst kan: bläddra katalog → lägga i varukorg → kassa (≤8 fält, full kostnad synlig) → lägga order → se bekräftelse. Inloggad ser ordern i `/konto`.
- Merchant ser ordern i admin med fulfilment-status + spårningsnr; kan refunda (när betalning på).
- Alla totaler server-side, anon-INSERT bara via RPC, RLS-isolering salong A↔B bevisad.
- Betal-rälsen byggd HEL men `payments_enabled=false` tills compliance-gaten grön.
- Varje slice: vitest grön + render-verify 0 FAIL + oberoende reviewer No-issues.

## §5 Öppna beslut (klubba med Zivar vid Slice-start)
- Per-location-pris vs platt (gap-analys lutar variant-grain → per-variant pris).
- Cart==order-state-machine (gap 🟠9) nu eller senare? (v1-default: separat header+items + klient-cart.)
- café-lojalitet earn-source = trigger på `shop_orders`? (rör lojalitet-modulen, ej blockerande för v1).
