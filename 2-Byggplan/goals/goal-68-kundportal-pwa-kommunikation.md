# 68 — Goal: Corevos kundportal, PWA & kommunikationsarkitektur

**Datum:** 2026-07-14
**Typ:** Autonom byggorder för Claude Code / Codex — körs via `/goal`.
**Vad detta är:** Den enda ingångspunkten för delprojektet. Läs HELA filen först, innan du rör kod.
**Omfattning:** Stort, sammanhängande delprojekt i **7 faser**. Byggs i **fasordning, en fas i taget, en commit per punkt**. Detta är inte ett kvällsbygge — F1 är enbart analys, ingen kod.

> **Läs detta först:** Goal 67 och tidigare kalenderarbete är i princip färdigt. Behandla detta som ett **nytt delprojekt ovanpå** det befintliga Corevo-systemet — inte som en fortsättning där du förväntas känna till gamla muntliga beslut. Men bygg inte blint efter föreslagna tabell- eller katalognamn: projektet har redan motsvarande strukturer. **Återanvänd, utöka och förbättra** det som finns. Sektionen *"Beslut som redan är fattade"* mappar varje föreslaget namn mot verkligheten — den är kärnan i den här briefen.

---

## Utgångsläge — var projektet faktiskt står (verifierat, inte antaget)

- **Goal 67 är klart och pushat till `main`:** kalender/kund-admin L1+L2, statistiksida, personalfärger, månadsvy, `no_show`, roller, belastningstest (krockskyddet håller). ~1038 enhetstester gröna, `tsc` rent.
- **⛔ Deploy-frys AKTIV:** Zivar har sagt **STOPP**. Bygg lokalt. Kör **en** dev-server (`npx next dev -p 3111`). Kör **aldrig** `next build` medan dev-servern är uppe (delad `.next` → cache-korruption `MODULE_NOT_FOUND ./NNNN.js`). **Ingen push, ingen tagg, ingen deploy förrän Zivar uttryckligen säger till.**
- **Migrationer:** högst applicerad = `0062_staff_color`. `0063` är en no-op. `0064` (idempotens-fix) är **skriven men EJ applicerad** — väntar Zivars ok. Nästa lediga nummer = **0065** (grep-verifiera innan du tar ett nummer; repot för ingen `supabase migration list` — schemat i prod ÄR sanningen).
- **DB-sanning:** Supabase-projekt `clylvowtowbtotrahuad` (PG17). **ALDRIG** `ygieacwrpevytghdxecd` (fel-connector-fällan).
- **RLS:** ALLA tabeller har `rls_enabled=true`. Tenant-isolering sker via `private.tenant_id()` — **RÖR EJ**. Varje ny tabell MÅSTE ha egen RLS.
- **Stack:** Next.js (`5-Kod/apps/web`, `app/(admin)`), Supabase (numrerade migrationer + RLS), Cloudflare, pnpm, `@corevo/db`-typer.
- **Bokning:** all bokning går genom `create_public_booking`-RPC:n. Krockskydd = DB:ns EXCLUDE-constraint (bevisat i belastningstest). Ingen gräddfil.
- **PWA finns redan:** admin-kalendern är installerbar (manifest + service worker). Kundportalens PWA ska **återanvända** det mönstret, inte forka ett andra.

---

## Uppdraget

Bygg grunden för:

1. Ett **centralt, globalt kundkonto** på `minbokning.corevo.se`.
2. **Automatisk koppling** kundkonto ↔ företag ↔ bokningar (kunden ska aldrig koppla manuellt).
3. En **installerbar PWA**.
4. **Web Push**-notiser (flera enheter per konto).
5. Fungerande **bokningskommunikation via e-post** (grundkanalen).
6. En **kanalneutral kommunikationsmotor** där SMS kan anslutas senare utan att bokningslogiken skrivs om.
7. Datamodell som **stödjer flera Corevo-företag per globalt konto** — men funktionen är **dold bakom en flagga**.
8. En **administrativ kommunikationsöversikt** (utskick nu, SMS-kostnad senare).

**Produktprincipen som styr allt:** kunden ska **inte** behöva skapa konto innan en bokning. Det publika bokningsflödet måste förbli snabbt. Kontot erbjuds **efter** bokningen, via en säker länk i bekräftelsemejlet, och kopplas automatiskt till rätt kund och bokning.

```
Hemsida → bokar utan konto → bokning sparas → bekräftelsemejl med säker länk
→ ser/hanterar bokningen → erbjuds konto → kontot kopplas automatiskt
→ installerar PWA → aktiverar push
```

**Byggnadsregel nummer ett:** bokningen får **aldrig** misslyckas eller försvinna för att e-post eller push inte fungerar. Kommunikation är alltid asynkron och sidoordnad kärnflödet.

---

## Autonomi-regler

- Du fattar **alla tekniska val själv** — fråga aldrig droppvis. En komplett brief betyder att du inte ska behöva stanna.
- **En commit per punkt.** Verifiera + testa grönt före nästa punkt.
- Genuint mänskliga steg (DNS, SMS-leverantör, secrets) är **batchade** längst ned — de blockerar aldrig bygget, du väntar aldrig på dem.
- **Databasändringar bara via numrerade, idempotenta migrationer** med rollback-fil bredvid, `set search_path`. Grep nästa lediga nummer (≥ 0065).
- **RLS på varje ny tabell** — följ det befintliga `private.tenant_id()`-mönstret; för globala/kundägda tabeller, fence på `auth.uid()` → `customer_accounts`.
- `pnpm build` (eller `tsc --noEmit`) + hela testsviten + bransch-vakten **grön före varje commit**.
- **INGEN deploy under frysen.** Allt demonstreras i den lokala miljön. Push/tagg/`wrangler` sker först när Zivar häver frysen.
- Skriv en **arbetslogg** (`goal-68-ARBETSLOGG.md`, nyaste överst) efter varje avslutad fas: vad byggdes, vilka filer, vilka migrationer, vilka tester, vad flaggas till Zivar.

---

## Beslut som redan är fattade — stanna INTE för dessa

Prompten nedan föreslår generiska namn. Projektet har redan motsvarigheter. **Detta är facit — bygg mot det, inte mot de föreslagna namnen.**

| Prompten föreslår | Verkligheten i Corevo | Regel |
|---|---|---|
| `business` / `business_id` | Befintliga `tenants` / `tenant_id` | Skapa **aldrig** en `businesses`-tabell. `tenant_id` är isoleringsnyckeln överallt. |
| `business_customers` (företagsspecifik kundpost) | Befintliga **`customers`** (tenant-scoped: `contact_hash`, `auth_user_id`, dedup via `merged_into`) | **Utöka `customers`** — skapa ingen parallell tabell. |
| `customer_accounts` (globalt konto) | **Finns inte** — genuint ny nivå | Se nästa punkt. |
| `business_branding` | Befintlig **`tenant_settings.branding:jsonb`** | Utöka jsonb-fältet. Skapa egen tabell bara om jsonb bevisligen inte räcker. |
| Feature flags | Befintligt modul-system **`modules` / `tenant_modules`** (`state`, `config:jsonb`) + kolumnflaggor (`customers.self_book`) | **Inventera först.** Bygg inte ett andra flaggsystem. |
| Lojalitet | Befintlig **`loyalty_ledger`** (append-only, summeras över merge-kedjan) | Kundportalen **läser** den. Bygg aldrig om den. |

**Den genuint nya arkitektur-biten — läs noga:**
Idag är kundidentiteten **tenant-scoped**: `customers.auth_user_id → users`, och `users` bär `tenant_id NOT NULL`. En inloggad kund hör alltså till **ett** företag. Kundportalen kräver en identitet som spänner **över** företag (`minbokning.corevo.se`). Det är den enda strukturellt nya nivån:

```
auth.users  (global inloggning)
     │
     ▼
customer_accounts        ← NY: global identitet, en per person, verifierad e-post/telefon
     │  (customer_business_links: konto ↔ tenant ↔ customers-rad, link_status, verified_at)
     ▼
customers  (BEFINTLIG, tenant-scoped kundpost — utökas, inte ersätts)
     │
     ▼
bookings   (BEFINTLIG)
```

Bygg `customer_accounts` som en **ny nivå ovanpå** `customers`. Riv inte tenant-modellen. En tenant ska bara se sin egen `customers`-rad och sina egna länkar — aldrig vilka andra Corevo-företag ett globalt konto är kopplat till.

**Fler låsta beslut:**
- Kontakt-matchning använder **`public.customer_contact_hash`** (tenant-saltad SHA256). Matcha **aldrig** på namn ensamt. Återimplementera **aldrig** hashen i TS (det är driften goal-22/goal-41 uttryckligen förbjuder).
- Konservativ sammanslagning: vid osäkerhet, **behåll separata kundposter** tills kopplingen verifierats. Följ `merged_into`-tombstone-mönstret från goal-41 — `loyalty_ledger` rörs aldrig, poäng summeras via läs-pathen.
- Signerade bokningslänkar: **inte** ett rått boknings-ID som ensam autentisering. Signerad, svårgissad, tidsbegränsad, återkallbar, kopplad till rätt bokning **och** rätt tenant. Spara hash av token-värdet, inte klartext.
- SMS **byggs inte** mot riktig leverantör i denna fas — bara interface + avstängd mock.
- `minbokning.corevo.se`-funktionen för flera företag är **avstängd** initialt (`customer_multi_business_hub = false`): ingen företagsväljare, ingen "Mina företag"-meny, ingen katalog. FreshCut-kunden ser bara FreshCut.

---

## Faserna — bygg i ordning, en fas i taget

Varje fas har **Mål**, **Bygg** och en **Klar när**-checklista (kontraktet — varje kryssruta ska gå att verifiera objektivt).

### F1 — Projektanalys & plan *(ingen kod ännu)*

**Mål:** förstå den befintliga arkitekturen på riktigt innan något byggs, och anpassa planen efter den.

**Bygg (analys):** inventera och dokumentera nuläget för: frontendstruktur, autentisering, Supabase-konfig, `customers`/`bookings`/`tenants`-schemat, hur tenants identifieras, befintlig RLS, e-posthantering, Edge Functions/Workers, modul-/flaggsystemet (`modules`/`tenant_modules`), roller/behörigheter, `loyalty_ledger`, API-routes, ev. befintlig service worker/manifest, domän- och routinglogik.

**Klar när:**
- [ ] `goal-68-ANALYS.md` finns med: (1) vad som redan finns, (2) vad som kan återanvändas, (3) vad som måste förändras, (4) risker & migreringar, (5) föreslagen implementation i steg, (6) vad som kan köras parallellt.
- [ ] Analysen bekräftar eller korrigerar mappnings-tabellen i *"Beslut som redan är fattade"* mot faktisk kod (namnger fil + rad för varje befintlig struktur).
- [ ] Ingen kodändring gjord i F1.

### F2 — Domän & databas

**Mål:** den globala identiteten, kopplingarna, signerade länkar, push-prenumerationer, kommunikationslogg och flaggor — med tenant-isolering bevisad av negativa tester.

**Bygg:**
- Migration(er) ≥ 0065, idempotenta + rollback: `customer_accounts`, `customer_business_links`, `push_subscriptions`, `communication_events`, `communication_attempts`, `notification_templates`, signerad-länk-tabell (token-**hash**, tenant, bokning, giltighetstid, revoke). Utöka `customers`/`tenant_settings` där mappningstabellen säger det.
- RLS på varje ny tabell. Globala/kundägda tabeller fence:as på `auth.uid() → customer_accounts`; tenant-tabeller på `private.tenant_id()`.
- Feature-flaggor via det befintliga systemet: `customer_portal_enabled`, `customer_account_creation_enabled`, `pwa_install_enabled`, `web_push_enabled`, `customer_multi_business_hub` (av), `sms_enabled` (av), `communication_dashboard_enabled`, `loyalty_portal_enabled`, `native_app_ready`. Styrbara per miljö och per tenant.

**Klar när:**
- [ ] Varje ny tabell finns i prod-schemat (`information_schema`-koll returnerar rad), är idempotent, har rollback-fil.
- [ ] `push_subscriptions` är en **separat tabell** (flera enheter per konto), inte ett fält på kunden.
- [ ] Signerad länk ger tillgång till **exakt en** bokning, är tidsbegränsad och återkallbar; klartext-token lagras aldrig.
- [ ] **Negativa säkerhetstester passerar:** kund A når inte kund B; tenant X når inte tenant Y:s `customers`/bokningar/lojalitet/kommunikation; token för bokning A öppnar inte bokning B; manipulerat `tenant_id` kringgår inte RLS.
- [ ] Flaggorna finns och `customer_multi_business_hub` läser `false`.

### F3 — Kommunikationsmotor

**Mål:** kanalneutral motor. Bokningskoden innehåller **ingen** leverantörslogik.

**Bygg:** domänhändelser (`appointment.created/rescheduled/cancelled_by_*/reminder_due`, `customer.account_created`, `loyalty.points_added`) → central **policy-resolver** → providers bakom ett gemensamt `CommunicationProvider`-interface. E-post + push implementeras nu; SMS = interface + avstängd mock. Köer, kontrollerade återförsök, idempotens-nycklar, loggning till `communication_attempts`.

**Klar när:**
- [ ] En bokning skapar en `communication_event`; motorn översätter den till rätt kanaler enligt policyn (e-post alltid vid giltig e-post; push om aktiv prenumeration; SMS av).
- [ ] E-post- och push-provider skickar på riktigt (lokalt/mot testläge); SMS-providern är en mock som loggar men inte skickar.
- [ ] Bokningen överlever att en provider är nere (bevisat i test): bokningen finns, kunden får bekräftelsesida, felet loggas, försök görs igen.
- [ ] Idempotens: samma `request_id`/idempotency-key ger aldrig dubbelt mejl/dubbel push/dubbla poäng.
- [ ] Statusmodellen skiljer `queued/provider_accepted/sent/failed/expired/clicked` — inget påstås som "läst" utan bevis.

### F4 — Kundportal

**Mål:** enkel, mobil-först portal på `minbokning.corevo.se`. När multi-business är av öppnas FreshCuts vy direkt, utan väljare.

**Bygg:** routes (anpassa till routern): `/`, `/login`, `/register`, `/verify`, `/bookings`, `/bookings/:id`, `/loyalty`, `/notifications`, `/profile`, `/business/:tenantId`, `/manage/:token`. Startsidan prioriterar: **nästa bokning** → snabbåtgärder (omboka/avboka/kontakta/lägg i kalender) → lojalitet → historik → påminnelse-status. Tenant-branding från `tenant_settings.branding`. Kontoaktivering från den signerade länken kopplar `auth.users → customer_accounts → customers → bookings`.

**Klar när:**
- [ ] En gäst kan öppna den säkra länken och se/av-/omboka enligt företagets regler utan full inloggning.
- [ ] Konto skapat via länken kopplas automatiskt till rätt `customers`-rad och visar direkt rätt kommande bokningar, historik och lojalitet.
- [ ] Om-/avbokning går genom `create_public_booking`-vägen och respekterar krockskyddet.
- [ ] Portalen bär rätt tenant-branding (logo, namn, accentfärg, kontakt).
- [ ] Med `customer_multi_business_hub = false` finns ingen företagsväljare och ingen "Mina företag"; endast det öppnade företaget syns.

### F5 — PWA

**Mål:** `minbokning.corevo.se` installerbar; push aktiveras av kunden själv.

**Bygg:** manifest (namn, ikoner, theme/bg, start-URL, standalone), service worker (versionshantering, säker uppdatering, offline-appskal + fallback), kontrollerat install-flöde (erbjuds efter tydligt skäl, inte vid sidladdning; separata instruktioner iOS/Android/desktop), push-behörighet bakom egen förklaring (inte vid load), prenumerations-livscykel (`unsupported/not_requested/prompt_available/granted/denied/subscription_active/expired/revoked`).

**Klar när:**
- [ ] PWA:n installerbar på stödda enheter; install-prompten visas **inte** aggressivt vid load.
- [ ] Kunden aktiverar push själv efter egen förklaringsruta; browserns dialog triggas först på klick.
- [ ] Flera prenumerationer per konto fungerar; en utgången/återkallad prenumeration hanteras utan att slå ut kundens övriga enheter.
- [ ] Offline visar aldrig gammal bokningsdata som aktuell — allt offline-innehåll är märkt som senast synkat; av-/ombokning kan aldrig se lyckad ut offline utan serverbekräftelse.

### F6 — Administrativ kommunikationsöversikt

**Mål:** första ägar-vyn över utskick. Underlag för framtida SMS-fakturering.

**Bygg:** vy (under statistik/kommunikation/inställningar enligt befintlig IA) som visar e-post (skickade/lyckade/misslyckade/väntande), push (skickade/misslyckade/öppnade när mätbart/aktiva/utgångna prenumerationer/andel med push), SMS-grunden (avstängd, men framtida antal/segment/kostnad synliga), samt viktiga fel (kritiska misslyckade utskick, kunder utan fungerande kanal, utgångna prenumerationer, studsad e-post).

**Klar när:**
- [ ] Vyn läser `communication_attempts` och visar korrekta räknare per kanal.
- [ ] Formuleringen är ärlig: "Push accepterad av push-tjänst"/"Push öppnad", aldrig "Kunden har sett" utan bevis.
- [ ] SMS-sektionen visas som avstängd med plats för framtida kostnad/segment.

### F7 — Kvalitetssäkring

**Mål:** bevisa att helheten håller.

**Bygg/kör:** enhetstester (policy, kundmatchning, tokenvalidering, tenant-behörighet, flaggor, fallback), integrationstester (anonym bokning → e-posthändelse → konto via länk → koppling → rätt bokningar; push sparas/utgår; attempt loggas), säkerhetstester (kund/tenant-isolering, token-korsning, manipulerat `tenant_id`), samtidighet/last (dubbelklick boka, samma idempotency-key, dubbla köleveranser, provider nere, flera enheter), UX-granskning, död kod bort.

**Klar när:**
- [ ] Alla nya tester gröna; hela sviten grön; `tsc` 0; bransch-vakt 0 nya.
- [ ] Negativa säkerhetstesterna från F2 ingår i sviten och passerar.
- [ ] Den lokala miljön demonstrerar **hela** flödet (gäst-bokning → mejl → länk → konto → portal → push).

---

## Batchade uppföljningar — kräver människa, blockerar inte bygget

Bygg runt dessa; lämna dem namngivna åt Zivar. Väntar aldrig på dem.

- **SMS-leverantör** (t.ex. 46elks/Twilio) — pris/segment/kostnadsmodell. Interface + mock byggs nu; riktig koppling är ett senare ägar-beslut.
- **`minbokning.corevo.se`** — DNS/Cloudflare-route (kan mockas lokalt via hosts/env under bygget).
- **VAPID-nycklar** för Web Push — generera par; Zivar lägger privat nyckel i secrets.
- **Transaktionsmejl** — avsändardomän + SPF/DKIM-verifiering (kan köras mot testläge lokalt).
- **Deploy-frysen** — inget går live förrän Zivar häver den.

---

## När du är klar

- `goal-68-ARBETSLOGG.md` fylld per fas (nyaste överst).
- Definition of Done-listan nedan genomgången punkt för punkt, med bevis.
- Lokal miljö startad och redo att demonstrera hela flödet för granskning.
- **Ingen** push/deploy — vänta på Zivars klartecken.

### Definition of Done

1. Kund kan boka utan konto. 2. Bokningen sparas atomiskt. 3. Rätt `customers`-rad skapas/matchas (via `contact_hash`, konservativt). 4. Bekräftelsemejl skapas och skickas. 5. Mejlet bär en säker hanteringslänk. 6. Länken öppnar exakt rätt bokning. 7. Kund kan skapa konto från bokningen. 8. Kontot länkas säkert till rätt kundrelation. 9–11. Kunden ser rätt kommande bokningar, historik och lojalitet. 12. Om-/avbokning enligt reglerna. 13. Rätt tenant-branding. 14. PWA installerbar. 15. Kunden aktiverar push själv. 16. Flera prenumerationer per konto. 17. Utgången prenumeration hanteras. 18. Push-/e-postfel påverkar aldrig bokningen. 19. Alla kommunikationsförsök loggas. 20. SMS kan anslutas senare utan omskrivning. 21. Datamodellen stödjer flera företag per konto. 22. "Mina företag" dold när flaggan är av. 23. Tenant-isolering bevisad med negativa tester. 24. Dubbla requests → inga dubbla bokningar/utskick. 25. Lokal miljö demar hela flödet. 26. Dokumentation: arkitektur, miljövariabler, lokalkörning, testning.

---

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-07-14 | Första utkast. Fristående prompt omgjord till grundad goal-brief: föreslagna namn mappade mot befintligt schema (`tenants`/`customers`/`tenant_settings.branding`/`modules`), global identitet identifierad som enda strukturellt nya nivån, deploy-frys + migrationsläge + `create_public_booking`-väg inlagda som låsta beslut. |
