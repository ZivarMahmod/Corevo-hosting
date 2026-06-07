# FIX-25: Onboarding-steg 5 "Egen domän" ska spegla flaggan
Thinking: 🟢 · Svårighet: 1/5 (en rad + deploy)

## Mål
Plattformens salong-detalj (Översikt → Onboarding-stege) visar statiskt "SPÄRRAD — kör på *.corevo.se. Custom domän kräver manuell drift." för steg 5, fast DomänPanelen är LIVE (flagga på, verifierad 2026-06-07). Texten ska spegla verkligheten.

## Lägeskoppling
FINSLIP-TODO #7. goal-23 stängd — detta är kosmetisk efterdyning.

## Berörda filer
- `5-Kod/apps/web/lib/platform/tenants.ts` (~rad 328) — steg-5-objektet i onboarding-listan.
- Ev. `components/platform/OnboardingChecklist.tsx` (status-ikonen `locked: '🔒 Spärrad'`) — bara om status-fältet också ska bytas.

## Steg
1. Läs hur steg-5-objektet byggs i `tenants.ts` (~328). Identifiera om steget har ett statiskt `locked`-status.
2. Gate:a på samma sanning som DomainPanel: `process.env.DOMAIN_PROVISIONING_ENABLED === 'true'`.
   - Flagga PÅ → status utifrån data: finns verifierad rad i `tenant_domains` för tenanten → `✓ Klart`, annars neutral "Tillgänglig — läggs till under Integrationer → Domän".
   - Flagga AV → behåll exakt nuvarande SPÄRRAD-text (oförändrat beteende).
3. Ingen ny DB-query om det blir dyrt: tenant-detaljen läser redan domändata för DomainPanel — återanvänd om den finns i samma server-scope; annars är `count`-läsning på `tenant_domains` per tenant OK (en tenant-sida, inte lista).

## Verifiering
- [ ] Render som platform@: freshcut → steg 5 visar INTE "Spärrad" (freshcut har verifierade domäner → `✓ Klart`).
- [ ] 0 console-fel.
- [ ] Bygg via `C:\tmp\kod` (robocopy /E → del .env.local → grep-guard `localhost:3000` → deploy → innehålls-smoke).

## Anti-patterns
- Hårdkoda INTE "Klart" — härled ur flagga + data (ärlighetspass-principen från goal-19).
- Rör INGET annat i onboarding-stegen.

## Rollback
`git revert` + `wrangler rollback <föregående version> --config 5-Kod/apps/web/wrangler.jsonc`.
