# Goal 91 — presentkort och lojalitet

Status: **KODKLAR I PREVIEW — betald rail väntar på Goal 92; samlad
browseracceptans görs i Goal 86**

## Mål

Gör presentkort och lojalitet till tenantisolerade, atomiska och auditbara
värdeflöden med säker inlösen, reversering och idempotens.

## Leverans

1. Append-only presentkortsledger och migration av befintligt saldo.
2. Kryptografiska, hashade och maskerade presentkortskoder.
3. Atomisk issue, partial redeem, restore, void och reversal.
4. Atomisk lojalitetsspend och append-only reversal.
5. Readiness-, commerce-, tenant- och action-gates.
6. Audit, atomisk value-outbox, reconciliation och riskgränser.

Presentkortens issue, redeem och adjustment kräver både appens
tenant-allowlist och en privat DB-release för samma tenant. Ett direkt
admin-RPC kan därför inte kringgå releasegrinden.

## Klargrind

- Samtidiga spends kan inte skapa negativt saldo.
- Retry och dubbla webhooks skapar inte dubbelt värde.
- Manuellt restore återställer exakt tidigare debitering en gång.
- Full kod förekommer inte i DB-logg, audit, analytics eller vanlig admin.
- SQL concurrency/RLS, integration, typecheck, lint och build är gröna.
- Verkligt charge/refund-flöde är verifierat innan betald funktion markeras live.
- Oberoende verifierare har granskat beviset.

## Avgränsad status

Manuell issuance, partial redeem, restore, void, adjustment, lojalitetsspend
och spend-reversal är byggda. Betald presentkortsissuance, hemlig leverans,
subscriptionaktivering och providerrefund är medvetet fail-closed och byggs i
Goal 92. Goal 91 flyttas därför inte till `klart/` före Goal 92 och Goal 86.
