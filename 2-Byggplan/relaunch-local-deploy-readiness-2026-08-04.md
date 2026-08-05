---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# Corevo: lokal deploy-readiness efter sanering

## Goal capsule

Gör den sanerade arbetsytan till en lokalt verifierad releasekandidat. Återinför
inte parallella ägare, död kompatibilitetskod eller externa produktionsändringar.

## Krav och avgränsning

- Varje runtimebeteende har en befintlig kanonisk ägare; ersatt kod är raderad.
- Test, typecheck, lint, build och diffkontroll körs från `5-Kod/`.
- Staging, produktion, externa providers, DNS och deploy ändras inte här.

## Arbeten

### U1: Säkra notifieringsägaren

Cronen ska använda offertens respektive bokningens befintliga leveransägare och
misslyckas synligt om återställningsleveransen misslyckas.

### U2: Gör E2E-databasvakten fail-closed

Supabase CLI-resultat ska vara JSON före parsing. Parserns fel- och rena svar
testas lokalt; linked staging är en separat gate.

### U3: Eliminera parallella instruktioner och testkopplingar

`AGENTS.md` är den enda agentregeln. Tester bor hos den render- eller routeägare
de faktiskt provar och `lib/` importerar inte UI.

### U4: Bygg lokal releasekandidat

Kör hela lokala gaten efter sista ändringen. Dokumentera externa risker i
`HANDOFF.md` som ej verifierade, inte som gröna.

### U5: Stäng bekräftade releasefel utan nya lager

- Publik bokning läser sin egen verifieringspolicy oberoende av portal-läge.
- Push-fallback återställs till ett claimbart försökstillstånd.
- Scheduler-routes har en timeout och notifieringsdräneringen är tidsbegränsad.
- CI kör alla kvarvarande acceptanskontrakt; saknade `ACCEPT_*` ska ge rött, inte
  ett falskt grönt resultat.
- GitHub-nödrälsen dränerar notifieringskön när primärschedulern inte är bevisad.

## Definition of done

- Lokala kontroller är gröna på den aktuella arbetsytan.
- Saneringsdiffen har ingen bekräftad P0/P1 utan fix eller test.
- En lokal commit skapas först efter att samtliga avsedda ändringar är
  reconcilerade. Remote publicering väntar på uttryckligt godkännande.
- Statusen är lokalt deploybar men inte produktions-GO tills staging,
  migrationsruntime, browseracceptans och providerdrift har verkliga bevis.
- En separat `CREATE INDEX CONCURRENTLY` för e-postkön avgörs först av staging-
  `EXPLAIN` mot verkligt SMS-backlog; den ska inte gissas in i den transaktionella
  releasekedjan.
