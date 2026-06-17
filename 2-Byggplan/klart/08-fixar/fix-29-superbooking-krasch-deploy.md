# fix-29 — superbooking client-side crash + login-churn → deploy (med goal-28)

> **⚠️ STATUS-KORRIGERING 2026-06-17:** SHIPPED med goal-28 (superbooking-krasch + login-churn-fix live-verifierad, self-heal i LoginForm). Flytta till `2-Byggplan/klart/08-fixar/`. Läs INTE som öppen.

Thinking: 🔴 (auth/routing, prod, deploy — rollback + redan Zivar-OK för deploy)

## Problem
1. `superbooking.corevo.se` → "Application error: a client-side exception" (efter goal-27). Platform-admin oåtkomlig via sin dörr → blockerar onboarding-UI.
2. Login-churn: Zivar studsar ut / "loggar ut hela tiden" mellan dörrarna.

## Diagnostisera FÖRST (rotorsak — gissa inte)
- Reproducera som inloggad super_admin (`zivar.mahmod@corevo.se`) på superbooking. Hämta det RIKTIGA klient-felet (source maps / dev-build / browser console / `wrangler tail`) — inte den minifierade texten.
- Suspects att kolla: (a) `/`→`/platform`-rewriten + plattform-dashboarden laddar superadminens tenant = den **raderade anchor-tenanten** `corevo-system` (status `deleted`) → null → komponent kraschar; (b) klient-komponent tål ej den nya host-logiken; (c) host-låsta cookies / "ej inloggad på ny host" hanteras ej snyggt.

## Fixa
- superbooking renderar plattform-dashboarden **utan krasch** för super_admin — även om dess tenant är `deleted`/null (tåligt null-handling).
- Login per dörr ren: kan logga in på superbooking + förbli inloggad. Smootha wrong-host-edge om enkelt, annars dokumentera tydligt.
- RÖR EJ: `packages/auth` (FRYST G02), POS/`root`, DAL-fence.

## Fold in (LOW från goal-28-granskningen)
- Lägg `boka` i `DEFAULT_RESERVED` (`lib/tenant.ts`) + `NEXT_PUBLIC_RESERVED_SUBDOMAINS` (`wrangler.jsonc`) → slug `boka` kan ej registreras.
- Test: `xboka.corevo.se` → tenant(xboka); `*.evil.com` → unknown.

## Bygg + deploy (Zivar-OK GIVET)
- Bygg via `C:\tmp\kod`. Gates: typecheck 0 · lint 0 · vitest grönt · opennext PASS · grep-guard ren (ingen `*.corevo.se`-route, ingen `localhost:3000`).
- **EN deploy** = goal-28 (redan byggd + granskad GO) + denna fix.
- Live-verify efter deploy: superbooking → login → plattform-dashboard renderar (0 console-fel) · booking → salon-admin · minbooking → personal · `corevo.se` POS **orörd** · `*.boka`-cert Active.
- Rollback redo (`wrangler rollback` + `git revert`).

## Rapportera
Rotorsak + fix + gate-resultat + live-verifiering. (Cowork/Nörden gör oberoende verifiering efteråt.)
