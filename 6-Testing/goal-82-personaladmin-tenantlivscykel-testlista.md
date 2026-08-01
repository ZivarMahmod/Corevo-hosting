# Goal 82 — verifierad lokal testlista

Status: **GRÖN lokalt 2026-07-24**

Miljö: branch `codex/launch-inventory-customer-design`, localhost mot
Supabase-preview `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`).
Produktion är orörd.

- [x] Aktiv tenant tillåter behöriga mutationer; `provisioning`, `suspended`
  och `deleted` nekar tenantägda writes fail-closed.
- [x] Pausad tenant behåller behöriga läsvyer medan formulär och serverwrites
  är låsta.
- [x] `can_edit_site`, ägare, manager, personal och platsgräns följer befintlig
  roll- och grantkanon.
- [x] Adminens genvägar/FAB är behörighetsstyrda och personalcopy är
  branschneutral.
- [x] Preview-SQL för `0130` passerar med rollback; alla fixture-räkningar är
  noll efter provet.
- [x] Helper-grants är stängda för Data API-roller och `search_path` är tom.
- [x] `/admin` är konsolfri och utan horisontell overflow på `1440 × 900` och
  `390 × 844`; mobilvyn visar `Mobilnavigering`.
- [x] Riktat: 9 filer/70 tester. Fullt: 352 filer/2 763 tester.
- [x] Typecheck, lint utan fel, Next-build, localhost HTTP 200, oberoende
  `SPEC PASS — CLEAN` och slutlig diff-check är gröna.

Browsersessionen saknade tenantkoppling. Mutationer täcks därför av
automatiska tester och det rollbackade preview-SQL-provet, inte av browserwrite.
