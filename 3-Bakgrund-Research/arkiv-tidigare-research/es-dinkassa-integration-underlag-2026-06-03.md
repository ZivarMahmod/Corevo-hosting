# ES Kassasystem / Dinkassa.se — integrationsunderlag
Datum: 2026-06-03 · Källa: eskassa.se/developer (Dinkassa.se REST API). Kontakt: api@eskassa.se · nyckelreg: eskassa.se/apiregistration.

> Syfte: så att en bokning + betalning kan flöda hela vägen ner i salongens befintliga **ES-kassa** (inkl. kontrollenhet) via deras weborder/PreSaleTransaction.
>
> ⛔ **VIKTIGT — blanda ALDRIG ES och Stripe.** De är två SEPARATA, ömsesidigt uteslutande betalvägar, EN per salong:
> - **Stripe-vägen** = salong UTAN kassasystem (t.ex. ambulerande klippare). Enkelt, snabbt — Stripe tar pengarna, klart.
> - **ES-vägen** = salong som HAR ES-kassa (t.ex. FreshCut). Hela vägen genom ES med kontrollenhet.
> Aldrig en kedja "betala med ES → Stripe → ES-kassan". En salong → en väg.
>
> Detta är **pluggbar provider-arkitektur** (se eget block nedan): ES är inte ett "tillägg till Stripe" utan en JÄMBÖRDIG väg. Framtida providers (t.ex. SmartCash) = bara "ny väg in", inget ombygge.
> ✅ **DJUP-version finns: `es-dinkassa-DJUP-2026-06-03.md`** (Zivars research-chat) — den fyllde luckorna (Session/RequestKey/Errors), bekräftade arkitekturen och gav en konkret bygg-plan. Läs den för detaljer; nedan + detta block är sammanfattningen.

## ⭐ Det djup-researchen avgjorde (läs detta)
- **Öppna frågorna är i stort lösta:** Auth = 3 headers (Session behövs ej för server-till-server). `requestKey` 409 = "redan lyckad" → **behandla 409 som success**. Komplett felkodstabell finns. **Inga webhooks** (bekräftat) → polla `/api/transaction` (7d). Kassaregister-skyldigheten ligger på **salongen** (deras certifierade register + kontrollenhet), INTE på Corevo.
- **🔑 EN VERKLIG DESIGN-FRÅGA (matchar din "blanda inte"-poäng):** DinKassa-API:t tar ALDRIG betalning — något måste samla pengarna först, sen *registreras* ordern i kassan. Det ger två sätt att köra ES-vägen:
  - **(A) ES Order (renast, = din "ES hela vägen"):** kunden betalar via ES egna rails (Swedbank Pay kort+Swish, eller salongens Swish Handel) → auto-push till registret. Ingen Stripe alls för ES-salonger.
  - **(B) Stripe samlar → vi pushar betald order till ES-registret (WebShop 18):** tekniskt möjligt men det ÄR den "blandning" du ville undvika.
  → **Din linje pekar på (A)** för ES-salonger. **Stage-0-fråga till ES:** vill de att vi bäddar in **ES Order** (A) eller bygger direkt på API:t (B)? Om de kräver ES Order för webbetalning → kör (A). *(Detta avgör om `provider=eskassa` betyder "ES samlar+registrerar" eller "Stripe samlar, ES registrerar".)*
- **Bygg-arkitektur (från djup-researchen, när vi bygger):** alla DinKassa-anrop **server-only** (Worker/Route Handler, ALDRIG browser/Server Action) → betalnings-webhook **enqueuear** job till **Cloudflare Queues** (+ DLQ) → consumer pushar PreSaleTransaction med **idempotent `requestKey` per order** → **reconciliation-cron** pollar Transactions och flippar status. Per-salong `{MachineId, MachineKey}` i **Supabase Vault** (via service-role-RPC), globalt `IntegratorId` som Cloudflare-secret.
- **Compliance-nytt:** ångerknappen = **SFS 2026:246 / prop 2025/26:84**, gäller **19 juni 2026** (bekräftat). Från **1 jan 2027**: SKVFS-krav på XML-export av kontrolldata (salongens register — verifiera vid onboarding). Certifierat register krävs när kontant/kort/Swish > **236 800 kr** (4 prisbasbelopp 2026) — salongens sak, inte vår.

## Modellen i ett nötskal
- API:t pratar med ES **molntjänst** (`https://www.dinkassa.se/api/`), aldrig direkt med kassamaskinen. Maskinen **synkar** mot molnet: **Pro+ ~var 2:e min**, **Pro ~var 30:e min**. → "skickad till kassa" ≠ "kvitterad av kassa". Designa för fördröjning, inte realtid.
- Två objekt: **`PreSaleTransaction`** = ordern/webordern DU skapar (= "ES order"). **`Transaction`** = det slutförda kvittot som POS:en genererar (read-only). Vid finalize raderas PreSale → Transaction skapas.

## Auth
- Tre custom-headers per request: **`MachineId`** (vilken salong/terminal), **`MachineKey`** (hemlig, per maskin), **`IntegratorId`** (identifierar oss som integratör). 
- **Multi-tenant-vänligt:** ETT `IntegratorId` för Corevo + ett par `(MachineId, MachineKey)` per salong. → vi behöver en säker per-salong-nyckelhantering (Worker-secret/DB-krypterat).
- Nycklar fås via apiregistration + kontakt med ES (ingen self-service-dashboard beskriven).
- ⚠️ Intron säger "basic auth", exemplen använder de tre headerna — **oklart** (öppen fråga). Ingen sandbox-miljö nämnd (öppen fråga).

## "ES order" = PreSaleTransaction (kärnan)
Skapas av oss. Viktiga fält:
- `State`: **1 = redigerbar (skapa med denna)**, **2 = submitted/låst**, 0 = skapad i POS (rör ej).
- `EmployeeId` (krävs, måste matcha `/api/employee`), `ExternalReference1` (≤30 tecken — lägg vårt boknings-/Stripe-id), `TransactionName` (≤50, syns på kvitto), `ExternalOrderContactInfo` (≤250, syns på bong — tel/tid).
- `Items[]`: varje rad kräver giltig **`InventoryItemId`** (tjänsten måste finnas som produkt i kassan) + Quantity + pris. VAT styrs av produkten (0/6/12/25 — salongstjänst normalt 25%), kan ej sättas via API.
- `Payments[]`: i ES-vägen → om online-betalt via ES egen väg: **EN** payment **`Type: 18 (WebShop)`**, belopp = summan av Items, `ExternalReference1` = ES-vägens egen betalreferens (**INTE Stripe** — Stripe är en separat väg). WebShop får ej blandas med annan typ; summan MÅSTE matcha radtotalerna exakt (öresavrundning = risk). Lämna `Payments` tomt om kunden betalar på plats vid kassan.

## Flödet: bokning → ES-kassa (ES-VÄGEN — ingen Stripe här)
Engångs/sync: salongens tjänster finns som **InventoryItem** (+ minst en Category), giltig **EmployeeId** finns.
1. Kund bokar tjänst i Corevo.
2. Mappa tjänst → `InventoryItemId` (skapa via API om saknas).
3. `POST /api/presaletransaction?requestKey=<unikt GUID>` — State 1, EmployeeId, Items[], ExternalReference1 = bokningsnr, TransactionName = kund, ExternalOrderContactInfo = tel/tid.
4. **Betalning i ES-vägen (öppen fråga, se §9):** antingen på plats vid ES-kassan (`Payments` tomt eller Cash/Card vid POS) ELLER online via ES egen betalväg (`Payments` Type 18 WebShop). **Ingen Stripe.**
5. `POST /api/presaletransaction/{id}` body `submit=true` → State 2 (låst, överlämnad till POS).
6. POS synkar → bong/kvitto via **kontrollenhet** + `Transaction` skapas på maskinen.
7. (Avstämning, valfritt) polla `GET /api/transaction?startDateTime=&endDateTime=` (max **7 dagars** fönster).
- `requestKey` (GUID) på varje create = idempotens, undvik dubbelorder.

## Endpoints (kondenserat)
| Syfte | Metod + path |
|---|---|
| Skapa order | `POST /api/presaletransaction?requestKey=<GUID>` |
| Uppdatera (om State 1) | `PUT /api/presaletransaction` |
| Submit (→State 2) | `POST /api/presaletransaction/{id}` (`submit=true`, urlencoded) |
| Hämta/sök order | `GET /api/presaletransaction` |
| Radera | `DELETE /api/presaletransaction/{id}` |
| Produkter | `GET/POST /api/inventoryitem` |
| Kategorier | `GET/POST /api/category` |
| Anställda | `GET /api/employee` |
| Slutförda kvitton (7d) | `GET /api/transaction?startDateTime=&endDateTime=` |

## Provider-arkitektur: EN betalväg per salong (pluggbar) — bärande principen
Varför detta är viktigt: så att nästa kassa/PSP (SmartCash m.fl.) blir "ny väg in", inte "samma problem igen".
- `tenant_settings.payment_provider` = `stripe` | `eskassa` | framtida `smartcash` … **EN per salong**, vald vid onboarding utifrån vad salongen HAR.
- Bokningskärnan anropar en **gemensam provider-adapter** (t.ex. `createOrder()/confirm()/registerSale()`) — den känner bara gränssnittet, inte vilken provider.
- Varje provider = en adapter som kör **end-to-end**:
  - `stripe` → Direct charge, klart (salong UTAN kassa / ambulerande klippare). Swish via Stripe.
  - `eskassa` → PreSaleTransaction → submit → POS/kontrollenhet (salong MED ES).
  - `smartcash`/andra → ny adapter → dyker upp som val. **Inget ombygge av bokningskärnan.**
- **Aldrig två i kedja.** En salong → en väg, hela vägen.
ES är inte en PSP som drar kort online — i ES-vägen sker betalning på plats vid kassan eller via ES egen online-väg (öppen fråga §9). Stripe rörs inte av detta; det är sin egen väg.

## Gotchas (arkitekturpåverkande)
- **Sync-fördröjning** (2–30 min) → eventuell/asynkron leverans till fysisk kassa; POS kan vara offline.
- **Produkter/employees måste pre-existera** → sync-/mappnings-strategi tjänst↔InventoryItem + EmployeeId per salong.
- **State 2 = låst** (ingen ändra/radera; korrigering = ny order).
- **Inga webhooks dokumenterade** → bekräftelse = polling av `/api/transaction` (7d-fönster). Hur man kopplar submitad PreSale → resulterande Transaction-Id är oklart.
- **Onboarding:** integration gratis för oss, men **kassakunden betalar extra avgift** för extern koppling (avtal med ES).
- **VAT styrs av kassan** (produkten), 0/6/12/25.
- **`EmployeeId`/`EmployeeCode`** i ES vs vårt `staff`/`staff_id` — håll mappningen ren.

## Öppna frågor (Zivars djup-research med ES)
1. Auth exakt: tre headers vs HTTP Basic? Hur skickas MachineKey?
2. Testmiljö/sandbox eller direkt mot prod?
3. Saknade docs-sektioner: **Session / Create New Order** (alternativt order-flöde?), **RequestKey** (format/semantik), **Errors** (felkoder/retry).
4. Finns verkligen inga webhooks? Hur kopplas PreSale (State 2) → Transaction-Id för avstämning?
5. Multi-tenant: ett IntegratorId + (MachineId, MachineKey) per salong — hur distribueras/roteras MachineKey säkert?
6. Kvitto/kontrollenhet: ger weborder→submit ett juridiskt giltigt kvitto via salongens kontrollenhet automatiskt? (Kopplar till kassaregisterlagen-frågan.)
7. Öresavrundning så WebShop-payment alltid matchar radsumman?
8. Rate limits / versionering / SLA?
9. Hur modelleras en **tjänst** (ingen lagerhållning) bäst som InventoryItem?

## Status
Underlag, research-stadie. När arkitekturen firmar upp (efter Zivars djup-research + ES egna docs) → flytta beslut till `1-Planering/` och gör ett eget bygg-kort. **Stripe orört; ES = parallellt tillägg.**
