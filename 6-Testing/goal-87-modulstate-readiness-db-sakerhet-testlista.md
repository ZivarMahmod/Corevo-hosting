# Goal 87 — modulstate, readiness och DB-säkerhet

Status: **100 % lokalt låst 2026-07-27**

Gren: `codex/launch-inventory-customer-design`
Databas: Supabase-preview `localhost-acceptance`
(`cwnhpesrgolflkmyjbrm`)
Produktion: orörd

## Databasbevis

- Tre append-only migrationer är applicerade enbart på preview:
  `20260726225246_goal87_module_lifecycle.sql`,
  `20260727055957_goal87_public_rpc_module_gates.sql` och
  `20260727062701_goal87_shop_order_token_fence.sql`. Previewhistoriken
  registrerar dem som `20260726234411`, `20260727061032` och
  `20260727062743`.
- Alla nio kanoniska modulnycklar finns och `loyalty` finns inte kvar.
- Statevakten tillåter endast `off → draft → live ↔ paused`,
  `draft/live → off` och idempotent no-op.
- Första `off → draft` lägger till katalogens defaults. Senare statebyten
  bevarar config, data och första `activated_at`.
- Tenant-/modulidentitet, inaktiv tenant, otillåtna hopp och fel operatörsscope
  nekas i DB.
- Publik läsning kräver `live|paused`; nya publika actions kräver `live` och
  grön readiness.
- De 14 publika modulpolicierna använder den gemensamma DB-resolvern.
- RLS-bypassande publika RPC:er går genom samma modulgrindar. Deras privata
  implementationer saknar direkta klientgrants, och shopkvittots token-fence
  körs före modulstate-beslutet i både läsbart och dolt state.
- Nya definer-funktioner har tom `search_path`, schema-kvalificerade relationer
  och avgränsade grants.
- `goal87_module_lifecycle_test.sql`,
  `goal87_public_rpc_module_gates_test.sql`,
  `tenant_launch_booking_tuple_0132_test.sql`,
  `customer_account_claim_0096_test.sql` och
  `atomic_tenant_customer_erase_0099_test.sql` är runtimegröna mot preview med
  rollback.
- Efterbevis av katalog, states, policies, triggers, funktionssignaturer och
  readiness-grants är grönt.
- Security- och performance-advisors är granskade. Inga nya Goal 87-blockerare
  finns; generiska/befintliga varningar kvarstår.

## Lokal kodverifiering

- Fokuserade Goal 87-test: 9 filer / 72 test gröna.
- Kompatibilitet för Goal 72/84: 2 filer / 29 test gröna.
- Full webbsvit: 366 filer / 2 857 test gröna.
- `pnpm typecheck`: grön.
- `pnpm lint`: 0 fel, 7 sedan tidigare kända varningar.
- `pnpm build`: grön produktionsbuild.
- `git diff --check`: grön.
- SidaStudioV2:s två rena tabbhjälpare testas utan att ladda hela
  React-komponenten; standardgränsen räcker och ingen global testgräns ändrades.

## Zivars manuella previewtest

Använd endast en syntetisk previewtenant, aldrig FreshCut eller produktion.

1. Logga in som root och öppna kundens modulkort.
2. Aktivera en avstängd modul. Första synliga state ska bli `draft`, aldrig ett
   direkt hopp till `live`.
3. Växla `draft → live → paused → live` och kontrollera att kundens innehåll
   och inställningar finns kvar.
4. Pausa `shop`, `offert` eller `booking`. Befintligt publikt innehåll ska kunna
   läsas, men en ny order, offert eller bokning ska nekas.
5. Återställ modulen till `live` på en tenant med grön readiness och kontrollera
   att samma publika action åter fungerar.
6. Kontrollera som kundadmin att `draft/live/paused` kan hanteras inom den egna
   aktiva tenanten men att en ny `off → draft` och avstängning till `off` nekas.
7. Kontrollera som partner att endast partnerns egna tenants kan ändras.
8. Bekräfta efter testet att FreshCuts modulstates/radantal är oförändrade.

## Låsgräns

Goal 87 är färdig lokalt. Ingen produktionsmigration, deploy eller Goal 88
ingick i låsningen.
