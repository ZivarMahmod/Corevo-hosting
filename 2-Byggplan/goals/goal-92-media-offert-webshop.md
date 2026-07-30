# Goal 92 — media, offert och webshop

Status: **INTERNT TEKNISKT GRÖN — EXTERN ACCEPTANS BLOCKERAD**

## Mål

Lås serververkställd mediakvot, ett atomiskt och sanningsenligt befintligt
offertintake samt konsekvent order-/payment-/refundsanning i webshoppen.

## Leverans

1. Concurrency-säker uploadreservation, kvot, finalize och retrybar delete.
2. Tenantunik mediadedupe, publikhetskontrakt och tre fasta bildvarianter.
3. Atomiskt befintligt offertintake med audit och ärligt leveransutfall.
4. Reserve-idempotens och konsekvent SEK-only orderrail.
5. En ordersnapshot vars total exakt matchar providerbeloppet.
6. Refund-outbox med ärlig pending/succeeded/failed-status.
7. Audit och webhook-inbox/replay för känsliga övergångar.

## Klargrind

- Parallell mediaupload kan inte överskrida kvoten.
- Samtidiga köp kan inte översälja lager.
- Offertstatus och leveransutfall kan inte glida isär.
- Order, provider och refund är beloppsmässigt identiska.
- Providerfel visas aldrig som genomförd refund.
- SQL concurrency/RLS, integration, browser, typecheck, lint och build är gröna.
- Verkliga sandboxflöden och oberoende verifiering är genomförda.

## Verifierat 2026-07-30

- 6/6 källkontrakt, fyra SQL-sviter, två verkliga concurrencyprov och 2/2
  browserflöden är gröna mot preview.
- E2E-teardown och efterföljande renhetskontroll är gröna.
- Hela kodbasen: 397 testfiler/3 015 tester, typecheck, lint utan fel och build.
- Användaraudit av offert, media, webshop och varukorg är genomförd.

## Kvar innan Goal 92 får flyttas till klart

- `08-X01`: Stripe sandbox credentials saknas.
- `08-X02`: PayPal sandbox credentials saknas.
- `08-X03`: R2 Worker-bindning saknas i lokal preview.
- `08-X04`: mottagande e-postsink saknas i lokal preview.

De lokalt testbara delarna kan ingå i Goal 86. De fyra externa proven får inte
redovisas som godkända förrän respektive miljö finns.
