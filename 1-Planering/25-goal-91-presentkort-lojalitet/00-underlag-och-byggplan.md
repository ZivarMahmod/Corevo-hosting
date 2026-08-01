# Goal 91 — presentkort och lojalitet

Datum: 2026-07-29
Status: **KODKLAR I PREVIEW** — manuella värdekommandon är verifierade; betald
issuance, leverans och refundkoppling förblir fail-closed till Goal 92.

## Forskningsslutsats

Corevo hade redan transaktionell, append-only intjäning och
utfallskorrigering för lojalitet. Det som saknades var säkra
presentkortskommandon, lojalitetsspend, exakta reverseringar, reconciliation
och handlingsspecifika gates. Två separata domäner använder nu samma små
konventioner; ingen generell walletmotor har byggts.

### Referenser

- [Saleor gift cards](https://github.com/saleor/saleor/tree/main/saleor/giftcard):
  radlåsning, saldo, expiry, events och återställning vid refund.
- [ERPNext loyalty](https://github.com/frappe/erpnext/tree/develop/erpnext/accounts/doctype/loyalty_program):
  daterade earn-lots, FIFO-förbrukning och returpåverkan.
- [Apache Fineract](https://github.com/apache/fineract): idempotenta kommandon,
  kompensation, audit och transactional events.
- [Odoo loyalty](https://github.com/odoo/odoo/tree/19.0/addons/loyalty) och
  [sale_loyalty](https://github.com/odoo/odoo/tree/19.0/addons/sale_loyalty):
  programregler och orderintegration.

Graphify-jämförelsen mot `reference-saleor-commerce` och
`reference-odoo-modules` visar att Corevo redan har rätt ankare:
`gift_cards`, `loyalty_ledger`, `loyalty_plans`, kund, order, betalning och
commerce-release. Gapet är transaktionskontraktet, inte tabellernas existens.

## Belagda gap

- Presentkort saknar ledger, inlösen, delbetalning, restore och reversal.
- `balance_cents` är ensamt muterbart sanningsfält.
- Koder genereras icke-kryptografiskt och lagras/visas i klartext.
- Retrybar manuell issuance saknar Corevo-idempotens.
- Refund av kortköp eller kortbetalad order har ingen komplett värdepolicy.
- Lojalitet saknade spend, idempotent spend-reversal och kommandometadata.
- Missad triggerintjäning behövde synliggöras av reconciliation.
- Betald klubbplan och aktivitetsbaserad status-tier blandas begreppsligt.
- Readiness och action-gates för värdeflöden saknas.

## Arkitekturbeslut

### Presentkort

Behåll `gift_cards` som instrument och lägg append-only
`gift_card_entries` med signed belopp, valuta, typ, källa, reversal-länk,
idempotency key, request-hash och aktör. Ett cachat saldo får finnas men
uppdateras atomiskt och verifieras mot ledgern.

DB-kommandon:

- issue;
- partial redeem;
- restore från exakt tidigare redemption;
- void;
- reversal/administrativ adjustment med obligatorisk orsak.

Varje kommando låser kortet och verifierar tenant, valuta, expiry, saldo och
module state. Appens manuella adminväg kräver dessutom aktiv tenant,
commerce-release och tenant-allowlist. Issue, redeem och adjustment kräver
även en separat, privat DB-release per tenant så appgrinden inte kan kringgås
med ett direkt RPC-anrop. Restore och void förblir tillgängliga som
skadebegränsning för redan utfärdat värde. Full launch-readiness innehåller
bokningskrav som inte är relevanta för dessa manuella värdekommandon.

### Kodsäkerhet

Råkoden får minst 128 bit kryptografisk entropi. Endast hash och maskerat
suffix lagras för vanlig lookup/visning. Råkoden lämnar servern vid utfärdande
och leverans, aldrig i logg eller vanlig adminrespons. Publika försök är
tenantbundna, generiska och rate-limited.

### Lojalitet

Behåll befintlig earn-modell. Lägg ett atomiskt spendkommando och append-only
spend/reversal-poster med källa, idempotency key och aktör. Kommandot låser
kundens ledgersekvens och får aldrig övertrassera.

Earn-lots, expiry/FIFO, kampanjregler och status-tiers är relevanta mönster men
kräver egna produktbeslut. Betald klubbplan får inte visas som aktiv utan
verifierad charge-, subscription- och refundrail.

## Genomförandeplan

### Del 1 — schema och kommandon — klart

Ny append-only migration skapar presentkortsledger, lojalitetsspend,
kommando-idempotens och reconciliation. Befintliga kort får opening entries som
exakt bevarar saldo. SQL-tester bevisar radlåsning, RLS och reversering.

### Del 2 — serverflöden — klart för manuella flöden

Utöka befintliga:

- `apps/web/lib/admin/presentkort/`
- `apps/web/lib/admin/lojalitet/`
- `apps/web/lib/storefront/lojalitet/`
- commerce release-gates och fail-closed legacy delivery

Actions ska anropa ett auktoritativt DB-kommando. Samma nyckel/payload ger
samma resultat; samma nyckel med annan payload avvisas.

### Del 3 — UI och leverans — klart för manuell admin

Admin visar maskerad kod, engångskod vid manuell issuance, värdehistorik,
inlösen och orsaker. Betald leverans är uttryckligen stängd till Goal 92.
Klubbmedlemskap ändrar aldrig marknadsföringssamtycke automatiskt.

### Del 4 — driftbevis — previewverifierat

Reconciliation per tenant/valuta, orphan-/dublettkontroller, atomisk value
outbox, SQL-acceptans och verkliga samtidighetsprov är verifierade i preview.
Samlad autentiserad browseracceptans görs i Goal 86.

## Medvetet utanför Goal 91

- generell wallet eller dubbel bokföringsplattform;
- fritt kampanj-DSL;
- earn-lots, poängexpiry och FIFO;
- kampanjer och status-tiers;
- Kafka eller ny generell command bus;
- bankklassad maker-checker för alla belopp;
- betald klubbnivå innan abonnemangsrail finns.

## Bedömda förbättringar

| Förbättring | Grafstöd | Aktivera när |
|---|---|---|
| earn-lots, expiry och FIFO | ERPNext kopplar spend till daterade earn-poster | poäng ska löpa ut eller olika intjäningar får olika villkor |
| begränsade kampanjregler | ERPNext/Odoo visar period, villkor och orderkoppling | en konkret kampanjtyp och dess returpolicy är beslutad |
| status-tier | ERPNext visar programnivåer | mätperiod, upp-/nedgradering och förmåner är produktbeslutade |
| durabel command receipt | Fineract visar request-hash, tidigare resultat och audit | fler värdekommandon än issue/redeem/restore delar behovet |

Fineracts generella command bus och bankinfrastruktur avvisas; Corevo behöver
endast det lilla idempotenskontrakt som de faktiska värdekommandona använder.

## Exakta implementation units

| Enhet | Befintlig fil | Nytt bevis |
|---|---|---|
| presentkortskommandon | `apps/web/lib/admin/presentkort/actions.ts`, presentkortsmigrationerna | `supabase/tests/goal91_gift_card_value.sql` |
| lojalitetsspend | `apps/web/lib/admin/lojalitet/`, `apps/web/lib/storefront/lojalitet/` | `supabase/tests/goal91_loyalty_spend.sql` |
| refundkoppling | befintlig payment/refund-outbox | **Goal 92:** riktat integrationstest för exakt restore |
| admin/storefront | befintliga presentkort-/lojalitetsvyer | Vitest bredvid berörda komponenter |
| end-to-end | befintliga modulroutes | **Goal 86:** samlad autentiserad browseracceptans |

Verifierat från `5-Kod`: Goal 91:s två rollbackade SQL-sviter, två kontrollerade
preview-samtidighetsprov, `pnpm test`, `pnpm typecheck`, `pnpm lint` och
`pnpm build`.
