# Gap/opportunity-analys — WEBSHOP-MODULEN (Corevo)

Datum: 2026-06-26 · Källa: research-runda (4 spår: nuläge-inventering i koden + Baymard/NN-g UX + open-source-arkitektur Medusa/Saleor/Vendure + Stripe Connect-docs) vägd mot Corevos faktiska bygge.

> Syfte: göra webshop-modulen lika komplett som boknings-modulen — bästa möjliga köpupplevelse + merchant-admin — för en multi-tenant hostad storefront. Bara det som passar e-handel + Sverige/EES + multi-tenant. Matar goal-49.

## ✅ Det vi redan gör bra (behåll — bygg INTE om)

- **Boknings-modulen = klass-baren.** Full transaktionsräls: server action → SECURITY DEFINER-RPC (`create_public_booking`) → bekräftelse → status-historik → cron-städning → kund-självservice. Atomärt i DB (EXCLUDE-constraint `no_double_booking`), `slot_holds` för reservation under checkout. **Det är mönstret webshop-kassan ska spegla.** [DELAT]
- **Shop-modulen har redan en stark grund (HALV, inte tom):** DB live (`shop_products` med variant-stock, `shop_orders` med fulfilment-enum snapshotad, `shop_order_items`), full produkt-CRUD-admin (`ShopAdmin.tsx`), storefront-katalog-render (`ShopSection.tsx`), modul-register + variant-schema (`shop.fulfilment`). [KUNDENS]
- **Stripe Connect-räls finns redan** (för bokning, `0007_payments_stripe_connect.sql`): `tenants.stripe_account_id`, `payments`-tabell med idempotens, **DIRECT charge till salongens connected account, `application_fee=0`** (Corevo tar INGEN transaktions-cut — intäkt = flat SaaS-avgift via separat faktura, goal-39), webhook-route, capability-gates via `account.updated`. [DIN+KUNDENS]
- **Universal-motor + variant-principen** + modul-admin-mönstret (två ytor + registry-rad). Webshop följer den — ingen fork. [DELAT]

## 🔴 MÅSTE för en trovärdig webshop (kärnan som saknas = hela köp-rälsen)

1. **Varukorg → kassa → order-skapande** [KUNDENS] — idag finns INGEN varukorg, ingen checkout, ingen `create_shop_order`-RPC, och `shop_orders` saknar anon-INSERT-policy → en gäst kan inte lägga en order alls. → bygg varukorg → kassa → atomär `create_shop_order` SECURITY DEFINER-RPC (summera totaler server-side) + anon-INSERT bara via RPC, exakt boknings-mönstret. Second-hand `stock=1`: atomär decrement/hold som `slot_holds` (spec flaggar racet).
2. **Gäst-checkout, mest framträdande** [KUNDENS] — tvingad konto-skapande = 19% avhopp; 62% av sajter gör prominensen fel. Skjut konto till EFTER ordern. (Baymard)
3. **Full kostnad synlig FÖRE betalsteget** [KUNDENS] — frakt + moms + avgifter + totalsumma. #1 avhoppsorsak (39% "extra kostnader för höga") + #8 (14% "kunde inte se totalen"). (Baymard)
4. **≤8 fält i kassan** [KUNDENS] — snitt är 14.88 (dubbelt); 17–18% avhoppar pga "för lång". Antal FÄLT, inte antal steg, avgör. (Baymard)
5. **Trust-signaler vid betalning + adaptiv inline-validering** [KUNDENS] — 19% litar inte på kort-säkerhet; 94% av sajter har dålig felhantering (vaga fel + raderad data). (Baymard)
6. **Moms-per-rad + kvittofält när rälsen öppnas** [DELAT] — online-betalt e-handel kräver INTE kassaregister, MEN pickup/betala-på-plats (`pickup_within_days`/`order_in_then_pickup`) = försäljning på plats → **kassaregister + kvittoplikt**. Moms varierar per produkt (blommor 25%, fika-to-go 6% fr 2026-04-01, m.m.) → `shop_orders` behöver **moms-sats-per-rad** (additivt, finns ej idag). XML-journal-krav 2027. (shop.md + Skatteverket)

## 🟠 PRODUKTVÄRDE (merchant-admin-paritet + köpupplevelse)

7. **Merchant-admin måste-paritet (11 capabilities = v1-golvet)** [KUNDENS] — för att kännas som "en riktig shop": variant-hantering (pris/SKU/lager/bild per variant), lager-spårning (reservera vid order, släpp vid avbokning), order + fulfilment-status + **spårningsnummer**, refunds, rabatter/koder (%/fast + fri frakt, kod + auto), frakt-config (zon/flat), moms-config, kunder + orderhistorik, enkel analytics. (Shopify-benchmark)
8. **Variant-nivå som grain** [KUNDENS] — pris/SKU/lager/bild per variant (Shopify/Medusa/Saleor överens). Designa datamodellen så från dag 1.
9. **Cart == Order, en entitet + state-machine** [KUNDENS] — Vendure/Saleor-mönstret: ingen separat cart→order-kopiering, "aktiv" är ett state. Färre tabeller, säkrare totaler, sanare delrefunds.
10. **Rad-snapshots (pris/titel) på line items** [KUNDENS] — produkt-edit får aldrig mutera historiska ordrar. (Medusa)
11. **PDP-essentials** [KUNDENS] — bild m. zoom, valbara varianter m. tydligt val, lager, add-to-cart m. feedback, skimbar beskrivning. (NN/g)
12. **Wallets (Apple/Google Pay) + kvantitets-steppers** [KUNDENS] — 10% avhopp "för få betalsätt"; 97% gör qty-fält fel. (Baymard)

## 🟡 SENARE / framtid (bakom per-tenant-toggle — stör inte v1-trovärdighet)

- Reviews/ratings, wishlists, back-in-stock, recently-viewed, cross-sell. (NN/g "nice")
- Buy-X-Get-Y/tiered-rabatter, multi-location-lager, frakt-profiler, carrier-rates, label-print.
- Kund-segmentering, marketing/email, abandoned-cart-recovery, draft/manuella ordrar, order-edit efter köp.
- Stripe Tax (auto-moms) vs manuell moms-sats; collections/bundles/presentkort/digitala produkter; CSV-import.

## 🔵 STRIPE / BETALNING — koppla rätt, en gång för alla [DIN+KUNDENS]

- **Beslut att klubba (Zivar):** webshop-betalning = **förläng boknings-rälsen (DIRECT charge till merchantens connected account, ingen `application_fee`)** för konsistens + för att Corevo tar ingen transaktions-cut (flat SaaS-billing). Research rekommenderar destination charges + `on_behalf_of` + Express + `application_fee_amount` — optimalt OM plattformen vill styra settlement/ta cut, men det matchar INTE Corevos modell. **FORGE-reko: behåll direct-charge-mönstret, generalisera `payments` från `booking_id` → även `order_id`.** (Stripe-docs + 0007)
- **Oavsett modell, bygg rätt:** PaymentIntents + Stripe.js `confirmPayment` → **SCA/3DS hanteras automatiskt** (lagkrav EES, satisfieras av Payment Intents-API:t). 7 webhooks: `payment_intent.succeeded/payment_failed`, `charge.refunded`, `charge.dispute.created/closed`, `account.updated`. Idempotens på 2 ställen (outbound `IdempotencyKey` + inbound dedupe på `event.id`). **Cloudflare Workers: använd `stripe.webhooks.constructEventAsync` (sync `constructEvent` kastar i Workers).** Refunds via PaymentIntent; dispute → flagga + ev. transfer-reversal.
- **Compliance-gate (⚫, från launch-beslut):** SCA/3DS + dispute-webhooks + refund-paritet MÅSTE vara gröna före live-charge. Bygg HELA rälsen; live-betalning = EN switch (`payments_enabled`) när gaten är grön.

## Hur detta möter nuläget

- Allt ovan = EN goal (**goal-49**) byggd OVANPÅ `shop.md`-specen + det byggda (DB/admin/katalog). Kärnan = köp-rälsen (🔴 1) speglad från boknings-modulen. Merchant-admin (🟠 7) utökar `ShopAdmin.tsx`. Stripe (🔵) förlänger `0007`-rälsen.
- 🟡 = egna kort EFTER v1, bakom per-tenant-toggles. Kläm inte in i v1.

## Källor

- Baymard Institute — [Cart abandonment (70.22% snitt, avhoppsorsaker)](https://baymard.com/lists/cart-abandonment-rate) · [Checkout form fields (≤7–8)](https://baymard.com/blog/checkout-flow-average-form-fields) · [Checkout UX 2025 (10 pitfalls)](https://baymard.com/blog/current-state-of-checkout-ux)
- Nielsen Norman Group — [Ecommerce product pages](https://www.nngroup.com/articles/ecommerce-product-pages/)
- Shopify Help Center — [Products/Variants/Inventory/Fulfillment/Discounts/Taxes/Customers](https://help.shopify.com/en/manual)
- Medusa — `docs.medusajs.com` (commerce modules: product, cart, order, fulfillment, inventory, tax, promotion) · Saleor — `docs.saleor.io` (channels, checkout, taxes) · Vendure — `docs.vendure.io` (orders FSM, channels, taxes, promotions)
- Stripe — `docs.stripe.com` (Connect charges, destination charges, account types, Account Links, SCA/3DS, webhooks, disputes, refunds, idempotency)
- Internt: `1-Planering/05-multibransch-bygge/moduler/shop.md` (baseline), `booking.md` (klass-baren), `0007_payments_stripe_connect.sql`, `0031/0032` shop-DB
