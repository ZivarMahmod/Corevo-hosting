# Testlista — Goal 92

## Media

- [x] Samtidiga uploads kan inte överskrida tenantkvoten.
- [x] Samma hash inom tenant ger ett ready-original; andra tenants isoleras.
- [x] Finalize/delete-fel lämnar synlig retrybar post.
- [x] Refererad media kan inte raderas tyst.
- [x] Endast publicerad ready-media är publik.

## Offert

- [x] Intake är tenantbundet, rate-limitat och validerat server-side.
- [x] Samtidiga statusändringar använder compare-and-set och tappar inte data.
- [x] Ogiltig FSM-övergång avvisas i DB.
- [x] Leveransfel ger pending/failed, inte falskt quoted/sent.
- [x] Varje status- och leveransändring auditeras.

## Webshop

- [x] Samma reserve-idempotens ger samma order och lagerhold.
- [x] Parallella köp kan inte ge reserverat lager över stock.
- [x] Annan/blandad valuta avvisas.
- [x] Ordertotal = providerbelopp för skatt, rabatt och frakt.
- [x] Dubblettwebhook ger en payment, lagercommit och auditpost.
- [x] Expiry frigör lager exakt en gång.
- [x] Refund går `pending → succeeded|failed/review` och retry är idempotent.
- [x] Restock sker endast genom uttryckligt retur-/lagerbeslut.

## Extern acceptans

- [ ] `08-X01` verkligt Stripe-sandboxflöde — blockerad av saknade credentials.
- [ ] `08-X02` verkligt PayPal-sandboxflöde — blockerad av saknade credentials.
- [ ] `08-X03` R2 Worker-runtime — blockerad av saknad lokal bindning.
- [ ] `08-X04` offertleverans till mottagande e-postsink — blockerad lokalt.

## Samlad verifiering 2026-07-30

- [x] 6/6 källkontrakt.
- [x] SQL, concurrency, 2/2 browserflöden, teardown och ren databas.
- [x] 397 testfiler/3 015 tester, typecheck, lint utan fel och build.
