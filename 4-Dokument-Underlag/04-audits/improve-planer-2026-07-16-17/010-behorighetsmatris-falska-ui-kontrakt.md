# Plan 010: Gör goal-71-behörigheterna konsekventa + laga falska UI-kontrakt (Codex-fynd)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- 5-Kod/supabase/migrations/0081_tenant_member_permissions.sql "5-Kod/apps/web/app/(admin)/admin/statistik" "5-Kod/apps/web/app/(admin)/admin/bokningar" 5-Kod/apps/web/components/portal 5-Kod/apps/web/components/storefront/layouts/presentkort-views.tsx 5-Kod/apps/web/components/personal/NotificationPreferences.tsx`
> OBS: denna plan skrevs mot kod som är NYARE än commit 6cdd690 — goal-71
> (migrationer 0081–0082) landade efter de andra planerna. Verifiera excerpten mot
> live-koden innan du börjar; på mismatch = STOP.

## Status

- **Priority**: P1 (ägarens exakta oro: knappar som inte funkar + falska spara-lägen)
- **Effort**: M
- **Risk**: MED (behörighetsändringar får inte öppna för brett eller låsa ute rätt roll)
- **Depends on**: none (men rör samma behörighetssystem som goal-71 precis byggt)
- **Category**: bug (befintlig funktion funkar inte felfritt)
- **Planned at**: commit `6cdd690` + goal-71-arbetet (migr 0081–0082), 2026-07-17
- **Källa**: oberoende Codex-granskning 2026-07-17 (task-mroy3b45-odw829). Alla fynd
  verifierade i kod av Claude.

## Why this matters

Efter att genomlysningsplanerna 001–009 skrevs byggdes goal-71 (nytt
tenant-member-behörighetssystem: `PLATSCHEF`, `can_view_daily_metrics`,
`can_edit_site`, `operational_role` — migrationer 0081–0082). Behörighets-MODELLEN
finns i DB, men UI:t hedrar den inte konsekvent: route-guard, query-scope,
mutationsknappar och navigation fattar OLIKA beslut om samma person. Det är exakt
ägarens oro — knappar som inte funkar och sparade inställningar som inte gör något.
Plus tre rena "falska kontrakt": ett presentkortsfält som tyst tappas, notisval som
inte styr några utskick, och en död knapp.

## Current state — verifierade fynd

Repo: `5-Kod/`, app `apps/web`. Kommandon från `5-Kod/`.

### A. Behörighets-inkonsekvens (goal-71-modellen hedras inte)

1. **Statistik saknar områdesgrind.** `app/(admin)/admin/statistik/page.tsx:92` —
   `const user = await requirePortal('admin')` i stället för
   `requireAdminArea('statistik')`. All personal kan direktöppna sidan oavsett
   `can_view_daily_metrics` (migration `0081_tenant_member_permissions.sql:56` kopplar
   statistik till flaggan). Sidan läser verklig omsättnings-/bokningsdata
   (`lib/admin/stats.ts:430`). **Behörighetsläcka.**
2. **Admin-kalendern ignorerar "bara sin egen".** `MemberPermissions.tsx:21` lovar
   "Ser alla kalendrar — annars bara sin egen", men
   `app/(admin)/admin/bokningar/page.tsx:105` laddar hela platsens bokningar utan
   `staff_id`-filter (RLS tillåter all platsdata för nivå-3 med platsåtkomst,
   `0076:851`). Flaggan fungerar i personal-PWA:n men ignoreras i admin-kalendern —
   två motstridiga sanningar.
3. **PLATSCHEF låses ute från kalenderns knappar.**
   `app/(admin)/admin/bokningar/page.tsx:211` — `canManageBookings={user.roleLevel >= 6}`.
   PLATSCHEF har DB-rollnivå 3 → får inga knappar för ny bokning/flytt/blockering
   (`CalendarBoard.tsx:759`), trots UI-löftet "PLATSCHEF — vardagsdriften: kalender"
   (`MemberPermissions.tsx:84`) och migrationens manager-stöd i `require_location_admin`
   (`0081:238`). **Servern stödjer handlingen; UI:t gör den omöjlig.**
4. **Navigationen känner inte till de nya tilläggen.** `PortalShell.tsx:140` skickar
   bara numerisk `roleLevel`, aldrig `operational_role` eller de personliga
   tilläggen. Beviljad `can_edit_site`/statistik/PLATSCHEF filtreras bort av
   nivå-6-reglerna i `nav-items.ts:117` + `admin-navigation.ts:47`. Direkt-URL kan
   funka via `requireAdminArea`, men sparad behörighet ger ingen navigerbar väg.

### B. Falska UI-kontrakt (sparar/visar men gör inget)

5. **Calytrix presentkort — mottagarmejlet tappas tyst.**
   `components/storefront/layouts/presentkort-views.tsx:170` — inputen "Mottagarens
   mejl" har `id` + `type=email` men **inget `name`, ingen `value`, ingen `onChange`**
   (verifierat). `onClick={gift.add}` (`:53`) lägger i kundvagnen utan
   `giftRecipientEmail`, trots att order-action + schema stödjer fältet
   (`app/butik/actions.ts:100`, `0059_cart_line_kinds.sql:474`). Kunden skriver
   mottagarens mejl → ignoreras → presentkortet går till KÖPARENS ordermejl (`0059:480`).
   **Datatapp i en betald produkt.**
6. **Personal-notisval styr inga utskick.** `components/personal/NotificationPreferences.tsx:12`
   — tre val (ny/ändrad bokning, dagsschema). Spara-action skriver + visar "sparade"
   (`lib/personal/notification-preference-actions.ts:15`), men enda app-läsningen
   hämtar tillbaka dem till profilformuläret (`lib/personal/notification-preferences.ts:21`)
   — **ingen sändare konsumerar flaggorna.** Spara funkar mot tabellen, inställningen
   påverkar ingenting.
7. **Död veckoknapp.** `app/(personal)/personal/arbetstider/page.tsx:110` —
   veckointervallet är en aktiv `<Button>` utan `href`/`onClick`/submit-typ; delad
   komponent gör den `type="button"` (`components/portal/ui/Button.tsx:70`) som inte
   gör något. Ren knapp-bugg (lägre allvar).

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | gröna               |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |

## Scope

**In scope**:
- `5-Kod/apps/web/app/(admin)/admin/statistik/page.tsx`
- `5-Kod/apps/web/app/(admin)/admin/bokningar/page.tsx`
- `5-Kod/apps/web/components/portal/PortalShell.tsx` + `nav-items.ts` + `admin-navigation.ts`
- `5-Kod/apps/web/components/storefront/layouts/presentkort-views.tsx` (Calytrix-fältet)
- `5-Kod/apps/web/components/personal/NotificationPreferences.tsx` +
  `lib/personal/notification-preferences.ts` (koppla ELLER ta bort)
- `5-Kod/apps/web/app/(personal)/personal/arbetstider/page.tsx` (veckoknappen)
- Testfiler bredvid ovanstående

**Out of scope**:
- Migrationerna 0081/0082 — behörighetsMODELLEN är korrekt; det är UI-wiringen som
  är fel. Ändra inte DB:n.
- RLS-policyerna — separat spår (plan 009 rör boknings-backstop).
- Andra mallars presentkortsvyer — verifiera om de har samma fält-bugg (grep), men
  fixa Calytrix först; övriga som egen delrad om de delar mönstret.

## Git workflow

- Direkt på `main`. En commit per fynd (eller per kluster A/B). Stil: `fix(behörighet): …` / `fix(ui): …`.
- Pusha inte; deploy är operatörens steg. **Samordna med Codex** som bygger i
  goal-71-området — kör inte parallellt mot samma filer.

## Steps

### Step 1: ETT behörighetsbeslut, använt överallt (kluster A)

Definiera behörigheterna EN gång och konsumera samma beslut i route-guard,
query-scope, mutationsknappar OCH navigation. Konkret:
- Statistik: byt `requirePortal('admin')` → `requireAdminArea('statistik')` (eller
  motsvarande som konsulterar `can_view_daily_metrics`). Verifiera hur andra
  områdesgrindade sidor gör och matcha.
- `canManageBookings`: byt `user.roleLevel >= 6` mot ett beslut som inkluderar
  PLATSCHEF/`require_location_admin` (samma som `0081:238`). Använd den befintliga
  behörighets-helpern om en finns; skapa annars EN och använd den både här och i nav.
- Admin-kalendern: när "bara sin egen" gäller, filtrera bokningar/personal på
  `staff_id` i `bokningar/page.tsx:105` (spegla personal-PWA:ns filter).
- Navigation: skicka `operational_role` + de personliga tilläggen till `PortalShell`
  så `nav-items.ts`/`admin-navigation.ts` kan visa beviljade vägar.

**Verify**: `pnpm typecheck` → exit 0; test som täcker: PLATSCHEF ser
kalenderknappar; frisör utan `can_view_daily_metrics` nekas statistik; "bara sin
egen"-flaggan filtrerar kalendern.

### Step 2: Calytrix — koppla mottagarmejlet till kundvagnen

I `presentkort-views.tsx`: ge inputen `value`+`onChange` bundet till gift-state och se
till att `gift.add` skickar med `giftRecipientEmail` (spegla hur andra mallars
presentkort som FUNGERAR gör — grep efter `giftRecipientEmail` i övriga layouts och
matcha). Grep övriga mallar för samma bugg.

**Verify**: `grep -n "giftRecipientEmail\|onChange" apps/web/components/storefront/layouts/presentkort-views.tsx` → mottagarmejlet bundet; test: `gift.add` med ifyllt mejl → raden bär `giftRecipientEmail`.

### Step 3: Notisvalen — koppla eller ta bort

Beslut: antingen (a) konsumera `NotificationPreferences`-flaggorna i den sändare som
skickar ny/ändrad-bokning-notis till personal, eller (b) ta bort UI:t + spara-actionen
om ingen sändare planeras nära. Bygg inte en halv väg. Om (a) är för stort just nu →
välj (b) (ta bort det falska kontraktet) och notera i commit att notiskanalen kan
återinföras när sändaren finns.

**Verify**: antingen en sändare läser flaggorna (grep visar konsumtion) ELLER
UI+action borttagna; `pnpm typecheck` → exit 0.

### Step 4: Död veckoknapp

I `personal/arbetstider/page.tsx:110`: ge knappen funktion (om den ska byta vecka:
`href`/`onClick`) eller gör om den till ren text/label om den bara är en rubrik.

**Verify**: `pnpm typecheck` → exit 0; knappen har antingen handler eller är inte längre en knapp.

### Step 5: Full verifiering

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → allt exit 0.

## Test plan

- Rollbaserade tester (kluster A): PLATSCHEF, frisör (nivå 3 utan tillägg), ägare
  (nivå 6) mot statistik-guard, kalenderknappar, "bara sin egen"-filter, nav. Följ
  befintliga behörighetstesters mönster (grep `roleLevel`/`requireAdminArea` i test/).
- Calytrix: `gift.add` med mottagarmejl → kundvagnsrad bär fältet.
- Codex rekommenderar avslutande **rollbaserade E2E-smokes** för statistik, kalender,
  Sida, schema, presentkort — lägg dem om E2E-harnesset är på (annars notera i README
  nästa-våg).

## Done criteria

- [ ] Statistik kräver `can_view_daily_metrics` (frisör utan flagga nekas)
- [ ] PLATSCHEF får kalenderns ny/flytta/blockera-knappar
- [ ] "Bara sin egen"-flaggan filtrerar admin-kalendern på `staff_id`
- [ ] Navigation visar beviljade vägar (can_edit_site/statistik/PLATSCHEF)
- [ ] Calytrix mottagarmejl når kundvagn + order (test grönt)
- [ ] Notisvalen konsumeras av en sändare ELLER är borttagna
- [ ] Veckoknappen har funktion eller är inte en knapp
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- Behörighets-helpern för PLATSCHEF/`require_location_admin` finns inte och det är
  oklart hur "manager" ska uttryckas i TS — rapportera i stället för att gissa en
  nivå-tröskel (fel tröskel öppnar/låser fel).
- Att filtrera admin-kalendern på `staff_id` bryter en legitim ägar-vy (ägaren SKA se
  alla) — säkerställ att filtret bara gäller när "bara sin egen" är satt; annars STOP.
- Notissändaren visar sig redan finnas men konsumerar en ANNAN flagga — rapportera
  (då är det en koppling, inte ett borttagande).

## Maintenance notes

- Detta är följdstädning efter goal-71. När fler roller/behörigheter läggs: en enda
  behörighets-helper ska vara sanningen för guard + query + knapp + nav samtidigt.
- Reviewer: kontrollera att statistik-guarden inte råkar låsa ute ÄGAREN, och att
  PLATSCHEF-öppningen inte råkar ge frisör-nivå kalenderskrivning.
- Migrationsnummer: 0081/0082 är TAGNA av goal-71. Planer 002/003/008/009 som skrevs
  mot "0081/nästa lediga" ska använda **0083+**.
