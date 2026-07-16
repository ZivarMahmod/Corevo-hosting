# Goal 69 — datadry-run 2026-07-16

Källa: read-only körning mot Supabase-projektets produktionsschema med
`goal-69-working-hour-slots-dry-run.sql`. Inga rader skrevs eller ändrades.

## Resultat

| Klass | Personaldagar | Tidsrader | Åtgärd |
|---|---:|---:|---|
| `full_resolved_grid` | 10 | 320 | Säker kandidat för snapshot + dynamiskt läge. |
| `full_uniform_grid_review` | 1 | 14 | Bevara tills separat kontroll i 0076. |
| `irregular_special_review` | 22 | 360 | Bevara som uttryckliga specialstarter. |

Övrigt:

- Totalt 694 explicita tidsrader, två tenants och 33 aktiva personaldagar.
- 33 rader finns i `working_hours`.
- 0 kors-tenant-kopplingar i `staff_services`.
- 0 kors-plats-kopplingar mellan personal och platsspecifik tjänst.

## Slutsats

Ingen blind radering. Migration 0076 tar en återställningsbar snapshot och konverterar
endast `full_resolved_grid`. `full_uniform_grid_review` och oregelbundna rader lämnas
orörda tills de har explicit proveniens.

## Slutverifiering av implementationen

- Migration 0076–0079: applicerade och återkörda i lokal PostgreSQL-scratch med `ON_ERROR_STOP`; runtime-sviterna är gröna.
- 0078-runtime: busy-scope, tomma öppettider, direkta DML-staket, kundbindning, time-off, 101 berörda bokningar utan trunkering och atomisk frånvaroombokning.
- 0079-runtime: onboarding i rätt ordning, bestående readiness, transaktionell ersättning och blockering av sista tjänst/arbetstid.
- Vitest: 130 filer och 1 269 tester godkända.
- Typecheck och produktionsbuild: godkända.
- ESLint: 0 fel; 7 sedan tidigare orelaterade varningar.
- Webbläsare: mobil 390 px och desktop 1440 px, kalender/schema/personal, rena konsolloggar.
- Ny adminbokning: tom kalendercell → tjänst → ny kund → giltig tid gjorde `Boka` aktiv utan att testet skrev produktionsdata.
