# Goal 84 — komplett onboarding till första bokning

Status: **VERIFIERAT KLAR 2026-07-25** på
`codex/launch-inventory-customer-design`.

## Mål

Bevisa en sammanhängande previewkedja från superadminens nya kund till en
verifierad bokning på localhost. Kedjan ska använda befintliga produktflöden,
Supabase-preview `localhost-acceptance` och en lokal e-postrelay. Produktion,
FreshCut och externa transportörer får inte ändras.

## Produktluckor som stängs

1. Onboarding Studio ska bevara ett uttryckligt `booking=off`; webbplatskunder
   får inte tvingas till bokningsmodulen.
2. Superadmin ska kunna spara och bekräfta primärplatsens riktiga
   `location_opening_hours` från kundkortet med den befintliga atomiska RPC:n.
3. Boknings-readiness ska kräva minst en verklig kombination där aktiv tjänst,
   tilldelad aktiv personal, arbetstid och bekräftad platsöppettid ligger på
   samma veckodag och tjänstens längd ryms.

## Minsta implementation

- Återanvänd Onboarding Studios befintliga modulstate och serverskrivare.
- Ägare förblir obligatorisk i Onboarding Studio. Ingen UI-text får lova en
  senare ägarinbjudan innan en sådan produktväg finns.
- Återanvänd `LocationOpeningHours` och
  `save_location_booking_settings`; lägg inte till en ny öppettidsmodell eller
  RPC.
- Dela befintlig formulärvalidering mellan tenantadmin och platformaction.
- Ett läsfel för öppettider ska degradera öppettidskortet, inte fälla hela
  kundarbetsytan.
- Primärplatsen ska väljas deterministiskt med samma ordning i TypeScript och
  SQL även om gammal data har flera `is_primary=true`.
- Migration `0132` ersätter readiness-källan och de två publika funktioner som
  annars skulle rapportera ett annat `booking_required`.
- Migration `0133` bryter rolläsningens RLS-rekursion och låter endast en
  behörig tenantskopad global operatör bekräfta platsöppettider.
- Behåll readiness-nyckeln `working_hours`; ingen ny UI-state behövs.
- Platformactionen ska använda `platformCtx`, `assertPlatformTenantAccess` och
  den befintliga RPC:ns DB-grind.
- Använd befintlig e-posttransport mot en relay bunden till `127.0.0.1`.
  Ingen PIN får returneras till browsern, DB:n eller produktloggar. Testrelayn
  får hålla PIN tillfälligt i processminne och ska rensa den efter användning.

## Previewfixture

- Behåll en syntetisk tenant med slug `goal84-acceptans`.
- Kedja: ägare → primärplats/öppettider → tjänst → personal →
  tjänstekoppling → schema → aktivering → publicering.
- Återanvänd previewmiljöns seedade superadmin. Acceptansscriptet får inte skapa
  en tillfällig plattformsoperatör.
- Behåll fixturetenantens grunddata för Goal 86.
- Testbokningen avbokas genom produktflödet; ingen generell tenantteardown.
- Alla skrivningar och kontroller använder exakt preview-ref
  `cwnhpesrgolflkmyjbrm`. Ref `clylvowtowbtotrahuad` är förbjuden.
- FreshCut-invarianten ska kontrollera FreshCut; fallback till Demo är förbjuden.

## Acceptans

- `booking=off` kan publiceras som webbplats utan bokningsgrund.
- `booking=live` visar blockerare tills hela bokningsgrunden finns.
- Fel veckodag, för kort överlapp och en explicit start som inte rymmer tjänsten
  håller readiness röd; en giltig kombination gör den grön.
- Direkt `status=active` kan inte gå runt databasspärren.
- Publicering går genom `publish_tenant` och är idempotent.
- Desktopflödet skapar en riktig fyrsiffrigt verifierad bokning via lokal relay.
- Bokningen har rätt tenant, plats, tjänst och personal samt PIN- och
  bekräftelseoutbox.
- Mobilsmoke 390×844 har ingen horisontell overflow.
- FreshCuts status, modulval och radantal är oförändrade före/efter.
- Ägare, tjänst, personal, tjänstekoppling, schema och aktivering skapas genom
  produktens UI/server-actions. Direkt DB-läsning används bara som efterbevis.
- Direkt DB-skrivning används endast för det uttalade negativa provet att
  `status=active` inte kan gå runt databasspärren.
- På 390×844 är horisontell overflow 0 px och öppettidernas interaktiva
  touchmål är minst 44×44 px.

## TDD-ordning

1. Ägargrind och sann UI-copy.
2. Felsäkert öppettidskort och ärligt tomt läge utan primärplats.
3. Deterministisk primärplats och platform-scope på öppettidsactionen.
4. En sammanslagen readinessmigration med positivt och negativa runtimefall.
5. Verkliga UI-vägar i previewacceptansen, seedad superadmin och exakt FreshCut.
6. Mobilmått, full svit, advisors och oberoende review.

## Verifiering före låsning

1. Fokuserade RED→GREEN-test för varje produktlucka.
2. SQL-runtimeprov i transaktion med rollback.
3. Browseracceptans på localhost + Supabase-preview.
4. Supabase security/performance advisors efter migration.
5. Full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. Oberoende spec- och kodgranskning.

## Låsbevis

- Färsk browseracceptans från tomma fixtures:
  `goal84: preview-browseracceptans LOCK OK`.
- SQL-runtime för `0132` och `0133`: grön på
  `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`).
- Full testsvit: 362 filer / 2 819 test.
- Typecheck, lint utan fel och produktionsbuild: gröna.
- Security/performance advisors: 0 error.
- Tillfällig testmejlhook borttagen och normal rate limit återställd.
- FreshCut oförändrad; produktion orörd.

Fullt protokoll:
`6-Testing/goal-84-komplett-onboarding-till-forsta-bokning-testlista.md`.
