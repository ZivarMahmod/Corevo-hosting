# Övriga lanseringsgap — read-only audit

**Datum:** 2026-07-22
**Status:** historisk audit från 2026-07-22; använd `HANDOFF.md` för aktuellt
nuläge efter Goal 76–80. Inga produkt-, drift- eller databasändringar utfördes
i själva auditen.
**Omfattning:** återstående lanseringsspår utanför kundportalen och Goal-74

## Slutsats

Corevo har redan en stark teknisk kärna: wildcard-routen för bokningsdomäner,
tenantupplösning, en delad bokningsmotor för fyra presentationer, platsmedveten
tillgänglighet, central behörighetsmodell, revisionsbaserad sajtredigering,
partnerisolering och en omfattande CI/CD-kedja. Det vore fel att bygga om dessa
delar.

Lanseringen har däremot två verkliga P0-gap:

1. `createTenant` använder `active` som commit-gräns trots att tenantens publika
   adress, ägare och bokningsbarhet inte behöver vara klara. Resultatet kan vara
   markerat **”Aktiv & publik”** fast det saknar tjänst, personal, schema eller en
   nåbar adress.
2. Plattformens kanon säger `<slug>.boka.corevo.se`, men skapande, länkar,
   presentation och deploy-smoke använder fortfarande i stor utsträckning
   `<slug>.corevo.se`. Domänbrandväggen är därför inte en enda verkställd regel.

Det högsta P0-felet är det första: systemet kan framgångsrapportera och aktivera
en kund innan det finns en serververifierad väg från provisionering till nåbar,
bokningsbar publicering. Domänsplittringen gör samma fel ännu farligare eftersom
domänkopplingsfelet fångas och ignoreras.

## Bedömningsskala

- **P0:** gör en lansering falskt grön, bryter en hård domän-/isoleringsregel eller
  kan lämna en ny betalande kund aktiv men oanvändbar.
- **P1:** blockerar en avtalad variant, roll, flerplats- eller internationell väg,
  eller gör releasebeviset otillräckligt, men bryter inte säkert standardflödet för
  en befintlig svensk enplatstenant.

## 1. Kanoniska domäner och Cloudflare

### Redan byggt

- `5-Kod/apps/web/wrangler.jsonc` äger `*.boka.corevo.se/*` och sätter
  `NEXT_PUBLIC_TENANT_HOST_SUFFIX=boka.corevo.se`.
- `5-Kod/apps/web/lib/tenant.ts` känner igen `<slug>.boka.corevo.se`, reserverar
  apexen `boka.corevo.se`, skiljer backoffice-hostar från tenant-hostar och stöder
  verifierade custom domains.
- `5-Kod/apps/web/lib/tenant.test.ts` har 24 gröna host-resolutionstester.
- Driftverktyg för routes/custom domains finns i
  `5-Kod/apps/web/scripts/deploy-prod.mjs`, `gen-deploy-config.mjs`,
  `domain-routes.mjs`, `add-domain.mjs` och `cf-domains.mjs`.

### P0 — två konkurrerande publika URL-kontrakt

- `5-Kod/apps/web/lib/storefront-url.ts` deklarerar fortfarande den publika URL:en
  som `https://<slug>.corevo.se`.
- Samma gamla värd byggs bland annat i
  `lib/admin/tenant.ts`, `lib/platform/actions/tenants.ts`,
  `lib/platform/tenants.ts`, `components/platform/onboarding-studio/*`,
  `components/platform/KunderBoard.tsx`, `DomainPanel.tsx` och
  `DomainManager.tsx`.
- `createTenant` försöker koppla `<slug>.corevo.se` via
  `attachWorkerSubdomain`, inte den kanoniska wildcard-adressen. Felet fångas utan
  att stoppa aktiveringen (`lib/platform/actions/tenants.ts:401-425`).
- `5-Kod/apps/web/scripts/check_domains.mjs` provar aktiva tenants som
  `<slug>.corevo.se`, accepterar varje status under 500 och provar varken
  `<slug>.boka.corevo.se` eller en bokningssida.
- `lib/tenant.ts` accepterar dessutom generiskt icke-reserverade
  `<slug>.corevo.se`; testet för `freshcut.corevo.se` låser uttryckligen detta
  legacybeteende. Det kan vara en tidsbegränsad aliasväg, men får inte fortsätta
  vara källan för nya adresser.

**Krav för stängning:** en enda URL-builder och ett enda hostkontrakt ska användas
av onboarding, portal, notifieringar och smoke. Nya tenants ska alltid få
`<slug>.boka.corevo.se`; legacy-/custom-domäner ska vara explicita alias, inte en
andra kanon. Negativa tester ska bevisa att POS-reserverade root-subdomäner aldrig
blir tenants.

## 2. Provisionering till publicering

### Redan byggt

`5-Kod/apps/web/lib/platform/actions/tenants.ts` skapar tenant i
`provisioning`, settings, primär plats, roller, moduler, valfria tjänster och en
valfri ägarinbjudan. Fel i mellanleden har kompensation/rollback. Det finns också
en riktig adminväg för bekräftade platsöppettider genom
`saveLocationBookingSettings` och RPC:n `save_location_booking_settings`; den
äldre inventeringens påstående att skrivvägen helt saknas är alltså inte längre
aktuellt.

### P0 — `active` sätts innan readiness är sann

- UI:t och serveractionen tillåter noll tjänster och ingen ägare.
  `StudioPanels.tsx:487-505` markerar båda som valfria; varningstexten längre ned
  säger samtidigt felaktigt att minst en tjänst krävs.
- Skapandet lägger inte upp bokningsbar personal, `staff_services`, arbetstider
  eller bekräftade platsöppettider.
- Trots detta gör `lib/platform/actions/tenants.ts:366-393` alltid övergången
  `provisioning -> active` efter grundraderna.
- `lib/platform/tenants.ts:339` översätter `active` till **”Aktiv & publik”** utan
  readinesskontroll.
- Domänkoppling sker först därefter och fel stoppar inte framgångssvaret.
- Ingen separat serverägd `publishTenant`/readiness-commit hittades.

Detta är inte ett krav på att onboardingen måste skapa all verksamhetsdata i ett
enda formulär. Rätt modell är två faser:

1. **Provisionera:** skapa isolerat tenantskal och behåll `provisioning`.
2. **Konfigurera:** ägare, aktiv plats, minst en bokningsbar tjänst, personal,
   tjänstekoppling, bekräftade öppettider/arbetstid och kanonisk domän.
3. **Publicera:** servern verifierar readiness atomiskt/idempotent, provar den
   publika hosten och byter först därefter till `active`.

Om bokningsmodulen är avstängd ska dess readinesskrav inte gälla; readiness måste
vara modulstyrd, inte frisörspecifik.

## 3. Fyra bokningsvarianter, state, djuplänkar och flerplats

### Redan byggt

- `lib/platform/booking-variant.ts` och dess 13 tester stöder `wizard`, `compact`,
  `drawer` och `inline`.
- `components/storefront/BookingProvider.tsx` väljer presentation, medan
  `components/booking/BookingWizard.tsx` återanvänder samma bokningsmotor.
- `app/boka/actions.ts` räknar platsmedveten tillgänglighet med tjänst, personal,
  öppettider, tidszon, buffertar och framförhållning. DB-kontrakt skyddar
  bokningsintegriteten.
- `e2e/booking.spec.ts` bevisar ett vanligt wizardflöde för gäst och inloggad kund.

### P1 — en gemensam state-matris saknas

Följande är konkreta, reproducerbara kodvägar och bör stängas i ett sammanhållet
bokningsgoal:

1. **Tjänstdjuplänk + flerplats tappar steget.** En giltig `tjanst` startar på
   steg 2 (`BookingWizard.tsx:199-213`). Platsvalet nollställer tjänsten men återför
   inte `step` till 1 (`:327-337`). Efter valt läge kan wizard därför stå på
   personalsteget utan tjänst.
2. **Query-parametrarna har två dialekter.** `/boka` läser bara `personal` och
   `tjanst`, medan `UsualCard.tsx`, `StylistCard.tsx` och `FavoritesList.tsx`
   länkar med `staff` och `service`. Förvalet försvinner.
3. **Äldre slot-svar kan vinna.** `fetchSlots` (`BookingWizard.tsx:306-321`) har
   varken abortsignal eller request-sekvens; ett långsamt svar för föregående
   tjänst/personal/dag/plats kan skriva över det senaste valet.
4. **UI-fönstret ignorerar tenantens regler.** Klienten bygger alltid 90 dagar med
   browserns lokala `Date`, medan servern använder platsens tidszon och
   `max_advance_days`. UI kan erbjuda datum som alltid blir tomma eller skifta dag
   för kunder i annan tidszon.
5. **Tjänster platsfiltreras inte i klienten.** `getServices` hämtar alla aktiva
   tenanttjänster och `WizardService` saknar tjänstens `location_id`. Servern
   stoppar fel kombination, men väljaren kan erbjuda den.
6. **Kundens ombokning tappar plats.** `components/kund/RebookPanel.tsx` hämtar
   tider utan gammal `locationId`; `lib/kund/actions.ts:436-443` skapar den nya
   bokningen utan `p_location`. En flerplatsbokning kan flyttas till primär plats.
7. **Compact/inline använder endast “icke-tom kontakt” för att aktivera CTA.**
   Fältet är `type=email`, men knappen är utanför native form-submit och
   `compactReady` validerar inte format. Servern räddar datakvaliteten, men UX kan
   presentera en aktiverad knapp som bara ger serverfel.

Det finns inget browserbevis för matrisen 4 varianter × en/fler plats × normal/
djuplänk × byte under pågående slot-request. Standard-wizardens gröna E2E är inte
ett sådant bevis.

## 4. Personaladmin, behörighet och UX

### Redan byggt

- `lib/auth/admin-areas.ts` är central area-vakt; 62 tester täcker nivåer och
  personliga grants.
- `lib/admin/member-permissions.ts`, DB-kontrakt och RLS-tester ger personal
  kalender/kunder och håller systemadministration ägarstyrd.
- `lib/auth/session.ts` kräver aktiv användarprofil och, för ren personalroll,
  aktiv `staff`-koppling.
- Main navigation filtreras efter behörighet och har regressionstester.

### P1

1. `components/portal/PortalShell.tsx:342-355` visar samma fyra snabblänkar för
   alla tenantroller, inklusive **Statistik**. Målsidan kräver däremot
   `requireAdminArea('statistik')`; personal utan grant erbjuds alltså en länk som
   leder till nekad sida.
2. Tenantstatus ingår inte i sessionsauktorisationen. `session.ts` läser
   användarstatus men inte tenantstatus, och `lib/admin/tenant.ts:74` filtrerar
   bara `deleted`. En `suspended`/pausad/provisioning tenant kan därför fortsätta
   adminmutationer. Samma lucka gäller sajtpublicering.
3. `app/(personal)/personal/profil/page.tsx:35` etiketterar alla icke-ägare som
   `FRISÖR`. Det är ett konkret brott mot multi-branschregeln.
4. Goal-71 och Goal-73 väntar enligt `HANDOFF.md` fortfarande på fysisk,
   autentiserad acceptans. Det är ett releasebevis som saknas, inte skäl att skriva
   om behörighetskärnan.

## 5. Redigera sidan

### Redan byggt och verifierat

- `/admin/sida` monterar v2-studion; legacyrouten redirectar.
- `SidaStudioV2` har preview-only dirty state, sparat utkast, publicerad livevy,
  historik/restore, discard, leave guard och mobil panel-/previewväxling.
- Migration `0080_site_revisions.sql` ger ett tenantutkast, immutable historik,
  optimistic locking, RLS och atomisk publicering. Publika storefronten läser
  live-tabeller, inte utkast.
- Fokuserade revisions- och acceptanstester är gröna; Goal-70 är redan verifierat.

Ingen fristående P0/P1 hittades som motiverar ett nytt editor-goal. Det kvarvarande
P1-felet är den gemensamma tenantstatusvakten: `page.tsx:477` kan visa en pausad
preview, men `siteRevisionCtx`/`publishSiteDraft` stoppar inte servermutationen för
en icke-aktiv tenant. Det ska lösas i tenantstatus-/behörighetsgoalet och därefter
regressionstestas här.

## 6. Partner och internationalisering

### Partnerkärnan är mer komplett än inventeringen antyder

- Migrationerna 0114–0117 och `lib/platform/actions/partners.ts` har kompenserad
  partnerprovisionering, ägarinbjudan, live medlems-/statuskontroll, valfri
  licensprissättning, suspension/återaktivering, tenantflytt och scopead
  SMS-konfiguration.
- Partnerns DB-/route-/RLS-kontrakt är omfattande och fokuserade tester är gröna.
- Goal-72 behöver verklig autentiserad partneracceptans före arkivering, men någon
  ny parallell partnerkärna bör inte byggas.

### P1 för internationell lansering

Partnern lagrar `country_code`, `currency` och `timezone`, men tenantprodukten
förbrukar inte dessa som ett sammanhängande kontrakt:

- `createTenant` använder alltid `Europe/Stockholm` för primär plats.
- Bokningswizard och bekräftelse hårdkodar `sv-SE`, `SEK` och svenska strängar.
- Bokningsbetalningen i `app/boka/actions.ts` skapar Stripepris och betalningsrad
  i `sek`.
- Admin, kundportal och notifieringar innehåller många separata `sv-SE`, `kr` och
  Stockholm-fallbacks.
- Ingen tenantägd locale-/språk-/skatteprofil eller translationsstrategi hittades.

Detta är P1 för svensk förstalansering men P0 innan en första icke-svensk partner
eller tenant får säljas. Lösningen ska börja med ett litet tenantkontrakt för
locale, valuta, tidszon, moms och telefonnormalisering; därefter migreras ett
vertikalt flöde i taget. En generell “översätt hela produkten”-omskrivning är inte
ett lämpligt första goal.

## 7. Regression och releasegrindar

### Redan byggt

- `.github/workflows/ci.yml` kör disposable Supabase-migrationer och SQL/RLS,
  lint, typecheck, unit, acceptanskontrakt, multibranschguardrails, kontrast, build
  och Worker-budget.
- `.github/workflows/deploy.yml` kräver lyckad `main`-CI för exakt SHA,
  production-approval, migrationscheckpoint 0119, secretkontroller, sanktionerad
  domändistribution och post-deploy smoke.
- Fokuserad release proof och Worker-budget är gröna.

### P1

1. Full Playwright är valfri. CI-jobbet kör bara när
   `vars.E2E_ENABLED == 'true'`; release proof godkänner uttryckligen `skipped` när
   flaggan saknas (`ci.yml:167-221`). Produktion kan därmed deployas utan browser-
   E2E.
2. Den nuvarande E2E-sviten bevisar ett wizardflöde men inte fyra varianter,
   kanonisk produkthost, provisioning→publish eller flerplatsmatrisen.
   `cancel-rebook.spec.ts` skippar dessutom grönt om rätt seedbokning saknas.
3. Post-deploy `check_domains.mjs` provar fel kanon, accepterar alla svar `<500`
   och provar inget faktiskt bokningsflöde.
4. Projektets operativa sanning har driftat. `ROADMAP.md` säger att Goal-73 ännu
   inte finns och pekar på Goal-72 som nästa start, medan `HANDOFF.md` säger att
   Goal-73 är implementerat och Goal-74 är aktivt/deployat. Deploy-runbookens topp
   säger samtidigt prod 0082/krav 0083–0088, medan samma dokument och workflowen
   senare säger verifierat checkpoint 0119.

Releasegrinden ska vara fail-closed: seedad staging, obligatorisk browsermatris för
de kritiska flödena, kanonisk host-smoke och en post-deploy transaktion som minst
bevisar nåbar storefront + bokningssida. Manuella enhetsacceptanser ska vara
namngivna releaseartefakter, inte underförstådda.

## Sekventiell goal-ordning

Regeln om **ett aktivt goal åt gången** gäller. Följande nummer är föreslagna; de
ska inte skapas parallellt.

0. **Stäng befintlig kö först (ingen ny koddel):** genomför kvarvarande fysisk
   acceptans för Goal-71, Goal-72 och Goal-73; slutför Goal-74 enligt dess egen
   grind; synka därefter `ROADMAP.md`, `HANDOFF.md` och deploy-runbookens
   checkpoint. Goal-74 ligger utanför denna audits produktscope men blockerar ett
   nytt aktivt goal.
1. **Goal-75 — kanonisk storefront-origin och domänbrandvägg.** En URL-builder,
   `.boka.corevo.se` för alla nya tenants, explicita legacy/custom-alias, negativa
   POS-tester och kanonisk post-deploy smoke.
2. **Goal-76 — provisionera, readiness, publicera.** Behåll `provisioning` tills
   modulstyrd readiness och hostbevis är gröna; gör publish atomisk/idempotent och
   bevisa create→configure→publish→första bokning.
3. **Goal-77 — bokningsstate-matris.** Stäng djuplänk/plats-steget,
   query-kontraktet, latest-request-wins, tenantens datumfönster/tidszon,
   tjänstplats, ombokningsplats och compactvalidering. Browsertesta alla fyra
   presentationer utan fyra separata motorer.
4. **Goal-78 — tenantstatus och behörighets-UX.** Serverägd statusvakt för alla
   tenantmutationer, grantfiltrerade snabblänkar, branschneutrala rolletiketter och
   regression för “Redigera sidan”.
5. **Goal-79 — fail-closed releasegrind.** Obligatorisk seedad staging-E2E,
   icke-skippbara kritiska scenarier, kanonisk host-/booking-smoke och synkade
   driftartefakter.
6. **Goal-80 — tenantens regionala kontrakt.** Locale, valuta, tidszon, moms och
   E.164/telefon som serverägda tenantvärden; adapterseams i bokning, betalning och
   notifiering.
7. **Goal-81 — första internationella vertikala slicen.** Välj ett faktiskt land
   och bevisa onboarding→storefront→bokning→betalning→notifiering→partnerfaktura.
   Översätt bara de ytor som slicen kräver och utöka därefter.

“Redigera sidan” och partnerkärnan får inget eget nytt goal före detta; deras
kvarvarande fel stängs av de gemensamma status-, release- och regionaliseringsmålen.

## Verifiering utförd i auditen

- 17 fokuserade Vitest-filer: **249/249 gröna**.
- Fyra script-/domän-/releasefiler under rätt Vitest-runner: **46/46 gröna**.
- Node release proof + Worker-budget: **10/10 gröna**.
- Acceptansprober 03, 04, 06 och 07: **17 PASS, 0 FAIL**.
- En första felaktig `node --test`-start av fyra Vitest-filer föll i
  runner-importen innan tester kördes; samma filer kördes om med rätt runner och
  gav 46/46. Det var inget produktfel.

Auditen gjorde inga anrop som ändrade produktion, Cloudflare, Supabase eller annan
extern state. Den enda skapade filen är denna rapport.
