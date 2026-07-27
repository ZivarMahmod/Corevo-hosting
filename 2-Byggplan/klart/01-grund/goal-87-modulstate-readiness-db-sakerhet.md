# Goal 87 — modulstate, readiness och DB-säkerhet

Status: **KLAR — lokalt verifierad 2026-07-27** på
`codex/launch-inventory-customer-design`.

## Mål

Lås den gemensamma modulgrunden så att state, första aktivering, publika
läsningar/skrivningar och readiness ger samma fail-closed svar i DB och app.
Arbetet gäller dagens nio moduler och den befintliga motorn. Produktion,
Cloudflare och Goal 88–93 ingår inte.

## Frysta beslut

- Kanoniska modulnycklar är `booking`, `media_library`, `shop`, `offert`,
  `blogg`, `lojalitet`, `presentkort`, `kurser` och `galleri`.
- En saknad booking-rad behåller endast det befintliga legacy-defaultet
  `booking=live`. Ett läsfel är inte en saknad rad och ska alltid neka.
- Tillåtna stateövergångar är:
  - `off → draft`
  - `draft → live`
  - `live → paused`
  - `paused → live`
  - `draft/live → off`
  - oförändrat state som idempotent no-op
- Root och en DB-verifierad partner är plattformsoperatör inom sitt scope.
  Endast plattformsoperatören får aktivera `off → draft` eller stänga av till
  `off`. Behörig kundadmin får hantera `draft → live → paused → live` för en
  aktiv egen tenant.
- Onboarding som önskar `live` eller `paused` går genom de tillåtna stegen;
  den får inte behålla ett privilegierat direkt-hopp från `off`.
- Vid första aktivering kopierar DB
  `modules.default_config || tenant_modules.config`, så uttryckliga val vinner.
  Senare paus, avstängning och återaktivering bevarar config och data.
- `tenant_id`, `module_key`, `id`, `created_at` och ett redan satt
  `activated_at` är immutabla vid update.
- Publik läsning kräver `live|paused`. En ny publik action kräver `live` och
  grön readiness. `paused` är läsbar men tar inte emot nya actions.
- Readiness behåller dagens bokningsblockerare och kompletteras med ett
  modulindelat svar. Goal 90–92 äger nya modulunika produktkrav; Goal 87 hittar
  inte på sådana krav i förväg.

## Minsta implementation

1. Skapa nästa migration med Supabase CLI. Ersätt den gemensamma
   `tenant_modules_state_guard` så att den:
   - verkställer övergångsmatris, roll/scope och aktiv tenant;
   - låser radens identitet och aktiveringsmetadata;
   - applicerar katalog-default exakt en gång.
2. Lägg en liten DB-ägd resolver för publik läsning/action och återanvänd den i
   befintliga publika RLS-policies och readiness. Nya `security definer`-funktioner
   har tom `search_path`, schema-kvalificerade relationer och explicita grants.
3. Gata dagens publika moduldata vid DB-gränsen: shop, blogg, lojalitet,
   kurser, galleri och offertintag. Befintliga dubbla grindar i offert,
   lojalitet och kurser behålls.
4. Gör shopens gemensamma publika action-context beroende av `shop=live`.
   Booking fortsätter använda den gemensamma state-resolvern men RPC-fel ska
   neka i stället för att aktivera legacy-defaultet.
5. Låt befintlig `moduleCtx` ta en modulnyckel. Modulmutationer tillåts i
   `draft|live`; `off|paused` nekas. Tenantens vanliga livscykelvakt ändras inte.
6. Spegla DB-matrisen i `setModuleState` och visa bara lagliga nästa states i
   befintliga `ModulesCard`. Ingen arbetsyte- eller navigationsombyggnad.
7. Ändra onboardingens modulskrivning till lagliga steg. DB, inte TypeScript,
   äger default-configkopieringen.
8. Rätta kvarvarande `loyalty → lojalitet` i vertikalernas presets. Den
   isolerade previewgrenen har verifierats innehålla alla nio katalograder, så
   inga duplicerade eller spekulativa seeddefinitioner läggs till; ett kontrakt
   låser i stället hela inventariet.
9. Regenerera `packages/db/types.ts` efter previewmigrationen och ta bort
   handskrivna RPC-casts för de nya/ändrade kontrakten.

## Acceptans

- Första `off → draft` får katalogens defaults plus uttryckliga overrides.
- Senare statebyten bevarar config, data och första `activated_at`.
- Otillåtet hopp, ändrad module/tenant-identitet, inaktiv tenant och
  obehörig aktivering nekas i DB även via direkt Data API.
- Root och partner kan bara ändra rätt tenant; kundadmin kan aldrig aktivera
  en ny modul eller stänga av abonnemanget.
- `off|draft` är dolt publikt. `live|paused` kan läsas. Endast `live` med grön
  readiness tar emot nya publika actions.
- RPC-/loaderfel blir stängt läge; en verkligt saknad booking-rad behåller
  legacykompatibiliteten.
- Readiness-svaret visar modulstate och modulens blockerare utan att duplicera
  bokningssanningen.
- Alla nio katalognycklar finns, ingen `loyalty`-nyckel finns och varje
  vertikalpreset pekar på en verklig modul med giltigt state.
- Genererade typer innehåller RPC-kontrakten och hela webbappen kompilerar utan
  lokala typcasts för dem.

## TDD-ordning

1. Rött SQL-/kontrakttest för övergångar, immutabel identitet, aktiv tenant,
   default-config och de nio katalognycklarna.
2. Rött rent TypeScript-test för fail-closed läsfel samt read/action-matrisen.
3. Migrationens state-vakt, katalogrättning och modulmedvetna readiness.
4. Rött test för onboardingens lagliga steg och plattformens state-action.
5. Rött test för `moduleCtx`, shop-action och publika RLS/action-grindar.
6. Regenererade DB-typer och borttagna casts.
7. Preview-SQL med rollback, full svit, advisors och oberoende review.

## Verifiering före låsning

1. Fokuserade RED→GREEN-test för varje säkerhetsgräns.
2. SQL-runtimeprov i transaktion med rollback på Supabase-preview
   `localhost-acceptance`.
3. Read-only efterbevis av katalog, policies, grants och funktionssignaturer.
4. Supabase security/performance advisors efter migration.
5. Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. Oberoende spec-, DB-säkerhets- och kodgranskning.

## Utanför målet

- Goal 88: gemensam kundarbetsyta, SidaStudioV2 och modulnavigation.
- Goal 89: gemensam preview/storefrontmotor, metadata och fasta mallslots.
- Goal 90–92: modulunika produktkedjor, capability och redemption.
- Goal 93: hela vertikal-/mallkatalogen och mekanisk designacceptans.
- Goal 85–86: lokal releaseövning respektive Zivars samlade localhosttest.

## Låsbevis

- Tre append-only migrationer är applicerade och runtimeverifierade endast på
  Supabase-preview `localhost-acceptance`; produktion är orörd.
- Fem rollbackade SQL-runtimeprov, efterbevis, advisors och oberoende
  DB-/kodgranskning är gröna.
- 9 fokuserade testfiler / 72 test och hela webbsviten
  366 filer / 2 857 test är gröna.
- Typecheck, lint utan fel, produktionsbuild och `git diff --check` är gröna.
- Zivars manuella kontroll och det fulla lokala beviset finns i
  `6-Testing/goal-87-modulstate-readiness-db-sakerhet-testlista.md`.
