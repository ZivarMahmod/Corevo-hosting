# Goal 92 — media, offert och webshop

Datum: 2026-07-29
Status: aktivt bygge enligt Zivars beslut 2026-07-29

## Forskningsslutsats

Corevos commerce-kärna ska behållas. Den har redan atomisk lagerreservation,
ordersnapshots, token-gatad läsning, payment-signaturkontroll,
tenant/account-fences och idempotent lagercommit. Goal 92 ska täta fyra
sanningsgränser: mediakvot, verklig offert, enhetliga belopp och durabel
refund/idempotens.

### Referenser

- [Directus](https://github.com/directus/directus): mediemetadata,
  lagringsadapter, varianter och kontrollerad radering.
- [ERPNext quotation](https://docs.frappe.io/erpnext/quotation): fryst skickad
  offert, giltighet och spårbar orderkonvertering.
- [Medusa](https://github.com/medusajs/medusa): reservationer, kompenserande
  commerce-workflows och separata betal-/refundposter.
- [Saleor](https://github.com/saleor/saleor): serverägd checkout,
  prisfrysning, stock reservation, transaktioner och explicit refundstatus.
- [Odoo website_sale](https://github.com/odoo/odoo/tree/19.0/addons/website_sale):
  checkout, sale-order och payment-övergångar.

Graphify-jämförelsen mot `reference-saleor-commerce` och
`reference-odoo-modules` visar att Corevos `shop_orders`,
`shop_order_items`, `shop_products`, `shop_product_variants`, `payments`,
`media_assets` och refund/outbox är rätt ankare.

## Belagda gap

### Media

- Deklarerad kvot verkställs inte concurrency-säkert.
- Upload kan lämna R2-orphan om DB-finalize misslyckas.
- Delete tar DB först och fysisk lagring best-effort.
- Hashdedupe saknar hård tenantunikhet.
- Publik exponering och standardiserade varianter behöver ett tydligt kontrakt.

### Offert

- `offert_requests` är intake, inte en versionsfryst offert.
- Rader, skatt, valuta, giltighet, kundtoken och orderkonvertering saknas.
- App-FSM är inte DB-verkställd och uppdateringar saknar compare-and-set.
- Skickad status kan bli falsk om leverans misslyckas.

### Webshop

- Klienttoken är åtkomstbevis men inte reserve-idempotens.
- Blandade valutor kan passera och provider är delvis hårdkodad till SEK.
- Provider-rader kan avvika från orderns skatt/rabatt/total.
- Direkt refund kan rapportera framgång trots providerfel.
- Refund saknar separat pending/succeeded/failed-post och replaybar inbox.
- Statusövergångar saknar konsekvent append-only audit.

## Arkitekturbeslut

### Media

Inför `pending → ready → deleting → deleted|delete_failed`.
`reserve_media_upload` låser tenantens användning, räknar pending+ready,
verkställer kvot och skapar reserverad rad. Finalize och delete är idempotenta
och retrybara. Endast `ready` och uttryckligen publicerade assets exponeras.

Tre fasta variantspecifikationer räcker: `thumb`, `card`, `hero`. Originalbytes
räknas mot kvoten. Ingen fri transformations-API byggs.

### Offert

Behåll `offert_requests` som Goal 92:s produkt. Lås intake, tenant, rate limit,
DB-verkställd statusövergång, compare-and-set, audit och verkligt
leveransutfall. En status får inte bli `quoted` om leveransen inte är durabelt
registrerad som skickad.

Ett separat offertaggregat med rader, versioner, kundacceptans och
orderkonvertering är en forskningsrekommendation som kräver separat
produktbeslut. Det ingår inte i Goal 92.

### Webshop

- Behåll reservation/commit-modellen.
- Lägg unik request-idempotens på orderreservation.
- Goal 92 är konsekvent SEK-only; blandad/annan valuta avvisas tills ett
  separat multi-currency-mål beslutas.
- En serverfunktion äger subtotal, rabatt, skatt, frakt och total.
- Providerrequest måste summera exakt till ordersnapshotten.
- Webshoprefund använder befintlig refund-outbox och visar inte success före
  `succeeded`.
- Fulfillment och paymentstatus hålls ortogonala.

## Genomförandeplan

### Task 1 — media lifecycle

Ny migration, SQL concurrency/RLS och små serverändringar i
`apps/web/lib/admin/media/`. Återanvänd befintligt R2-lager. Lägg retryjobb i
befintligt scheduler-/outboxmönster, inte en ny köplattform.

### Task 2 — befintligt offertintake

Hårda befintliga offertmappar och `offert_requests`: atomisk FSM,
compare-and-set, audit, delivery pending/sent/failed och ärliga UI-utfall.

### Task 3 — order- och betalningssanning

Utöka befintliga webshop-RPC:er och `app/butik/actions.ts`. En gemensam
ordersnapshot används för Stripe/PayPal. Lägg reserve-idempotens,
webhook-inbox/audit och refund-outboxstatus utan att ersätta providerspåren.

### Task 4 — acceptans

Kör concurrency, RLS, amount parity, webhook retry, refund failure,
admin→storefront och live payment sandbox där releaseplanen tillåter.

## Medvetet utanför Goal 92

- generell DAM eller fria bildtransformationer;
- ERP-redovisning och automatisk offertprissättning;
- separat offertaggregat, rader, versioner och automatisk orderkonvertering;
- serverlagrad synkad kundkorg;
- full multi-currency;
- delleverans/RMA om inget separat produktkrav beslutas;
- nytt workflow- eller commerce-ramverk.

## Bedömda förbättringar

| Förbättring | Grafstöd | Aktivera när |
|---|---|---|
| full offert med rader/version/orderkonvertering | ERPNext/Odoo skiljer request, fryst quotation och downstream order | Corevo beslutar att “offert” ska vara ett kommersiellt dokument, inte bara intake/svar |
| fler medievarianter/focal point | Directus separerar original, metadata och bounded transforms | de tre fasta varianterna inte räcker i verkliga mallar |
| full multi-currency | Saleor modellerar kanal/valuta genom hela checkouten | första tenant utanför SEK beslutas |
| generell kompensationsworkflow | Medusa visar steg + compensation | minst tre Corevo-flöden har samma mätbara rollbackproblem |

Medusas modulramverk och Saleors multi-channel-plattform kopieras inte. Corevos
befintliga order-, payment- och refundprimitives är fortsatt ägare.

## Exakta implementation units

| Enhet | Befintlig fil | Nytt bevis |
|---|---|---|
| media lifecycle | `apps/web/lib/admin/media/actions.ts`, `media_assets`-migrationer | `supabase/tests/goal92_media_quota.sql` |
| offertintake | `apps/web/lib/storefront/offert/intake.ts`, `apps/web/lib/admin/offert/` | `supabase/tests/goal92_offert_fsm.sql` |
| order/payment | `apps/web/app/butik/actions.ts`, Stripe-/PayPal-webhooks | riktade amount/idempotency-integrationstester |
| refund | befintlig refund-outbox och adminactions | test för pending/failed/retry |
| end-to-end | befintliga media/offert/webshop-routes | `e2e/acceptans/goal92-commerce.accept.spec.ts` |

Verifiering från `5-Kod`: projektets SQL-testkommando, `pnpm test`,
`pnpm typecheck`, `pnpm lint`, `pnpm build` och det nya acceptansprobet.
