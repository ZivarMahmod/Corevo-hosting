# FIX-26: Refund-paritet gäst-avbokning — VERIFIERA, täpp om hål
Thinking: 🟡 · Svårighet: 2/5 (mest läsning/test; kod bara om hål finns)

## Mål
Motstridiga uppgifter: VÅG 2-loggen säger "refund-paritet i `cancelByToken` (avboka) + webhook cancelled-gren" = BYGGD; ROADMAP listar "refund-paritet gäst = lös tråd". Avgör vilket som stämmer, bevisa det med test, täpp hålet om det finns. MÅSTE vara stängd innan onlinebetalning slås på.

## Lägeskoppling
FINSLIP-TODO #39. Blockerare för betal-rails-aktivering (FRÅGOR-TILL-ZIVAR F5).

## Berörda filer
- `5-Kod/apps/web/app/avboka/**` + lib-funktionen `cancelByToken`
- Stripe-webhookens cancelled-gren
- `lib/admin/actions.ts` admin-avbokningens refund-väg (paritetsreferensen)

## Steg
1. Läs alla tre avbokningsvägar (gäst-token, kund inloggad, admin) — lista exakt vad var och en gör vid `status='cancelled'` när en betald `payments`-rad finns.
2. Skriv en paritetstabell i briefen som körlogg: väg × (status-byte, history, audit, refund-anrop, idempotens).
3. OM gäst-vägen saknar refund-anropet: spegla admin-vägens refund-logik EXAKT (samma idempotencyKey-mönster som webhook-grenen, `.neq('status','refunded')`-guard).
4. Unit-test: avbokning med betald payments-rad → refund kallas exakt 1 gång; utan betalning → inget refund-anrop; dubbel-avbok → ingen dubbel refund.

## Verifiering
- [ ] Vitest grönt (nya tester + befintliga).
- [ ] Paritetstabellen ifylld med fil+rad-referenser — inga antaganden.
- [ ] Om kod ändrats: bygg via C:\tmp\kod + grep-guard + innehålls-smoke.

## Anti-patterns
- Anta INTE att VÅG 2-loggen stämmer — bevisa med kod-läsning (det är hela poängen).
- Aktivera INTE Stripe-nycklar som del av detta (separat ägar-steg).

## Rollback
Ren verify = ingen. Vid kodändring: `git revert` + wrangler rollback.
