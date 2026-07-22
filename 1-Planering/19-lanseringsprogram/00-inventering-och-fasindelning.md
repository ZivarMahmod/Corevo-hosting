# Lanseringsprogram — inventering och fasindelning

**Datum:** 2026-07-21
**Status:** aktiv systemkarta; uppdateras när varje spår har fått verifierat mål
**Kanon:** `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`
**Arbetsbranch:** `codex/launch-inventory-customer-design` från aktuell `origin/main`

## 1. Syfte

Den här kartan bryter ned vägen från dagens Corevo till en lanseringsbar helhet. Den ersätter inte befintliga goal-filer och flyttar inte pågående goals. Den visar beroenden, verifierade nulägesfakta, blockerare och i vilken ordning nya verifierbara arbetspaket ska öppnas.

Corevo är en generell multi-branschplattform. Frisörscenarier används som första kommersiella bevis, aldrig som datamodellens definition.

## 2. Baslinje

### 2.1 Git och arbetsyta

- Root-worktreet innehåller användarens lokala ändringar i bokning/tidszon samt två otrackade research-/SMS-mappar. De har inte ändrats, städats eller flyttats av lanseringsarbetet.
- Inventering och design ligger i det isolerade worktreet `.worktrees/pin-booking-sim-fallback`.
- Branchen utgår från `origin/main`; tidigare PIN/SMS-fix är redan mergad.
- Ingen produktionsdeploy eller databasmutation görs i inventerings-/designfasen.

### 2.2 Automatisk baslinje

Kört från `5-Kod` på den rena branchen:

| Kontroll | Resultat |
|---|---|
| `pnpm test` | PASS — 272 testfiler, 2 199 tester |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 fel, 7 befintliga varningar |
| `pnpm build` | PASS — full Next/Turbo-build |

Detta är regressionsbaslinjen. En senare förändring är inte klar förrän minst samma kontroller är gröna och spårets egna tester har lagts till.

## 3. Övergripande beroendekarta

```text
Sann onboarding + canonical domän
              │
              ├──> korrekt tenant/plats/tjänst/personal/schema
              │                     │
              │                     └──> faktisk tillgänglighet i bokningsmotorn
              │                                      │
SMS/PIN/outbox ──────────────────────────────────────┤
                                                     ▼
                                      verifierad bokning + customer_id
                                                     │
                                                     ▼
                                      SMS-länk + lösenordsfri kundportal
                                                     │
                                                     ▼
                                      PWA, historik, avbokning, boka igen

Roll/RLS/tenant-isolering skyddar varje pil ovan.
Cloudflare/host-routing måste göra varje publik dörr stabil.
```

## 4. Nuläge per område

### 4.1 Kundportal och PWA

#### Verifierade fakta

- Nuvarande `/konto` är ett tenantbundet Supabase Auth-konto med e-post/lösenord på tenantens storefront-host.
- Routes finns för `/konto`, bokningsdetalj, profil och beställningar.
- `/konto/koppla/[token]` är det gamla account-claimflödet och konsumerar claim under GET-rendering efter vanlig auth.
- Befintlig claimmodell har bra principer: stark slump, endast digest i DB, tenantbindning, expiry och single-use.
- Nuvarande kundmanifest startar på `/konto`, har scope `/` och återanvänder personalikoner.
- `kund-sw.js` hanterar push men inte säker offlinecache eller den nya portalens djuplänkar.
- `booking.corevo.se` är redan ägar-/personaladmin. Den kan inte samtidigt vara kundportalens dörr.
- Befintligt designpaket 05 visar `MINA.COREVO.SE`, men hostkind/routing för `mina.corevo.se` finns inte i implementationen.
- Nuvarande notifieringsleverans prioriterar `accountClaimUrl` framför bokningshanteringslänk.
- Paket 05 är inte byggt och blandar lanseringsbara bokningsvyer med senare global konto-/lojalitetsarkitektur.

#### Beslut

- Ny v1 använder `mina.corevo.se`, hostlåst lösenordsfri session och tenantbunden kundrelation.
- Bokning stannar på tenantens publika sida.
- Global `Mina företag`, vanlig login, lojalitet, webshop, erbjudanden och push hålls helt inaktiva i v1.
- Gammal `/konto`-kod bevaras bakom ett explicit legacyläge.
- Full designbrief finns i `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md`.

#### Kritiska luckor

- magic-link/sessionmodell för den nya dörren;
- customer-host route firewall;
- tokenfri bootstrap som tål länkscanners;
- portal-DAL/RPC med tenant + customer + session som obligatoriskt kontrakt;
- nytt neutralt manifest och installeringsmaskin;
- notifieringslänk/copy;
- full GDPR-export för durable customer-relation;
- portaltester för cross-tenant, session, mutation och PWA.

### 4.2 PIN, SMS och notifieringar

#### Verifierade fakta

- Migrationerna `0118_pin_booking_verification.sql` och `0119_fix_pin_claim_builtin_expressions.sql` finns på aktuell main.
- PIN-bokningen använder challenge, slot hold, outboxleverans och atomisk finalisering.
- Den tidigare felaktiga kvalificeringen av `coalesce`/`least`/`greatest` är rättad och mergad.
- `notifications_outbox` är den kanoniska beständiga kön.
- Giadas lokala SMS-gateway och modemspår finns utanför den rena produktbranchen och ska granskas som egen provider, inte som en andra bokningskö.
- Provider, SIM, modem och sender-id får inte hårdkodas i bokningsdomänen.

#### Kvar att verifiera/bygga

- end-to-end providerkoppling från Corevos outbox till Giada;
- health/circuit/queue-age och direkt fallback till e-post;
- idempotens och DLR-korrelation vid provider-/modembyte;
- tenant-/sender-policy utan att skapa en separat kö per tenant;
- verkliga testfall för confirmation, reminder, change, cancellation, portal/PIN och framtida massutskick;
- nätverksprioritet så modem aldrig tar default route från Giadas LAN;
- secrets, rotation, canary och production gates.

### 4.3 Bokningsmotor och fyra lägen

#### Verifierade fakta

- De fyra verkliga presentationsvarianterna är `wizard`, `compact`, `drawer` och `inline`.
- De motsvarar två innehållsmotorer: `wizard`/`drawer` använder stegflöde; `compact`/`inline` använder enskärmsflöde.
- Multi-location-gaten och deeplink-state kan hamna ur synk: giltig `?tjanst=` startar senare steg, platsgaten rensar tjänsten men återställer inte steget. Resultatet kan bli blankt flöde.
- Kundportalens/favoriters länkar använder `?service=`/`?staff=`, medan `/boka` läser `?tjanst=`/`?personal=`. Förval fungerar därför inte.
- Publika tjänstekort öppnar oskopad bokning trots kodkommentarer om förvald tjänst.
- Kundombokning skickar inte `p_location`; en bokning på icke-primär plats kan därför ombokas via primär plats.
- Ombokningspickern är begränsad till 14 dagar och saknar platsval.
- Compact/inline kan aktivera bokningsknappen utan e-post trots att nuvarande serveraction kräver e-post; fälten ligger inte i ett form som ger native e-postvalidering.
- Slotrequests saknar abort/request-version. Ett långsamt äldre svar kan skriva över slots för ett nyare service-, personal-, datum- eller platsval.
- Kalenderns 90-dagarsfönster byggs i besökarens browser-tidszon i stället för platsens tidszon och ignorerar platsens konfigurerade `max_advance_days`.
- Kalenderns tillgänglighetsprickar är hårdkodade för alla dagar i fönstret och betyder inte att det finns en verklig slot.
- Platsval filtrerar personal men inte platsspecifika tjänster; fel tjänst kan därför visas tills motorn avslår den.
- Gästmejl säger `Avboka eller ändra`, men gästrouten kan endast avboka.
- En riktad read-only testkörning gav 111/111 PASS men täcker inte korsflödesfynden ovan.

#### Kritiska luckor

- en kanonisk state machine för val och tillbaka-navigation;
- exakta URL-parametrar och kompatibilitetsalias;
- invalidation när plats/tjänst/personal ändras;
- avbryt/versionera asynkrona slotrequests;
- styr kalenderdatum i platsens tidszon och från verkliga platsregler;
- multi-location och resource constraints i alla fyra varianter;
- verklig ombokning med plats, hold, konflikt och notifiering;
- scenario-E2E över mobil/desktop, deeplink, flera tjänster/personal/platser och fullbokning.

### 4.4 Personaladmin och ägaradmin

#### Verifierade fakta

- Rollupplösning, partnergränser, personliga grants och många server-/RLS-kontroller är mogna.
- Personal har verkliga flöden för egen/delegerad kalender, walk-in, status, av-/ombokning, kundkort, egna frånvaroansökningar, notiser och konto.
- Ägaradmin är den kanoniska konfigurationsytan för tjänster, personal, platser, scheman och storefront.
- Personal kan inte själv ändra arbetstider, tjänstekoppling, plats eller aktivering; det är i huvudsak avsiktlig rollgräns.
- Personalprofilen hårdkodar etiketten `FRISÖR` och bryter multi-branschkontraktet.
- Quick actions kan visa `Statistik` för staff utan rätt grant och leder då till nekad sida.
- En pausad tenant blockeras inte konsekvent från admin trots UI-text som påstår det.
- Manuell ägar-/personalacceptans för befintliga goals återstår på riktiga enheter.

#### Kritiska luckor

- sanningsenlig matris sida × roll × serveraction × RLS;
- konsekvent mobilnavigation och fel-/denied-state;
- samma produktkänsla utan att ge personal ägarfunktioner;
- tenantstatus som faktisk servergrind;
- multi-branschtermer i personalytan;
- riktiga URL-försök mot otillåtna ägarroutes i E2E.

### 4.5 Onboarding: ny kund till publicerad tenant

#### Verifierade fakta

- Aktuell Studio går: bransch → namn/subdomän → tema → moduler → ägare → granska/lansera.
- Det finns ingen lead/prospect-pipeline; handoffpunkten är `/kunder/ny`.
- `createTenant` skapar flera objekt sekventiellt och sätter till sist alltid `tenant.status=active`, även utan komplett owner/service/schema/domän-readiness.
- Ägare är valfri, men en ägarlös tenant saknar fungerande efterhandsinbjudan till ägarroll.
- Plattformen kan skapa tjänst, personal, tjänstekoppling och arbetstid men saknar skrivväg för bekräftade platsöppettider. DB-invarianten kan därför blockera personalaktivering.
- Canonical storefront enligt arkitektur är `<slug>.boka.corevo.se`; wildcard-routen finns.
- Onboarding, kundkort och flera URL-builders visar i stället `<slug>.corevo.se`, som kräver en separat Cloudflare-route.
- UI-copy påstår på flera ställen att tjänst, ägare, domän eller lansering är klar när det inte behöver vara sant.
- Custom domains kan hanteras i produktion, trots att onboardingcopy säger att de är låsta.

#### Kritiska luckor

- skilj `skapad/provisioning` från `publicerad/active`;
- en serverägd `publishTenant` med verklig readiness;
- canonical `.boka.corevo.se` i all produktcopy och alla builders;
- obligatoriskt beslut om ägare och vertikal;
- operatörsvy för platsöppettider och samma readiness-kontrakt som ägaradmin;
- ett sammanhängande E2E: create → invite → configure → publish → HTTP smoke → första bokning.

### 4.6 Cloudflare och domäner

#### Verifierade fakta

- `*.boka.corevo.se/*` finns i `wrangler.jsonc` och är den skalbara canonical tenant-routen.
- Tenantunika `<slug>.corevo.se`-routes är inte automatiska i normal onboarding.
- Custom-domainprovisionering är ett separat flöde och ska inte blockera canonical launch.
- Fasta infrahosts måste återassertas vid deploy.
- `mina.corevo.se` behöver en egen hostkind, route och deploy-smoke innan kundportal går live.

#### Kritiska luckor

- en enda URL-builder per hosttyp;
- collision/reservation för alla infrahosts, inklusive `mina`;
- host-firewall och redirectkontrakt;
- smoke för canonical tenant, customer portal, admin, staff och superadmin;
- dokumenterat byte av custom domain utan data-/tenantförlust.

### 4.7 Partner och internationalisering

#### Verifierade fakta

- Partneridentitet revalideras mot live DB; claims används inte ensamt som behörighet.
- Partneråtkomst till tenants använder servergrindar/RLS och begränsar root-only-ytor.
- Plattformen har redan partner-, tenant-, timezone- och flera lokaliseringsbyggstenar.

#### Kvar att inventera djupare

- provision/ersättningslivscykel;
- avslutat partnerskap och överlämning;
- locale/currency/tax per tenant/location;
- phone normalization och SMS-regler per land/provider;
- översättningsstrategi för storefront, bokning, notifiering och portal;
- export, dataskydd och supportansvar per marknad.

## 5. Prioriterad fasordning

### Fas A — sanning och säker grund

1. Frys designspec och acceptanspaket för lösenordsfri portal.
2. Rätta canonical storefrontdomän i URL-builders och onboardingcopy.
3. Separera provisioning från publicering.
4. Frys bokningsmotorns state-/URL-kontrakt och säkra deep links/tillbaka-navigation med tester.
5. Slutför providergränsen för SMS utan att röra booking/outbox-sanningen.

### Fas B — första kompletta bokningsrelationen

1. Konfigurera tenant med ägare, plats, öppettider, tjänst, personal, koppling och schema.
2. Publicera genom en verifierad servergrind.
3. Visa riktiga tider i samtliga relevanta bokningsvarianter.
4. PIN-verifiera och skapa bokning atomiskt.
5. Leverera bekräftelse genom aktiv kanal.

### Fas C — lösenordsfri kundportal/PWA

1. Customer host/firewall.
2. Magic-link + session + recovery.
3. Tenantbunden portal-DAL och bokningsdetalj.
4. Avbokning, kalender och boka igen.
5. Profil, telefonbyte, enheter och logout.
6. PWA-installation Android/iOS.
7. Cross-tenant, accessibility och browser-E2E.

### Fas D — ägare och personal färdiga i vardagen

1. Sid-/behörighetsmatris.
2. Kvarvarande staff UX/termer/routes.
3. Pausad tenant server-side.
4. Riktig mobilacceptans.
5. Onboardinghandoff och driftchecklistor.

### Fas E — skalning

1. Custom domains.
2. Partnerlivscykel och provision.
3. Fler språk/länder/valutor/tidszoner.
4. Framtida global kundidentitet och `Mina företag` som separat, explicit release.
5. Push, lojalitet, erbjudanden och appspår först efter egna samtyckes-/produktbeslut.

## 6. Grindar mellan faserna

En fas får inte öppna nästa produktionssteg förrän:

- relevanta enhets-/integrationstester är gröna;
- tenant- och rollisolering är verifierad;
- UI-copy motsvarar faktisk backend;
- mobil och desktop är visuellt kontrollerade;
- failure states är testade, inte bara happy path;
- ingen produktion eller riktig kunddata behöver manipuleras manuellt för att flödet ska fungera;
- drift-/rollbacksteg är dokumenterade;
- kvarvarande begränsningar är synliga i plan och inte gömda i kodkommentarer.

## 7. Ofrysta beslut

Följande kräver senare affärsbeslut innan respektive release, men blockerar inte designarbetet nu:

- om ägare alltid ska vara obligatorisk i onboarding eller kunna bjudas in säkert efteråt;
- exakt kommersiell SMS-modell per tenant när direktoperatörsavtal finns;
- när global kundidentitet ska aktiveras och hur befintliga tenantrelationer länkas;
- vilka marknader, valutor och skatter som prioriteras först;
- om Corevo ska äga en leadpipeline eller använda extern CRM före `/kunder/ny`.

## 8. Nästa konkreta leverabler

1. Claude Design/Fable 5 skapar acceptanspaketet från den nya kundportalbriefen.
2. En oberoende granskare verifierar designen mot funktion, data, säkerhet, mobil och WCAG.
3. Designspec/designpaket justeras tills noll blockerande avvikelser återstår.
4. Därefter skapas ett enda aktivt implementation-goal för kundportalens första vertikala slice: host → link exchange → session → en ägd bokning.
5. Övriga lanseringsspår bryts därefter ned i separata goals enligt fasordningen, utan parallella skrivningar i samma kodytor.
