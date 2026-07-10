# Webshop-modulen (goal-49) ur multi-bransch-perspektiv

> Granskning 2026-07-11. Omfattning: `app/butik/`, `lib/storefront/shop/`, `lib/admin/shop/`, `components/storefront/shop/`, `components/admin/ShopAdmin.tsx`, `app/(admin)/admin/webshop/`, migrationer 0031/0032/0042–0044, lojalitet 0011/0016.

## Sammanfattning

Webshopen är redan **medvetet bransch-neutral i datalagret**: config-first (fulfilment-variant i `tenant_modules.config`), variant-agnostiska tabeller (0032/0042 säger uttryckligen "Inga bransch-if"), EN order-FSM (`reserved → awaiting_payment/pending → confirmed → ready → completed`, + `cancelled/expired`), atomär lagerhållning via `reserved_qty`. Det frisör-specifika sitter nästan uteslutande i **UI-copy och admin-etiketter** ("salong", "Salongsadmin") — inte i beteende. De riktiga bransch-gapen är: **produktkategorier saknas helt**, **restaurang-fulfilment (tidsslot/samma-dag)** täcks inte av de tre varianterna, **tjänst+reservdel-koppling** (cykel) saknas cross-modul, och **valutan är hårdkodad `sek` i Stripe-spåret** trots att `ShopConfig.currency` finns.

## 1. Vad är frisör/salong-specifikt idag

### 1.1 Ren terminologi (bara text — inga beteende-skillnader)

| Fil:rad | Idag | Problem |
|---|---|---|
| `apps/web/lib/admin/shop/actions.ts:12` | `NO_TENANT = 'Ingen salong är kopplad till ditt konto.'` | "salong" hårdkodad |
| `apps/web/app/(admin)/admin/webshop/page.tsx:11` | `title: 'Webshop · Salongsadmin'` | "Salongsadmin" |
| `apps/web/app/(admin)/admin/webshop/page.tsx:19` | `eyebrow="Salongsadmin"` | dito |
| `apps/web/app/(admin)/admin/webshop/page.tsx:20` | "Ingen salong är kopplad…" | dito |
| `apps/web/app/(admin)/admin/webshop/page.tsx:32` | "Webshop är inte aktiverad för din salong." | dito |
| `apps/web/lib/storefront/shop/types.ts:22-26` | `SHOP_FULFILMENT_LABELS`: "Hämta i butik", "Beställ hem till butik" | "butik" funkar för cykel/nagel; restaurang vill säga "Hämta i restaurangen" |
| `apps/web/lib/storefront/shop/types.ts:175-199` | `fulfilmentPromise()` + `shopCtaLabel()` hårdkodade svenska strängar per variant | samma — bransch-neutral men ej bransch-anpassningsbar |
| `apps/web/app/butik/kassa/CheckoutForm.tsx:60,144` | "Tillbaka till butiken" | restaurang: "till menyn"? |
| `apps/web/components/storefront/shop/CartButton.tsx:46,70,100` | "Varukorg" | OK generellt, men borde kunna overridas |
| `apps/web/app/butik/actions.ts:207,271` | kommentarer säger "salong(en)s konto" | bara kommentarer — noll prioritet |

**Fix-mönster:** bransch-overlay finns redan — `verticals.terminology` läses i `apps/web/lib/admin/tenant.ts:51-63` och används i onboarding-studion. Shop-UI:t konsumerar den INTE idag. Minsta åtgärd: (a) admin-ytorna byter "salong/Salongsadmin" mot terminology-nyckel (t.ex. `business`/`admin_area`) med generell fallback ("verksamhet"); (b) fulfilment-labels/promise/CTA får per-tenant override i `tenant_modules.config` (t.ex. `labels: { pickup: "Hämta i restaurangen" }`) som `parseShopConfig` (`types.ts:144-161`) coercar — inga bransch-if i koden, bara config.

### 1.2 Riktiga beteende-skillnader (kräver kod/DB)

1. **Produktkategorier saknas.** `shop_products` (migr `0032_shop_tables_rls.sql:39-56`, typ `lib/admin/shop/types.ts:5-18`) har ingen `category`-kolumn; storefront (`components/storefront/ShopSection.tsx`) renderar en platt lista. Frisör med 8 schampon klarar sig — en cykelbutik med 200 reservdelar (däck/slang/bromsar) eller restaurangmeny (förrätt/varmrätt) gör det inte. **Ändring:** ny kolumn `shop_products.category text` (fri text, tenant-styrd — INTE ett bransch-enum) + gruppering i `ShopSection.tsx` + fält i `ShopAdmin.tsx` (produktformulär ~rad 102-467) + `lib/admin/shop/actions.ts` upsert.

2. **Restaurang ta-hem = ny fulfilment-variant, inte en label.** Dagens tre (`types.ts:17`, CHECK i `0032:67-68`, RPC-validering `0042:185`) är dag-granulära (`pickupDays`/`leadDays`). Ta-hem behöver: (a) upphämtnings-TID (slot eller "klar om ~X min"), (b) öppettids-gate (kan inte beställa när stängt), (c) kortare order-TTL än 30 min (`app/butik/actions.ts:78`). **Ändring:** ny variant `pickup_asap` i `SHOP_FULFILMENTS` + CHECK-migration på `shop_orders.fulfilment` + `reserve_shop_order`-valideringen (0042:185) + gren i `fulfilmentPromise`/`shopCtaLabel` + ev. tidsfält i `CheckoutForm.tsx` (mönstret finns: `needsAddress = fulfilment === 'ship'` rad 29 → `needsPickupTime = fulfilment === 'pickup_asap'`). Öppettids-gaten kan återanvända bokningens öppettidsdata.

3. **Cykelbutik: tjänst + reservdelar i samma affär.** Bokning (service) och webshop (delar) är separata moduler — det är RÄTT arkitektur (moduler à la carte). Gapet är kopplingen: "boka service + beställ in delarna till samma besök". Minsta rimliga: nullable `shop_orders.booking_id uuid references bookings` + "koppla till bokning"-rad i kassan när kunden är inloggad och har kommande bokning. `order_in_then_pickup`-varianten (leadDays) är för övrigt redan byggd exakt för reservdels-caset — bra grund.

4. **Nagelstudio (produkter):** täcks i praktiken redan av `ship`/`pickup_within_days` — behovet är terminologi + kategorier (punkt 1.1 + 1.2.1), inga nya beteenden.

5. **Valuta hårdkodad i Stripe-spåret.** `app/butik/actions.ts:246` (`currency: 'sek'` i payments-upsert) och `:254` (`price_data: { currency: 'sek' … }`) ignorerar `ShopConfig.currency` (`types.ts:36`) och `shop_orders.currency`. Fungerar idag (allt SEK) men är en latent multi-marknads-bugg. **Ändring:** läs `order.currency` (hämtas redan rad 233).

6. **Moms per bransch/varutyp.** `tax_cents` finns på order + rader (`0042:75,85`) men sätts aldrig (goal-49-memory: "KVAR: rabatt/frakt/moms"). Restaurang (12 % livsmedel) vs produkter (25 %) gör moms till ett bransch-beroende — lägg momssats per produkt (`shop_products.vat_rate`) hellre än per bransch.

## 2. Order-FSM och reserved_qty — bransch-hållbarhet

- FSM (`0042:91`): `reserved, awaiting_payment, pending, confirmed, ready, completed, cancelled, expired` — täcker alla tre branscher. Restaurang mappar `confirmed→ready` som "tillagas→klar"; enda önskan är snabbare TTL (parameter `p_ttl_min` finns redan i `reserve_shop_order`, `app/butik/actions.ts:78` — gör den config-styrd).
- Status-etiketter är frisör-neutrala men fasta: `lib/admin/shop/types.ts:55-61` ("Klar att hämta" osv). Ta-hem-restaurang vill säga "Klar för avhämtning" — samma label-override-mekanism som 1.1.
- `reserved_qty`-hållet (`0042:37-55`, constraint `reserve_le_stock`) är helt bransch-agnostiskt. Restaurang sätter `stock = null` (ospårat) — funkar direkt.
- Variant-grain (`shop_product_variants`) täcker cykel (däckdimensioner) och nagel (färger) utan ändring; kvarvarande gap är multi-variant-UI i admin (goal-49-känt).

## 3. Lojalitet: minsta rimliga redeem-väg i webshop-kassan

**Nuläge:** earn-only. Trigger `earn_loyalty_on_completed()` (`supabase/migrations/0016_loyalty_earn.sql:9-38`) mintar poäng vid bokning `completed`. MEN: ledgern är redan redeem-förberedd — `loyalty_ledger.reason` CHECK tillåter `'redeem'` (`0011_customers_identity_and_schedule.sql:120`), `points_delta` är signerad, saldo beräknas som `sum(points_delta)` (`lib/admin/data.ts:328-338`). Ingen migration av earn-sidan behövs.

**Skiss — "betala delvis med poäng" utan att röra earn-triggern:**

1. **Migration (ny, t.ex. 0045):**
   - `alter table loyalty_ledger add column shop_order_id uuid references shop_orders(id)` + partiell unik index `loyalty_ledger_redeem_once on (shop_order_id) where reason = 'redeem'` (spegel av `earn_once`-mönstret, `0011:225-226`).
   - Ny SECURITY DEFINER-RPC `redeem_loyalty_on_shop_order(p_order_id, p_token, p_points)`: kräver `auth.uid()` (inloggad kund — gäster har inget saldo), verifierar order i status `reserved` och ägd via token, `v_balance := sum(points_delta)` för kunden, `v_points := least(p_points, v_balance, subtotal_cents / öres_per_poäng)`, sätter `shop_orders.discount_cents = v_points * value` (kolumnen finns redan, `0042:84`, och `get_public_shop_order` exponerar den redan, `actions.ts:179`) och insertar `points_delta = -v_points, reason='redeem', shop_order_id=…`. Konverteringskurs ur `tenant_settings.settings.loyalty.point_value_cents` (default t.ex. 1 poäng = 1 öre × 100 → gör den tenant-konfigurerbar som `points_per_visit` i 0016:28).
   - Släpp-väg: `release_shop_order`/expiry måste återföra poängen — enklast en kompenserande `+v_points`-rad med `reason='adjustment'` i samma release-RPC (ledgern är append-only, `0011:460-465`, så aldrig delete).
2. **Server-action:** ny `redeemPoints(orderId, token, points)` i `app/butik/actions.ts` (samma mönster som `confirmOrder` rad 110-157, authed-klient, RPC-fel-mappning).
3. **UI:** i `CheckoutForm.tsx` — när inloggad kund har saldo > 0: rad "Använd X poäng (−Y kr)" med checkbox/slider; bekräftelsesidan visar redan `discount_cents`.
4. **Rör INTE:** `0016_loyalty_earn.sql`, `earn_once`-indexet, bokningsflödet. Redeem är en helt additiv gren i samma ledger.

Öppna beslut: ska webshop-köp också EARNA poäng? (Idag earnar bara bokningar.) Föreslås NEJ i v1 — håll scopet till redeem.

## 4. Ändringspunkter — terminologi vs beteende

| # | Punkt | Typ | Filer |
|---|---|---|---|
| T1 | "salong"-strängar i admin | Terminologi | `lib/admin/shop/actions.ts:12`, `app/(admin)/admin/webshop/page.tsx:11,19,20,32` |
| T2 | Fulfilment-labels/promise/CTA overridebara via config | Terminologi (config-mekanism) | `lib/storefront/shop/types.ts:22-26,175-199`, `parseShopConfig:144-161`, `components/admin/ShopAdmin.tsx:64-65` |
| T3 | Status-etiketter overridebara | Terminologi | `lib/admin/shop/types.ts:55-61` |
| B1 | Produktkategorier (kolumn + gruppering + adminfält) | Beteende | migr 0045, `lib/admin/shop/types.ts:5-18`, `components/storefront/ShopSection.tsx`, `components/admin/ShopAdmin.tsx` |
| B2 | `pickup_asap`-variant (restaurang ta-hem: tid + öppettider + kort TTL) | Beteende | `lib/storefront/shop/types.ts:17`, migr (CHECK 0032:67-68 + RPC 0042:185), `app/butik/kassa/CheckoutForm.tsx:29`, `app/butik/actions.ts:78` |
| B3 | Valuta ur order i Stripe-spåret | Beteende (bugg-fix) | `app/butik/actions.ts:246,254` |
| B4 | Moms per produkt (`vat_rate`) | Beteende | migr, `reserve_shop_order`-summeringen (0042), admin-produktform |
| B5 | `shop_orders.booking_id` (tjänst+delar, cykel) | Beteende | migr, `CheckoutForm.tsx`, `confirm_shop_order` |
| B6 | Lojalitets-redeem i kassan (§3) | Beteende | migr 0045-RPC, `app/butik/actions.ts`, `CheckoutForm.tsx` |

## Rekommenderad byggordning

1. **B3 — valuta-fix** (2 rader, tar bort en latent bugg; ingen migration).
2. **T1 — "salong"-strängar** via terminology-overlay/generell fallback (ren text, låg risk, direkt multi-bransch-vinst i admin).
3. **B1 — produktkategorier** (förutsättning för cykel/restaurang-kataloger; liten migration + UI-gruppering).
4. **T2+T3 — config-styrda labels** (bygger label-override-mekanismen en gång; nagelstudio blir "klar" här).
5. **B6 — lojalitets-redeem** (självständig, additiv, rör inte earn; hög kundvärde-per-timme).
6. **B2 — `pickup_asap` för restaurang** (störst ny yta: tid + öppettider + TTL; gör efter att labels-mekanismen finns).
7. **B4 — moms per produkt** (krävs på riktigt först när betal-rälsen slås på brett; ligger efter B2 för restaurang-momsen).
8. **B5 — booking-koppling** (nice-to-have för cykel-caset; vänta på verklig kund i den branschen).
