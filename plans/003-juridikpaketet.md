# Plan 003: Bygg juridikpaketet — villkor, integritetspolicy, samtycke, ångerrätt, org-nr/moms

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6cdd690..HEAD -- "5-Kod/apps/web/app/(public)" 5-Kod/apps/web/components/brand 5-Kod/apps/web/lib/notifications/templates.ts 5-Kod/apps/web/components/booking`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (enda fyndet med rättslig exponering)
- **Effort**: L
- **Risk**: MED (rör slutkundens boknings-/köpflöde)
- **Depends on**: none (kan gå före/efter 001–002)
- **Category**: direction / lanseringsgrind
- **Planned at**: commit `6cdd690`, 2026-07-17

## Why this matters

Plattformen tar emot slutkunders namn/mejl/telefon (bokning, webshop, konto) och
säljer varor på distans — men har **noll** juridiska sidor: grep på
villkor/integritetspolicy/ångerrätt/samtycke/organisationsnummer ger 0 träffar i
hela `apps/web`. Att ta betalt av slutkunder utan villkor, ångerrättsinfo och
momsspecifikation bryter mot distansavtalslagen och momslagen; att samla PII utan
integritetspolicy bryter mot GDPR. Detta är roadmapens "juridik"-lanseringsgrind —
den enda grinden som kan stoppa lansering av rättsliga skäl.

**Viktig rollfördelning**: tenanten (salongen/butiken) är personuppgiftsansvarig
och säljare; Corevo är personuppgiftsbiträde och plattform. Sidorna är alltså
PER-TENANT-sidor med tenantens uppgifter, inte Corevo-sidor.

**Texterna i denna plan är strukturella platshållare** — juridiskt granskad text är
operatörens ansvar. Planen bygger infrastrukturen: rutter, fält, länkar, kryssrutor,
kvittorader. Markera varje platshållartext med `{/* JURIDIK-TEXT: granskas av operatör */}`.

## Current state

Repo: pnpm-monorepo i `5-Kod/`, app i `apps/web` (Next.js App Router). Kommandon
från `5-Kod/`. Kodkommentarer på svenska. **Hård repo-regel: ingen bransch får
hårdkodas** — all user-facing text som varierar per bransch ska via
terminologi-/bransch-copy-systemet (`lib/bransch-copy.ts` m.fl.); generisk juridisk
text är OK att ha statisk.

- Publika storefront-rutter ligger i `5-Kod/apps/web/app/(public)/` och renderas
  per tenant (tenant resolvas från host i `middleware.ts` + `lib/tenant-data.ts`).
- Footer: `5-Kod/apps/web/components/brand/Footer.tsx` och `FooterFull.tsx`
  (importeras i `app/(public)/layout.tsx:9-10`). Länkar till juridiksidor hör hemma här.
- Bokningsflödet för slutkund: `5-Kod/apps/web/components/booking/BookingWizard.tsx`
  (stor fil; bekräftelsesteget är sista steget före submit).
- Webshop-kassan: `5-Kod/apps/web/app/butik/` (checkout-flöde; `app/butik/actions.ts`
  skapar order).
- Kvitto-/ordermejl: `5-Kod/apps/web/lib/notifications/templates.ts` —
  `receiptEmail(...)` börjar på rad 313 (filen är 353 rader).
- Tenantens uppgifter: `tenants`-tabellen + `tenant_settings` (se
  `lib/tenant-data.ts` för hur settings läses). Det finns idag INGA fält för
  org-nr eller momssats — de behöver läggas till.
- Migrationskonvention: ny numrerad fil i `5-Kod/supabase/migrations/`, första raden
  är en kommentar med filnamnet. Migrationer körs av operatören, inte av dig.
  Högsta nummer idag: 0080 (0081 tas troligen av plan 002 — använd nästa lediga).

## Commands you will need

| Purpose   | Command (från `5-Kod/`) | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `pnpm typecheck`         | exit 0              |
| Tests     | `pnpm test`              | alla gröna          |
| Lint      | `pnpm lint`              | exit 0              |
| Build     | `pnpm build`             | exit 0              |
| Branschvakt | `pnpm --filter web vakt` | exit 0 (inga NYA hårdkodade branschord) |

## Scope

**In scope**:
- `5-Kod/apps/web/app/(public)/villkor/page.tsx` (skapa)
- `5-Kod/apps/web/app/(public)/integritetspolicy/page.tsx` (skapa)
- `5-Kod/apps/web/components/brand/Footer.tsx`, `FooterFull.tsx` (länkar)
- `5-Kod/apps/web/components/booking/BookingWizard.tsx` (samtyckesrad, minimal diff)
- `5-Kod/apps/web/app/butik/**` (villkors-/ångerrättslänk + kryssruta i kassan)
- `5-Kod/apps/web/lib/notifications/templates.ts` (org-nr + momsrad i `receiptEmail`)
- `5-Kod/apps/web/lib/tenant-data.ts` (läsa nya fält)
- Ny migration `5-Kod/supabase/migrations/00XX_tenant_legal_fields.sql`
- Admin-yta för fälten: den MINSTA befintliga inställningssidan där tenantens
  företagsuppgifter redigeras (leta under `app/(admin)/admin/installningar/` —
  om ingen passar, STOP och rapportera; Inställningar v2 är nästa designpaket och
  fälten kan behöva vänta på det skalet)

**Out of scope**:
- Personuppgiftsbiträdesavtal (DPA) Corevo↔tenant — avtalsdokument, inte kod;
  listas i README som separat operatörsuppgift.
- Cookie-banner/consent-management — storefronten sätter i dagsläget inga
  tracking-cookies (verifiera med en snabb grep efter analytics innan du hoppar
  över; hittar du tracking → STOP och rapportera).
- SaaS-fakturering Corevo→tenant (Stripe Billing) — egen framtida plan.
- Översättning/i18n — svenska räcker nu.

## Git workflow

- Direkt på `main`. En commit per steg. Stil: `feat(juridik): …`.
- Pusha inte; deploy är operatörens steg.

## Steps

### Step 1: Migration för tenantens juridikfält

Ny migration (nästa lediga nummer, filnamnskommentar på rad 1):
`alter table public.tenants add column if not exists org_nr text, add column if not exists vat_rate numeric`
— ELLER som nycklar i `tenant_settings` om det är repots mönster för
icke-kritiska fält (läs `lib/tenant-data.ts` + senaste settings-migrationen och
matcha det etablerade mönstret; dokumentera valet i migrationens kommentar).
Momssats: default 25 (procent); frisörtjänster och varor har olika satser i
verkligheten — modellera som EN tenant-default nu, per-tjänst-moms är out of scope.

**Verify**: migrationsfilen finns, rad 1 = filnamnskommentar; `pnpm typecheck` → exit 0.

### Step 2: Juridiksidorna

Skapa `app/(public)/villkor/page.tsx` och `app/(public)/integritetspolicy/page.tsx`.
Följ strukturen i en befintlig enkel public-sida (t.ex. kontaktsidan under
`app/(public)/` — läs den först och matcha metadata/layout-mönstret). Innehåll:

- **villkor**: tenantens namn + org-nr (från steg 1-fälten, rendera "—" om tomt),
  tjänste-/köpvillkor-platshållare, avboknings-/ombokningsregler-platshållare,
  ångerrättsavsnitt för varuköp (14 dagar distansavtalslagen; undantag för
  tidsbestämda tjänster), reklamation.
- **integritetspolicy**: tenanten som personuppgiftsansvarig (namn/org-nr/kontakt),
  Corevo som biträde, vilka uppgifter som samlas (namn/mejl/telefon vid bokning
  och köp), ändamål, lagringstid-platshållare, rättigheter (registerutdrag,
  radering), klagomål till IMY.

Alla platshållarstycken märks `{/* JURIDIK-TEXT: granskas av operatör */}`.

**Verify**: `pnpm build` → exit 0; sidorna finns i build-output
(`grep -r "villkor" .next/server/app/ --include=*.html -l` eller motsvarande
route-manifest-koll; enklast: `pnpm typecheck` + build grönt och filerna existerar).

### Step 3: Footer-länkar

Lägg länkar till `/villkor` och `/integritetspolicy` i `components/brand/Footer.tsx`
och `FooterFull.tsx`, i befintlig länkstil (läs filerna, matcha markup exakt).

**Verify**: `grep -n "integritetspolicy" 5-Kod/apps/web/components/brand/*.tsx` → ≥2 träffar.

### Step 4: Samtyckesrad i bokningsflödet

I `BookingWizard.tsx`, på bekräftelsesteget (sista steget före submit): lägg en
statisk rad intill submit-knappen — "Genom att boka godkänner du våra
[villkor](/villkor) och [integritetspolicy](/integritetspolicy)" — INTE en
blockerande kryssruta (browsing-friktion i bokningsflödet är dyr; en informativ rad
uppfyller informationsplikten för tjänstebokning). Minimal diff: en JSX-rad + ev.
CSS-klass som redan finns.

Ordet "boka" här: filen är booking-modulens UI och ordet kommer redan från
terminologisystemet i närliggande knappar — använd samma uppslag som
submit-knappens text (leta `resolveTerm`/terminologi-prop i filen; hårdkoda inte).

**Verify**: `pnpm --filter web vakt` → exit 0 (inga nya branschord);
`pnpm typecheck` → exit 0.

### Step 5: Kassan — villkorskryssruta + ångerrätt

I webshop-kassan (`app/butik/`, hitta kassasteget som postar till
`app/butik/actions.ts`): lägg en **obligatorisk** kryssruta "Jag godkänner
[köpvillkoren](/villkor) och har tagit del av [ångerrätten](/villkor#angerratt)"
(varuköp på distans kräver aktivt godkännande). Servervalidering: ordern skapas
inte utan flaggan (lägg valideringen i den server action som skapar ordern).

**Verify**: `pnpm test` → gröna; nytt test på server-actionen: order utan
godkännande-flagga → fel; med flagga → passerar (mocka som närliggande actions-test).

### Step 6: Kvittot — org-nr + momsrad

I `lib/notifications/templates.ts`, `receiptEmail` (rad 313 ff): lägg tenantens
org-nr i sidfoten och en momsspecifikationsrad ("varav moms (X %): Y kr") beräknad
från tenantens `vat_rate` och orderns totalsumma (moms = total × sats/(100+sats),
öresavrunda). Rendera org-nr/momsrad endast när fälten är satta (tomma fält får
inte producera "varav moms (null %)").

**Verify**: utöka/skapa test för `receiptEmail`: med org-nr + 25 % → korrekt
momsbelopp i output; utan fält → raderna utelämnas. `pnpm test` → gröna.

### Step 7: Admin-fält + full verifiering

Exponera org-nr + momssats i den befintliga inställningsyta där tenantens
företagsuppgifter redigeras (om ingen naturlig plats finns: STOP — fälten kan
behöva Inställningar v2-skalet, rapportera det).

**Verify**: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm --filter web vakt` → allt exit 0.

## Test plan

- `receiptEmail`-test (steg 6-fallen) i templates befintliga teststruktur.
- Server-action-test för kassans godkännandeflagga (steg 5).
- Render-test för de två nya sidorna om repot har page-render-tester (leta
  `*.test.tsx` under `app/(public)` — finns mönster, följ det; annars räcker build).

## Done criteria

- [ ] `/villkor` + `/integritetspolicy` byggs (build exit 0, filerna finns)
- [ ] Footer länkar till båda (grep-verifierat)
- [ ] Bokningsbekräftelsen visar villkorsrad; kassan kräver godkännande server-side
- [ ] `receiptEmail` renderar org-nr + momsrad när fälten är satta (test grönt)
- [ ] Migration med filnamnskommentar på rad 1 finns
- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm --filter web vakt` → exit 0
- [ ] Inga filer utanför in-scope ändrade
- [ ] Statusrad uppdaterad i `plans/README.md` + notering om DPA-restposten

## STOP conditions

- Ingen befintlig admin-yta passar för org-nr/moms-fälten (steg 7) — rapportera,
  bygg inte en ny inställningssida (Inställningar v2 är ett eget designpaket).
- `BookingWizard.tsx`-strukturen matchar inte beskrivningen (inget tydligt
  bekräftelsesteg) — rapportera med filens faktiska stegstruktur.
- Kassan visar sig sakna ett naturligt formulärsteg (t.ex. direkt-till-Stripe) —
  rapportera; kryssrutan kan behöva bo i varukorgen i stället.
- Grep hittar tracking-/analytics-cookies på storefronten (då krävs cookie-banner —
  större scope, rapportera).

## Maintenance notes

- Texterna är platshållare: operatören MÅSTE ersätta dem med juridiskt granskad
  text före lansering (sök `JURIDIK-TEXT` i koden).
- Per-tjänst-momssats (6/12/25 %) är medvetet uppskjutet — när POS/kvitton byggs ut,
  flytta momsen till tjänste-/produktnivå.
- DPA (biträdesavtal) är en avtalsfråga utanför koden — spårad i plans/README.md.
- Om i18n införs: juridiksidorna är första kandidater för per-språk-innehåll.
