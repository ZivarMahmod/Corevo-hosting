# Testlista — Goal 91

## Presentkort

- [x] Retry ger ett kort och en issue-post.
- [x] Samma idempotency key/payload ger samma resultat; annan payload avvisas.
- [x] Partial spend och två samtidiga spends bevarar korrekt icke-negativt saldo.
- [x] Expired/void avvisas även utan kört cronjobb.
- [x] Manuellt restore sker exakt en gång och aldrig över originalredemption.
- [ ] Refund av kortköpet lämnar inte både pengar och aktivt värde.
- [x] Koder är kryptografiska, hashade, maskerade och rate-limitade.

## Lojalitet

- [x] Befintlig transaktionell intjäning och exakt-en-gång-kontrakt bevaras.
- [x] Outcome-korrigering skriver reversal/re-earn utan historikmutation.
- [x] Reconciliation upptäcker missad intjäning utan spekulativ repairmotor.
- [x] Spend och reversal bevarar korrekt icke-negativt saldo.
- [x] Spend och outcome-reversal använder samma tenant-/kundlås.

## Säkerhet och drift

- [x] Alla källobjekt och entries kräver samma tenant.
- [x] Icke-`live` modul och inaktiv tenant blockerar värdeactions.
- [x] Privat DB-release blockerar direkt issue/redeem/adjustment-RPC för en
      tenant som inte är frisläppt.
- [x] Ledger, saldo-cache, audit och value-outbox skrivs atomiskt.
- [x] Reconciliation visar ledger = cache och liability per tenant/valuta.
- [x] Klubbinträde ändrar inte marknadsföringssamtycke.

## Väntar på nästa goals

- [ ] Goal 92: betald issuance, hemlig leverans, subscriptioncharge och exakt
      providerrefund.
- [ ] Goal 86: autentiserad browseracceptans av de samlade admin- och
      storefrontflödena.
