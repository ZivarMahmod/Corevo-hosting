# Goal 68 — Kundportal, PWA och kommunikation (PROGRAM-MASTER)

**Status:** FÖRBEREDD, EJ AKTIVERBAR ÄNNU
**Datum:** 2026-07-15 (v3.0)
**Typ:** Program-/epic-master. **Får inte köras som ett enda `/goal`.**
**Hård entry gate:** Goal 67 ska vara mekaniskt verifierad och flyttad till `2-Byggplan/klart/` innan Goal 68:s första bygg-goal aktiveras.

Goal 68 samlar ett stort delprojekt men exekveras enligt Corevos lag: **en avgränsad goal → oberoende verify → `klart/` → nästa goal**. Denna fil är index, beslutregister och program-DoD. Den är inte en autonom byggorder för U0–U13 i ett svep.

## Kanon och läsordning

1. `HANDOFF.md` och `2-Byggplan/ROADMAP.md` — aktuellt repo-/produktläge.
2. `1-Planering/12-claude-och-codex/00-SAMMANSTALLNING-goal-68-och-codex.md` — lösta konflikter.
3. `1-Planering/12-claude-och-codex/01-CODEX-DESIGN-kundportal-kommunikation.md` — produkt- och arkitekturkontrakt.
4. `1-Planering/12-claude-och-codex/02-CODEX-IMPLEMENTATIONSPLAN.md` — U0–U13.
5. `1-Planering/12-claude-och-codex/03-EXEKVERINGSROADMAP-goal-68.md` — vågor, testgrindar och bevisartefakter.
6. Den aktiva del-goalen — enda dokumentet som får styra aktuell implementation.

Vid konflikt vinner produktkanon, därefter sammanställningen. En konflikt som rör auth/RLS, datamodell, extern leverantör eller produktbeteende får inte gissas bort; dokumentera den som blockerare för just den del-goalen. Oberoende delar får fortsätta om de inte berörs.

## Låsta beslut

- En motor, DB och kodbas för alla branscher; aldrig tenant-/branschfork.
- `booking.corevo.se` = admin, `minbooking.corevo.se` = personal, kundportalens avsedda host = `mina.corevo.se`.
- Våg 1 är additiv på befintlig `/konto`; DNS/hostaktivering är en senare go-live-grind.
- Kundidentitet i våg 1 = `auth.uid()` + befintliga tenantbundna `customers.auth_user_id`. Ingen `customer_accounts` utan U0-bevisat behov.
- Kontaktmatchning = `public.customer_contact_hash`; aldrig namn eller en TypeScript-reimplementation.
- Bokningens DB-RPC och EXCLUDE-constraint är auktoritativa. Kommunikation är en sidoeffekt, aldrig skäl att tappa/rollbacka en bokning.
- E-post är grundkanal. Push är per enhet. SMS-interface/mock byggs först; riktig provider är en separat människogodkänd goal.
- Alla nya rolloutflaggor är av som default och ska ge dagens beteende. Exakt lagringsyta låses av U0:s KTD.
- Ingen prodmigration, proddeploy, tagg eller riktig kundtrafik utan Zivars uttryckliga besked.

## Beslutstatus som U0 måste leverera

U0 är inte en ceremoni. Den ska skapa `2-Byggplan/goals/goal-68-ANALYS.md` med fil-/radbevis och följande markerade som `LOCKED`, `DISCOVERY` eller `HUMAN-GATE`:

1. **Atomisk outbox:** exakt hur `create_public_booking` skriver `communication_events` i samma SQL-transaktion. Välj och lås ett kontrakt: uppdaterad RPC (förstahandsval om signatur/idempotens/EXCLUDE kan bevaras) eller DB-trigger. Appkod efter RPC-retur räknas inte som atomisk.
2. **Feature flags:** exakt tabell/JSON-path, defaults, global kontra tenantoverride, läs-API, cache, adminägarskap, RLS och grants.
3. **Ombokning:** faktisk säker transaktionsväg och hur event skapas utan att kringgå krockskydd.
4. **Token/länkning:** scope, TTL, replay/revocation och konservativ kontolänkning.
5. **Preview/staging:** definiera vilken icke-prod-miljö som kan ta migrationer och kod. Om ingen stagingdeploy är tillåten gäller lokal preview; stagingbevis parkeras som go-live-grind och får inte påstås vara gjort.
6. **UI-underlag:** inventera vad som kan återanvändas från `/konto` och lista vilka nya skärmar/states som saknar exakt designkanon.
7. **Migration baseline:** grep nästa lediga nummer vid start. Repot innehöll `0067_admin_customer_rows_rpc.sql` vid denna granskning; anta aldrig ett hårdkodat nummer.

U0 ska avslutas med att efterföljande del-goals korrigeras mot analysen. Ingen produktkod eller migration skrivs i U0.

## Exekveringsordning — en del-goal i taget

| Del-goal | U-enheter | Resultat | Hård startgrind | Hård slutgrind |
|---|---:|---|---|---|
| **68.0 Baseline och KTD** | U0 | Verifierad nulägesanalys och låsta kontrakt | Goal 67 verifierad/stängd | Oberoende review av fil-/radbevis; downstream-goals reviderade |
| **68.1 Ledger och dispatcher** | U1–U3 | Flaggor, kontrakt, atomisk outbox, RLS, idempotent dispatcher | 68.0 i `klart/` | DB-/RLS-/concurrency-bevis + rollback/flag-off |
| **68.2 E-post, länkning och portal-DAL** | U4–U6 | E-post via ledger, säker kontoaktivering, relations-/dashboard-DAL | 68.1 i `klart/` | Dual-path utan dubbelmejl; token- och A↔B-test gröna |
| **68.3 Central portal** | U7 | Ny portal bakom host-/featuregate | 68.2 i `klart/` **och komplett design-/acceptanspaket** | Mekanisk designacceptans 0 FAIL + routing/dataregression |
| **68.4 PWA, push och policy** | U8–U10 | Kund-PWA, per-enhet push, deterministisk kanalpolicy | 68.3 i `klart/` | Offline-/SW-/permission-/2-enhetstest + policytabell grön |
| **68.5 Översikt, säkerhet och drift** | U11–U12 | Adminöversikt, export, last, observability, full icke-prod-kedja | 68.4 i `klart/` | Full regressions-/last-/tenantisolering + dokumenterad drift |
| **Separat SMS-goal** | U13 | Riktig provider, webhook, testtrafik och kostnadsavstämning | Zivars provider/pris/avsändare/go | Providerbevis; ingår inte i Goal 68:s stängningskrav |

Skapa inte alla del-goals blint på förhand. 68.0 skapas/körs först; dess bevis bestämmer exakta filer, migrationer och kommandon i 68.1–68.5. Nästa del-goal får aktiveras först när föregående är verifierad och flyttad till rätt `klart/`-kategori.

## Gemensamt beviskontrakt för varje del-goal

Varje del-goal ska ange och leverera:

- förkrav och uttryckliga icke-mål,
- tillåtna/berörda filytor och exakt migrationskontrakt,
- TDD-scenarier: happy, nil, empty, provider-/DB-fel och samtidighet där relevant,
- negativa auth/RLS/tenanttester för varje ny exponerad datayta,
- exakta testkommandon och sparade resultat i `2-Byggplan/goals/goal-68-bevis/<del-goal>/`,
- rollbackklass: flag-off/appkompatibilitet, funktion-restore eller schema-rollback,
- oberoende reviewer: `SATISFIED`, `PARTIAL` eller `MISSING` per acceptanspunkt,
- kvarvarande HUMAN-GATE utan falskt klar-påstående.

Arbetsloggen `2-Byggplan/goals/goal-68-ARBETSLOGG.md` skapas när 68.0 startar. Nyaste entry överst och länkar till faktiska bevisartefakter. Rapporttext utan reproducerbart kommando/resultat är inte bevis.

## Globala test- och säkerhetsregler

- TDD och oberoende review-grind efter varje U-enhet; en byggare äger en arbetsenhet.
- Aldrig parallell skrivning i migrationer, auth/middleware/routing eller kommunikationskontrakt.
- DB ändras via nästa grep-verifierade, numrerade, idempotenta migration med `set search_path`, RLS och explicita grants.
- Rollbackartefakter läggs enligt repots etablerade ops-/rollbackstruktur, inte automatiskt bredvid migrationen. Destruktiv rollback kräver uttrycklig motivering; flag-off och kompatibilitet är förstahandsvägen.
- `pnpm typecheck` och `pnpm test` ska vara gröna per del-goal. `pnpm build` körs med dev-server avstängd.
- Playwright-specar hör hemma i befintlig `5-Kod/e2e/`, inte i en ny `apps/web/e2e/`-svit.
- Service worker får aldrig publikt cachea auth/private data eller köa mutationer som sedan framstålls som lyckade.
- Inga authz-beslut från `user_metadata`; inga service-role-/provider-/VAPID-secrets i klient eller service worker.
- Providerstatus och UI-copy ska bara påstå vad systemet faktiskt kan bevisa.

## Design-/acceptansgrind för 68.3

U7 får inte börja på formuleringar som “bygg mobil först” eller “återanvänd `/konto`”. Före start ska ett komplett Codex Design-paket ligga i `4-Dokument-Underlag/01-acceptans/` och omfatta minst:

- portalens appskal och tenantvy,
- 0/1/flera relationer (väljare fortsatt dold när flaggan är av),
- nästa bokning, historik, lojalitet, profil och notispreferenser,
- loading, tomt, fel, offline, expired session och nekad åtgärd,
- exakta responsive states för 360/390/768/desktop,
- mekaniska acceptanstester/probe med kravet 0 FAIL.

Paketet är lag för UI-bygget. Ingen improviserad ny design får fylla luckan.

## Människo-grindar

Följande kan förberedas men aldrig markeras utförda utan Zivar/externt bevis:

- prodapplicering av migrationer och proddeploy,
- DNS/aktivering av `mina.corevo.se`,
- riktig e-postdomän + SPF/DKIM,
- VAPID privat nyckel i secrets,
- staging-/previewdeploy om frysen även omfattar icke-prod,
- Cloudflare Workers Paid före affärskritisk trafik,
- SMS-provider, pris, avsändare och riktig trafik.

## Program Definition of Done

Goal 68 kan stängas när 68.0–68.5 var för sig är verifierade och flyttade till `klart/`, och bevis visar:

1. gästbokning utan konto överlever kommunikationsfel,
2. bokning och kommunikationsevent skapas atomiskt utan tappade event,
3. e-post går via beständigt event/attempt utan dubbelsändning,
4. kontolänkning och central DAL är token-/auth-/tenant-säkra,
5. portalens UI matchar designpaketet med mekaniskt 0 FAIL,
6. kund-PWA är installerbar och ärlig offline,
7. push fungerar per enhet och permanent endpointfel isoleras,
8. kanalpolicy skiljer transaktionellt, marknadsföring och `manual_attention`,
9. ägaren ser sann status och härledbart exportunderlag,
10. last/retry/dubbelklick/webhookdublett ger inga tappade eller dubbla bokningar/utskick,
11. arkitektur-, drift- och manuella testdokument ligger i mapparna som `AGENTS.md` anger,
12. kvarvarande människo-/go-live-grindar är ärligt listade.

Riktig SMS-provider ingår inte i detta stängningskrav. Goal 68 ska däremot lämna ett testat, avstängt providerinterface och kostnadskontrakt som den separata SMS-goalen kan ansluta till.

## Aktiveringsprompt — endast för första del-goalen

Aktivera inte denna program-master. När Goal 67 är verifierad/stängd ska en separat `goal-68-0-baseline-och-ktd.md` skapas från U0 + denna fils avsnitt **Beslutstatus som U0 måste leverera**. Kör därefter bara den del-goalen.

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 3.0 | 2026-07-15 | Gjord om från autonom mega-goal till program-master; sex verifierbara leveransvågor; Goal 67-entry gate; atomisk outbox-KTD; staging-/beviskontrakt; designacceptans före U7; SMS separerad. |
| 2.0 | 2026-07-14 | Tidigare autonom master för Fas A–H (ersatt eftersom den motsade kanonens sex-goal-split och repo-regeln en goal i taget). |
