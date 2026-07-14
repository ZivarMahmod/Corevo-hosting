# DinKassa.se / ES Order Integration Report — Embedding ES Order into a Multi-Tenant Frisör Booking Platform

## TL;DR
- The DinKassa.se REST API (base `https://www.dinkassa.se/api/`, docs at `https://eskassa.se/developer/`) lets you push an order into a salon's existing ES Kassasystem register by POSTing a **PreSaleTransaction** ("ES Order") authenticated with three per-machine headers — `MachineId`, `MachineKey`, `IntegratorId`. There is no OAuth, no order-level webhook, and no payment processing in the API itself: you collect payment yourself (Stripe/Swish), then push an already-paid order with payment `Type: 18` (WebShop), and the cloud replicates it to the physical register on its next sync.
- For your stack: run all DinKassa calls **server-side only** (Cloudflare Worker / Next.js Route Handler), make them **asynchronous with a durable queue + idempotent `requestKey` GUID per order**, and store each tenant's `MachineId`/`MachineKey` encrypted (Supabase Vault or Cloudflare Secrets Store). Never call DinKassa from the browser or a Server Action triggered directly by the payment UI.
- Swedish compliance: because the **certified kassaregister + kontrollenhet ("svarta lådan") belong to the salon** and the transaction is booked there, the salon — not you (Corevo) — remains the kassaregister-obligated party. Online-only sales where payment happens on the web are generally treated as *distanshandel/e-handel* and fall outside kassaregisterlagen, but the moment the order books into the salon's register it produces a compliant receipt anyway. You must still handle distansavtalslagen information/ångerrätt duties on the storefront.

## Key Findings

### 1. Authentication — per-machine header credentials, no OAuth
Authentication uses **three HTTP headers on every request** (HTTP Basic-style, but custom headers, not an `Authorization` header):

| Header | Meaning |
|---|---|
| `MachineId` | Identifies which cash register (machine) the API reads/writes. GUID. |
| `MachineKey` | The secret key unique to that MachineId. |
| `IntegratorId` | Identifies you, the integrator. One IntegratorId can manage many machines. |

- **Scoping is per-machine (per register), not per "account".** Each salon register = one `MachineId` + its own `MachineKey`. Your single `IntegratorId` is reused across all salons. This is explicitly stated: "The same integrator can manage multiple machines."
- **Multi-tenant model:** you (Corevo) register once for an `IntegratorId` via `https://www.eskassa.se/apiregistration`; each salon's register supplies its own `MachineId`/`MachineKey`. So per-tenant you store `{MachineId, MachineKey}`; the `IntegratorId` is a global app-level secret.
- There is also an optional **Session** mechanism (12-hour, single-use SessionKey extracted from the POS, exchanged for a `SessionId` GUID) used for limited-access on-site apps like the WaiterApp. Flow: `POST /api/Session?employeeId=…&MachineId=…` returns a 12-digit SessionKey → `POST /api/Session` with that key in the body returns a `SessionId` GUID + `ExpiresDateTime` → subsequent calls send headers `SessionId` + `IntegratorId` instead of the machine headers. For a server-to-server webshop integration you do **not** need Session — use the machine headers. The docs say "Please consult the ES Kassasystem API-team before implementing the Session-functionality."
- Customers of the POS "pay an additional fee for connecting an external system to the API"; integration itself is free for integrators.

### 2. Order creation — the "ES Order" is a `PreSaleTransaction`
- **Endpoint:** `POST https://www.dinkassa.se/api/presaletransaction?requestKey={GUID}`
- A PreSaleTransaction "represents an order/shopping cart before the sale is finalized. When a sale is finalized the PreSaleTransaction is deleted and a Transaction is created." Creating one "is directly connected to the WEBORDER-system within ES Kassasystem."
- **Required/key fields in the request body (`Item`):**
  - `EmployeeId` — must match an existing Employee in that register (fetch via `/api/employee`).
  - `State` — `1` = Not submitted (editable); `2` = Submitted (locked). Web orders are typically created at `State: 1` then submitted, or created and submitted. (A `State: 4` example also appears for parked table orders; states "3+ = For internal use".)
  - `Items[]` — each line needs `InventoryItemId` (must match an existing InventoryItem), `Quantity`, and optionally `PricePerItemIncludingVat` (defaults to the item's price), `ExtraInformation`, `IsTakeAway`.
  - `Payments[]` — each payment has `Type` and `Amount`/`TotalAmount`.
  - Optional: `ExternalReference1` (your order number, max 30 chars), `TransactionName` (printed on receipt, max 50), `ExternalOrderContactInfo` (printed on kitchen ticket, e.g. phone, max 250), `IsTakeAway`/`IsDelivery`/`IsCurbside`, `ParkingId` (table).
- Constraint: a WebShop payment "can not be combined with a different Type. The total amount paid must also match the total cost of InventoryItems."
- VAT (`VatPercentage`) is read-only on line items — it is pulled automatically from the InventoryItem and cannot be set via API. Accepted values 0, 6, 12, 25.
- **Submit step:** `POST /api/presaletransaction/{id}` with `submit=true` (x-www-form-urlencoded) moves it to `State: 2`; after that it cannot be changed or deleted (delete attempt returns 400).

### 3. Payment flow — you collect payment, then push a paid order
- **The DinKassa API does not process payments.** It records a payment line on the order. Payment types: `Cash = 1`, `Card = 2`, `Coupon = 3`, `BankAccount = 7`, `WebShop = 18`.
- The docs are explicit: **"If the integration revolves around sending food orders to the POS; use Webshop = 18 at all times."** Use `Type: 18` for online-paid orders.
- This matches how ES's own product, **ES Order**, works: the customer "pays directly online with Swish or card," then "the order is sent automatically to your cash register," a bong (ticket) prints, and "with one press the order is finalized, a final bookable receipt is printed." ES Order's own payment rails are Swedbank Pay (card + Swish) under Erpato Europe's acquiring agreement, or the salon's own Swish Handel agreement.
- So your flow: **collect via Stripe/Swish on your storefront → on confirmed payment, push a PreSaleTransaction with a single `WebShop` payment whose amount equals the order total.** You can also leave `Payments` empty if the customer is to pay in store ("For a customer that pre-orders online and pays in the store payments would remain empty").

### 4. Order → cash register — async cloud replication, not direct
- **The API never talks to the register directly.** "All data read or written through the API gets staged in the ES Kassasystem servers, the data is then replicated to/from the POS machine the next time it connects."
- "Changes made with the API will commit instantly to the cloud." Sync timing: **dinkassa.se Pro+ syncs every ~2 minutes, or immediately following a sale; dinkassa.se Pro syncs every 30 minutes.** It works even if the POS is off — changes sync when it restarts.
- Practical implication: order delivery to the physical register is **eventually consistent** (seconds to ~30 min depending on the salon's plan). Your UX must not promise instant in-store appearance; the salon's plan tier matters.

### 5. Product / price / inventory reads — yes, fully
- **Read catalog:** `GET /api/inventoryitem` (search: `descriptionContains`, `barCodeContains`, `productCodeContains`, `categoryId`, `VisibleOnSalesMenu`, `offset`, `fetch` 1–200). Returns `Description`, `PriceIncludingVat`, `PickupPriceIncludingVat`, `VatPercentage`, `QuantityInStockCurrent`, `CategoryId/Name`, `Id`, barcodes.
- **Categories:** `GET /api/category`. At least one category must exist before items can. **MultiPriceList/MultiPriceItem** support tiered pricing (e.g., dine-in vs take-away columns).
- **Stock:** `QuantityInStockCurrent` on each item; dedicated idempotent stock change endpoint `POST /api/inventoryitem/{id}` with `currentQuantity`/`newQuantity`.
- **Settings:** `GET /api/settings` returns the global `Unit`.
- For a salon storefront you would read InventoryItems + Categories to render the assortment/prices, then reference items by `InventoryItemId` when creating the order.

### 6. Webhooks / status callbacks — NONE
- **There is no webhook or push callback** anywhere in the API. Confirmation is **poll-based**:
  - `GET /api/presaletransaction` (filter by `state`) to see if your order is still pending/submitted.
  - `GET /api/transaction?startDateTime=&endDateTime=` to confirm a finalized sale became a **Transaction** (a receipt). Transactions are only fetchable for **7 days** back.
- So "did the order reach the register and get rung up?" is answered by polling Transactions and matching on your `ExternalReference1` / `TransactionName`. This is a significant design constraint.

### 7. Rate limits, idempotency & error codes
- **Idempotency via `requestKey`:** the API "support[s] idempotent requests for all API methods" via a `requestKey` GUID query param. Generate a **new GUID per logical order**; safe to retry with the **same** GUID. If already processed, you get **409** and know the prior request succeeded. "A previously used GUID/UUID can never be used again and will immediately return 409." The docs stress: "If the API would respond with **504** but still accept the request, a possible re-request [with the same requestKey] would not result in several orders being created."
- **No explicit published numeric rate-limit/quota** in the docs. `429 Too Many Requests` is a defined error code, and pagination is capped (`fetch` max 100–200 depending on resource). Transaction history limited to 7 days "to not overload the API."
- **Error codes (verbatim from the docs):**

| Code | Meaning |
|---|---|
| 400 | Bad Request — Your request is invalid. |
| 401 | Unauthorized |
| 403 | Forbidden — request hidden for administrators only (also: auth failure / invalid credentials). |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 406 | Not Acceptable — you requested a non-JSON format. |
| 409 | RequestKey already received (or not a valid GUID) — previous request already succeeded. |
| 410 | Gone |
| 429 | Too Many Requests |
| 500 | Internal Server Error — try again later. |
| 503 | Service Unavailable — temporarily offline for maintenance. |

  Note: `200` = success (e.g., successful DELETE); `504` is referenced only in the requestKey note, not in the error table. Unknown errors → email api@eskassa.se.

### 8. Data model
```
Integrator (you)
  └─ Machine (per salon register: MachineId + MachineKey)
       ├─ Category ──< InventoryItem (articles/products, price, VAT, stock)
       │                 └─ MultiPriceList / MultiPriceItem (tiered prices)
       ├─ Employee (orders must reference a valid EmployeeId)
       ├─ BongCategory / DictionaryWord / TableMap (kitchen/table; restaurant-centric)
       ├─ PreSaleTransaction (the "ES Order")  ──< PreSaleTransactionItem
       │         └─ PreSaleTransactionPayment (Type 18 = WebShop)
       │              (on finalize, PreSaleTransaction is deleted →)
       └─ Transaction (finalized receipt) ──< TransactionItem / TransactionPayment
```
The lifecycle: **PreSaleTransaction (order) → finalized in POS → becomes a Transaction (receipt).**

### 9. Receipts / kontrollenhet — handled by the salon's ES register
- DinKassa/ES Kassasystem is a Skatteverket-compliant certified register; the **kontrollenhet (the certified "svarta lådan" / control unit) and the bookable receipt belong to the salon's installed ES Kassasystem.** Once the order books as a Transaction, the register prints "a final bookable receipt" and the control unit signs it. Dinkassa.se also exposes Z-reports, receipt copies, and SIE files.
- Pending regulatory change: **from 1 January 2027, Skatteverket föreskrifter SKVFS 2021:17 and SKVFS 2021:18 require kassaregister to export control data in a standardised XML format** — verify the salon's ES register complies during onboarding (Erpato should be handling this for ES Kassasystem, but confirm).
- **This is the crux for Corevo:** you are an order-forwarding layer, not the register. The certified register and control unit are the salon's. Therefore the kassaregister obligation sits with the salon (the seller/näringsidkare), not with Corevo.

## Details — Mapping to Your Next.js 15 / Supabase / Cloudflare / Multi-Tenant Stack

### Where DinKassa calls should live
- **Server-only, never client.** DinKassa credentials are long-lived secrets; the API is plain header auth over HTTPS with no browser CORS story. All calls must run in a trusted server context.
- **Route Handlers / Worker fetch handlers, not Server Actions, for the order-push path.** Industry consensus (MakerKit, Stanza, Vercel community): Server Actions are for UI-coupled mutations; Route Handlers/Workers are for external integrations, webhooks, and anything needing precise HTTP control and idempotency. Your payment webhook (Stripe/Swish) → Route Handler is the canonical pattern.
- **Recommended topology on OpenNext/Cloudflare:**
  1. **Stripe/Swish payment webhook → Cloudflare Worker / Next.js Route Handler.** Verify signature, read raw body, idempotency-check the event ID.
  2. Handler **enqueues** a "push order to DinKassa" job to **Cloudflare Queues** (don't call DinKassa inline — the webhook must return 2xx fast).
  3. **Queue consumer Worker** loads the tenant's DinKassa creds, POSTs the PreSaleTransaction with a per-order `requestKey`, handles retries/backoff, and writes status back to Supabase.
- Catalog reads (products/prices) can be done in **Server Components / cached Route Handlers** (e.g. `Cache-Control: s-maxage`) since they're non-sensitive reads; cache them per tenant to avoid hammering the API.

### Securely storing per-tenant DinKassa credentials
Two viable patterns:
- **Cloudflare Secrets Store (account-level) / Worker Secrets** — per Cloudflare's docs, the Secrets Store is "a secure, centralized location in which account-level secrets are stored… securely encrypted and stored across all Cloudflare data centers"; Cloudflare's storage layer encrypts objects "using AES-256… GCM (Galois/Counter Mode) as its preferred mode." Secrets are write-only and decrypted only in the Worker runtime. Good for the global `IntegratorId`. Per-tenant `MachineKey` in per-Worker secrets is awkward at scale (secrets are per-Worker and require redeploy to change).
- **Supabase Vault (recommended for per-tenant `MachineId`/`MachineKey`)** — per Supabase's docs, Vault stores secrets "using Authenticated Encryption with Associated Data… based on libsodium," with keys "managed in our secured backend systems… separate from your data." Store via `vault.create_secret`, read only through `SECURITY DEFINER` RPCs granted to `service_role`. This fits your existing Supabase + RLS + SECURITY DEFINER RPC pattern exactly: a `tenant_dinkassa_credentials` flow where the Worker calls an RPC with the service role key to fetch decrypted creds at request time. Backups/replicas stay encrypted. Caveat: Supabase "DOES NOT RECOMMEND any new usage of pgsodium" (pending deprecation), but states "The Vault extension won't be impacted… interface and API will remain unchanged," so the Vault interface is safe to build on.
- **Recommendation:** `IntegratorId` → Cloudflare Secret (global). Per-tenant `{MachineId, MachineKey}` → Supabase Vault, fetched via a service-role RPC inside the queue consumer. Enable RLS on the mapping table; never expose creds to the anon/publishable key or the browser.

### Mapping DinKassa ↔ Supabase data model
- `tenants` (salon) → add `dinkassa_machine_id`, `dinkassa_vault_secret_id`, `dinkassa_plan` (Pro vs Pro+, drives sync-latency UX), `dinkassa_default_employee_id`.
- `products` ← mirror of `InventoryItem` keyed by `dinkassa_inventory_item_id` (+ price, vat, category, stock snapshot). Treat DinKassa as source of truth; sync on a schedule (Cron Worker) and/or cache reads. Store `last_synced_at`.
- `orders` → your canonical order; add `dinkassa_request_key` (UUID, unique), `dinkassa_presale_transaction_id`, `dinkassa_transaction_number` (filled after polling), `dinkassa_state`, `push_status` (pending/sent/confirmed/failed), `attempts`.
- `order_items` → carry `dinkassa_inventory_item_id`, `quantity`, `price_incl_vat`.
- Reconciliation job: poll `/api/transaction` (7-day window) to flip `push_status` → `confirmed` once the order appears as a finalized Transaction.

### Sync vs async, failure handling
- **Async, queued, with retries — not synchronous.** A customer who has already paid must never be blocked on or lost due to a DinKassa hiccup. Pattern:
  - Payment success is the **system of record for "customer paid."** Recording the order in Supabase + enqueuing the push must happen atomically relative to the payment webhook.
  - **Cloudflare Queues** gives automatic retries — per Cloudflare's docs, "the default behaviour is to retry delivery three times… You can set max_retries (defaults to 3)," and messages exceeding `max_retries` are "written to the DLQ instead" (dead-letter queue retention is 4 days without a consumer). Use per-message `ack()`/`retry()` so one failure doesn't reprocess the batch (important because order creation is state-changing).
  - On repeated failure → DLQ + alert; the order sits in Supabase as `push_status: failed` for manual replay. The salon can also be notified. Consider **Cloudflare Workflows** if you want durable multi-step orchestration (push → poll-confirm → mark) with built-in retry/state.
- **Reconciliation worker (Cron):** for any order `sent` but not `confirmed` within N minutes (tuned to the tenant's Pro/Pro+ sync window), poll Transactions; escalate if still missing.

### Idempotency (no duplicate orders in the register)
- Generate **one `requestKey` GUID per order**, persist it on the `orders` row **before** the first push, and reuse that same GUID on every retry. The API guarantees a reused key returns 409 (prior request succeeded) rather than creating a duplicate — exactly the property you need for at-least-once queue delivery. Treat **409 as success** in your consumer.
- Also dedupe the upstream payment webhook by event ID (Stripe/Swish retries aggressively).

## Recommendations (staged)

**Stage 0 — Confirm with DinKassa/Erpato (blocking unknowns).** Email api@eskassa.se to confirm: (a) onboarding/credential-provisioning flow for many salons (how each salon's `MachineId`/`MachineKey` is issued to you and the customer's "external system" fee); (b) whether a salon on **Pro (30-min sync)** is acceptable for your UX or whether **Pro+** is required; (c) exact `State` value to use for a paid web order that should auto-finalize into a receipt vs. stay as a parked pre-order (docs show `State` 1, 2, and 4 in different examples); (d) any undocumented rate limits; (e) whether ES would rather you resell/embed **ES Order** itself vs. building directly on the API. *Benchmark to change plan:* if Erpato mandates ES Order for web payments, pivot to embedding ES Order rather than a custom build.

**Stage 1 — Single-tenant pilot.** One salon, hard-coded creds in a Worker secret. Implement: catalog read → render storefront → Stripe (or Swish Handel) payment → Route Handler webhook → direct PreSaleTransaction push with `requestKey` and `WebShop` payment → poll Transactions to confirm. Validate end-to-end latency against that salon's sync tier.

**Stage 2 — Make it durable & multi-tenant.** Move credential storage to Supabase Vault (per-tenant) + Cloudflare Secret (IntegratorId). Insert Cloudflare Queues + DLQ between webhook and push. Add the reconciliation Cron worker and `push_status` state machine. Add idempotency keys end to end.

**Stage 3 — Harden & scale.** Per-tenant catalog sync (Cron), caching of reads, alerting on DLQ, admin replay UI for failed pushes, observability (log every DinKassa status code). Consider Workflows for orchestration if order volume/complexity grows.

**Compliance actions:** Put clear pre-contract info + ångerrätt handling on the storefront. Note the imminent change: **Riksdagen passed prop. 2025/26:84 "Ett stärkt konsumentskydd vid distansavtal" on 11 March 2026 (SFS 2026:246), adding distansavtalslagen 2 kap. 10 a § requiring a dedicated cancellation button ("ångerknapp") from 19 June 2026**; non-compliance "riskerar att bedömas som otillbörlig marknadsföring" under marknadsföringslagen. Document that the certified register/kontrollenhet is the salon's. For each salon, confirm the salon's ES register is registered with Skatteverket (their duty, but verify during onboarding).

## Caveats & Confidence

- **High confidence (directly from official docs):** authentication headers and per-machine scoping; PreSaleTransaction as the order resource and its fields; payment Type 18/WebShop; cloud-replication sync model and 2-min/30-min timings; absence of webhooks; `requestKey` idempotency and the verbatim error table; product/category/transaction read endpoints; 7-day Transaction window; Session mechanics.
- **Medium confidence / verify with DinKassa:** the correct `State` for an auto-finalizing paid web order (examples show 1, 2, and 4 — `4` appears in a parked table-order example; the docs note states "3+ = For internal use"). Whether an online-paid PreSaleTransaction *auto-finalizes* into a Transaction+receipt or requires a staff keypress in the POS (ES Order marketing implies one keypress finalizes it). Exact rate limits. Per-salon credential provisioning workflow and fees.
- **Documentation language:** the developer reference is in **English**; the consumer-facing ES Order/ES Kassasystem marketing and the Skatteverket/legal sources are in **Swedish**. There is **no public SDK, GitHub repo, or third-party community integration** for the DinKassa API that I could find — you are effectively a first-party-style integrator and should lean on api@eskassa.se. (Note: ES's docs and product are heavily restaurant-oriented — "bong"/kitchen tickets, table maps — but the core Category/InventoryItem/PreSaleTransaction model works identically for a salon selling services and hair products; map salon services and retail products to InventoryItems.)
- **Swedish compliance (medium-high confidence, not legal advice):** Pure e-handel where the customer pays online is generally outside the kassaregister obligation — Skatteverket lists exempt categories including "Försäljning enligt distans- och hemförsäljningslagen. Exempel på detta är… Internetförsäljning." A certified register is otherwise required once cash/card/Swish sales exceed four prisbasbelopp = **236 800 kr for 2026 (4 × 59 200 kr)**. In your model the certified register is the salon's regardless — so Corevo is not the kassaregister-obligated party. Frisör services/products sold for in-person card/Swish/cash payment **do** require a certified register, which the salon already has. The salon retains kassaregisterlagen duties; Corevo's duties are consumer-law (distansavtalslagen information + ångerrätt) and data/PCI handling for the payment step. Confirm with a Swedish tax/legal advisor before launch, especially the boundary between "paid online (distans)" and "books into the salon's register."