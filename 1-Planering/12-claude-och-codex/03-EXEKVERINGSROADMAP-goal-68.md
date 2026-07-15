# Goal 68 — exekveringsroadmap och verifieringskontrakt

**Datum:** 2026-07-15  
**Roll:** Byggordning och testgrindar för Goal 68-programmet.  
**Program-master:** `2-Byggplan/goals/goal-68-kundportal-pwa-kommunikation.md`

## Varför detta dokument finns

Produkt- och arkitekturriktningen är stark, men U0–U13 är för stort för en enda autonom goal. Den säkra vägen är sex avgränsade leveranser med ett bevisat, användbart system efter varje steg. Riktig SMS-provider ligger utanför programmet tills mänskliga providerbeslut finns.

```text
Goal 67 stängd
  → 68.0 Baseline/KTD
  → 68.1 Ledger/dispatcher
  → 68.2 E-post/länkning/DAL
  → 68.3 Central portal
  → 68.4 PWA/push/policy
  → 68.5 Översikt/last/drift
  → Goal 68 verifierat klart
  → separat SMS-goal efter Zivars go
```

## Grindmatris

| Våg | Förkrav | Byggresultat | Obligatoriska testfamiljer | Bevis för att gå vidare |
|---|---|---|---|---|
| 68.0 | Goal 67 i `klart/` | `goal-68-ANALYS.md`; låsta KTD:er för outbox, flags, ombokning, token, preview och UI-luckor | Baseline typecheck/unit; dagens gästbokning; `/konto`; avbokningslänk; host/PWA/cron/schema-inventering | Oberoende reviewer kan följa varje påstående till fil/rad/kommando |
| 68.1 | 68.0 klart | Typer, rolloutflaggor, ledger, atomisk outbox, dispatcher | DB constraints; anon/kund/tenant A↔B; booking+event atomicitet; 100 samtidiga claims; retry/lease/dead-letter | Ingen tappad eventrad, inget dubbel-attempt, flag-off diff-0, rollback testad |
| 68.2 | 68.1 klart | E-postadapter, dual-path cutover, säker claim/länkning, portal-DAL | Mallkarakterisering; providerfel; dubbelkörning; token A/B/expired/tampered/replay; 0/1/2 relationer; query count | Bokning oberoende av provider; inget dubbelmejl; ingen osäker merge/cross-tenantdata |
| 68.3 | 68.2 klart + designpaket | Central portal bakom host-/tenantflagga | Designacceptans/probe; 360/390/768/desktop; loading/empty/error/session; hostregression; data A↔B | 0 design-FAIL; `/konto`, admin och personalhost regressionsfria |
| 68.4 | 68.3 klart | Manifest, SW, installflöde, Web Push, preferenser och policy | Installability; SW update; offline/no false mutation; explicit permission; 2 enheter/410; click allowlist; policytabell | Ingen privat cache; inget falskt leveranspåstående; deterministisk fallback |
| 68.5 | 68.4 klart | Adminöversikt, export, observability och full icke-prod-verifiering | Authz/export A↔B; tidszon/valuta; kostnadshärledning; full E2E; last/dubbelklick/retry; build; preview/staging om tillåtet | Full kedja reproducerbar; noll tappade/dubbla; drift/rollback/larm dokumenterade |

## Bevisstruktur

Varje aktiv del-goal skapar en mapp under:

```text
2-Byggplan/goals/goal-68-bevis/<del-goal>/
  README.md               # commit, miljö, datum och sammanfattning
  commands.md             # exakta kommandon + exit codes
  review.md               # SATISFIED/PARTIAL/MISSING per acceptanspunkt
  human-gates.md          # vad som inte har körts och varför
```

Små maskinresultat kan sparas där. Tunga screenshots, traces och binära rapporter ska ligga på befintlig testartefaktplats och länkas från `README.md`; dumpa dem inte i repo-roten.

## Testdisciplin per arbetsenhet

1. Skriv/identifiera ett test som faller för den nya förmågan.
2. Implementera minsta kompletta kontrakt för arbetsenheten.
3. Kör riktade tester.
4. Kör påverkad regressionsyta.
5. Kör del-goalens fulla gate.
6. Låt en annan agent verifiera faktisk kod/migration/testresultat.
7. Rätta `PARTIAL`/`MISSING`; flytta goalen till `klart/` först vid reproducerbart grönt bevis.

## Särskilda stoppskyltar

- **Outbox:** stoppa 68.1 om event inte kan skapas i samma SQL-transaktion som auktoritativ bokningsinsert.
- **Flaggor:** stoppa 68.1 om U0 inte låst lagringsyta och auth/RLS-kontrakt.
- **UI:** stoppa 68.3 om exakt Codex Design-/acceptanspaket saknas.
- **Staging:** kalla aldrig lokal preview för staging. Parkera staginggrinden om deployfrysen blockerar icke-prod-distribution.
- **SMS:** bygg inte providerwebhook/signatur eller riktig trafik före separat providerbeslut.
- **Prod:** inga prodmigrationer, taggar eller deployer inom programmet utan Zivars uttryckliga besked.

## Rollbackklasser

Varje schema-/cutoversteg ska ange minst en primär rollbackklass:

1. **Flag-off/appkompatibilitet:** nya writes/reads stängs, gammal väg fungerar.
2. **Funktion-restore:** tidigare RPC-funktion återställs med explicit SQL och kontraktstest.
3. **Schema-rollback:** additiva objekt tas bort endast när data-/beroendeanalys visar att det är säkert.

Build-once-never-delete betyder att destruktiv rollback inte är standard. Rollbackartefaktens plats och körordning ska följa repoets befintliga ops-/rollbackstruktur och dokumenteras i den aktiva del-goalen.
