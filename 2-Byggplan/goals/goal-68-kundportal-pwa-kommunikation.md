# 68 — Goal: Kundportal, PWA & kommunikation (KÖRBAR MASTER — autonom, Codex ⇄ Claude Code)

**Datum:** 2026-07-14 (v2.0 — en körbar goal)
**Typ:** Autonom byggorder för **Claude Code + Codex i CLI**, som samarbetar hela vägen. Körs via `/goal`.
**Vad detta är:** Den **enda ingångspunkten**. När denna goal är aktiverad sköter de två CLI-agenterna allt sinsemellan — **Zivar och planeraren stör inte**. Läs HELA filen + kanon-kedjan först.

> **Detta är ett stort delprojekt (Fas A–H). Kör det i sekvens, en arbetsenhet i taget, med review-grind mellan varje. Stanna aldrig för en människa — genuint mänskliga steg är parkerade längst ned och blockerar aldrig bygget. Under deploy-frysen betyder "klar" lokal/staging-verifiering, ALDRIG prod.**

---

## Kanon-kedjan — läs i denna ordning innan kod

1. `1-Planering/12-claude-och-codex/00-SAMMANSTALLNING-goal-68-och-codex.md` — gemensam sanning, lösta konflikter, fasordning A–H.
2. `1-Planering/12-claude-och-codex/01-CODEX-DESIGN-kundportal-kommunikation.md` — **spec** (produkt + arkitektur).
3. `1-Planering/12-claude-och-codex/02-CODEX-IMPLEMENTATIONSPLAN.md` — **plan** med fil-för-fil-detalj (U0–U13, tester, review-grindar).
4. Denna fil — den körbara mastern som binder ihop allt och styr samarbetet.

Vid krock vinner `SAMMANSTALLNING` + Codex `DESIGN`/`PLAN`. Denna fil får inte gå emot dem — den är avstämd (2026-07-14).

---

## Samarbetsprotokoll — Codex ⇄ Claude Code

- **Roller (kan växla per arbetsenhet, men EN äger en arbetsenhet i taget):**
  - **Byggare** — implementerar arbetsenheten (TDD), commitar, synkar.
  - **Granskare** — den andra agenten. Granskar mot arbetsenhetens *Klar när* + **faktisk kod/migration/test**, inte mot byggarens rapport. Betygsätter varje kryssruta SATISFIED / PARTIAL / MISSING.
- **Arbetsenhet = en U-punkt** (U0…U13 i Codex PLAN). **En i taget till grön.** Ingen nästa arbetsenhet förrän granskaren släpper den.
- **Review-grind mellan varje enhet:** brist → byggaren rättar i en fix-runda; först därefter nästa enhet. (= Codex-planens "oberoende review-grind efter varje arbetsenhet".)
- **Aldrig parallell skrivning i samma fil.** Lås per område — särskilt migrationer, auth/middleware/routing och `lib/communications/*`-kontrakten. Två agenter rör aldrig samma fil samtidigt.
- **En arbetsenhet = en (eller få) sammanhängande commit(s); synka före nästa** så den andra agenten ser sanningen, inte en osynkad arbetskopia.
- **Oklarhet/konflikt löses av agenterna själva mot kanon.** Hittas en genuin motsägelse i kanon: välj det `SAMMANSTALLNING` säger, skriv en rad i arbetsloggen, gå vidare. **Stanna aldrig för en människa.**
- **Gemensam arbetslogg:** `2-Byggplan/goals/goal-68-ARBETSLOGG.md`, nyaste överst. En rad per avslutad arbetsenhet: byggare, granskare, verdikt, ändrade filer, migration, testresultat, ev. flagga till Zivar. Detta är Zivars recap när han är tillbaka.

---

## Autonomi-regler

- Agenterna fattar **alla tekniska val själva** — fråga aldrig droppvis, vänta aldrig på människa.
- **Genuint mänskliga steg är parkerade längst ned** (§ Människo-grindar). Bygget går så långt det kan på lokal/staging och **stannar före** dem — det backar aldrig och gissar aldrig förbi dem.
- **Deploy-frys aktiv:** ingen prodmigration, ingen push till skarp miljö, ingen tagg, ingen deploy. **"Klar" = lokal/staging** schema- + testverifiering. Prodapplicering är en separat Zivar-grind.
- **DB endast via numrerade, idempotenta migrationer** med rollback-fil bredvid, `set search_path`. **Grep nästa lediga nummer vid byggstart — ≥ 0067** (`0065`/`0066` finns redan).
- **RLS + explicita grants + negativa tenant-tester** på varje ny exponerad tabell. Följ `private.tenant_id()`-mönstret; kund-/globala tabeller fence:as på `auth.uid()`.
- `pnpm typecheck` + `pnpm test` + bransch-vakt **grön före varje arbetsenhets commit**. Kör **aldrig** `next build` medan dev-servern är uppe (delad `.next` → `MODULE_NOT_FOUND`).
- Aldrig authz från `user_metadata`; aldrig service-role/secret i klient eller service worker.

---

## Beslut som redan är fattade — stanna INTE för dessa

**Namn-mappning (föreslaget → verklighet):** `business`→`tenants`/`tenant_id` · `business_customers`→befintliga **`customers`** (utöka) · `business_branding`→`tenant_settings.branding:jsonb` · feature flags→befintlig plattforms-/tenantkonfig (inventeras i Fas A, bygg inget andra flaggsystem) · lojalitet→`loyalty_ledger` (läs, bygg ej om).

**Identitet:** `customer_accounts` är **uppskjuten**. Våg 1 = `auth.uid()` + befintlig `customers` per tenant (`customers.auth_user_id` är redan unik per `(tenant_id, auth_user_id)`). Egen tabell först om **Fas A** bevisar behov.

**Host (LÅST):** `minbooking.corevo.se` = **personal** (oförändrad, regressionstestas) · `booking.corevo.se` = **admin** · kundportal `CUSTOMER_PORTAL_HOST` = **`mina.corevo.se`**, **våg 1 additivt på befintlig `/konto` på nuvarande deploy-host** (ingen DNS blockerar bygget; subdomänen aktiveras vid go-live).

**Matchning:** `public.customer_contact_hash` (tenant-saltad) + `merged_into`-tombstone + append-only `loyalty_ledger` (goal-41). Aldrig namn ensamt, aldrig TS-reimplementation.

**Bokning:** ny bokning via `create_public_booking` + EXCLUDE (auktoritativt krockskydd). Ombokning: återanvänd befintlig säker omboknings-action **om** rätt transaktionskontrakt; kringgå aldrig RPC/EXCLUDE. Kartläggs i Fas A.

**Övrigt:** bokning commitas före kommunikation; providerfel rör aldrig bokningen · `customer_multi_business_hub` byggs i datalagret men är **av** (ingen väljare/katalog) · SMS = interface/mock nu, riktig provider sist · ärliga statusord (aldrig "läst/sett" utan bevis) · PWA-service-worker **antas ej** — verifieras med filbevis i Fas A · providers "på riktigt" = lokal testprovider/staging först · commit-gräns = självständigt verifierbar arbetsenhet.

---

## Faserna — kör i ordning, en arbetsenhet i taget

Fas ↔ Codex-arbetsenheter. Fil-för-fil-detalj + reviewgrindar finns i Codex `PLAN`. *Klar när* här är fasens grind; varje U-punkt har dessutom sin egen i planen.

### Fas A — Analys & baseline *(F1 + U0, ingen produktkod)*
Bekräfta med **fil/rad-bevis**: schema, migrationsläge, authkopplingar, `/konto`, routing, PWA-mönster (SW!), e-post, reminder-cron, flaggornas faktiska lagringsyta, RLS. Bevisa dagens gästbokning överlever saknad mejlprovider.
**Klar när:** `goal-68-ANALYS.md` finns med (1) vad som finns, (2) återanvändbart, (3) måste ändras, (4) risker/migreringar, (5) stegplan, (6) parallelliserbart · mappningen ovan bekräftad mot faktisk kod · flaggmekanismens lagringsyta utskriven · **ingen kodändring gjord**.

### Fas B — Global identitet & säkerhetsfundament *(U1–U2 delvis + U5-token, U6-RLS)*
Kontrakt/typer + flaggor (alla av → dagens beteende), signerade/återkallbara bokningslänkar (hårdna befintlig HMAC), kommunikationspreferenser, snäva `auth.uid()`-RPC:er/vyer.
**Klar när:** avstängda flaggor ger diff-0 i dagens ytor · token för bokning A öppnar aldrig bokning B / tenant B / utgången / manipulerad · **negativa A↔B-tester gröna** · inga interna anteckningar eller andra tenants exponeras.

### Fas C — Kommunikationsledger & e-post *(U2–U4)*
`communication_events` + `communication_attempts` + `customer_communication_preferences`, transaktionell **outbox** i bokningens transaktionsgräns, dispatcher (lease/`FOR UPDATE SKIP LOCKED`, idempotens, retry, dead-letter), e-post bakom `CommunicationProvider` (återanvänd mallar/branding).
**Klar när:** samma event-idempotensnyckel → **en rad**; samma event/kanal/mottagare/templateversion → inget dubbel-attempt · bokning commitas när provider kastar · minst-once-jobb → högst ett utskick per nyckel (100 parallella claims testat) · gammal direktsändning + ledger mejlar aldrig dubbelt.

### Fas D — Säker kontoaktivering & central portal *(U5–U7)*
Länk→verifiering→`auth.uid()`→rätt tenant/`customers`. Extrahera/återanvänd `/konto`; central portal bakom host- + featureflagga. Startsida: nästa bokning → snabbåtgärder → lojalitet → historik → notisstatus. Tenant-branding.
**Klar när:** verifierat konto länkas konservativt, ingen osäker merge · `minbooking.corevo.se` → personal (host-routingtest) · flagga av → dagens `/konto` orört · en relation öppnas utan väljare; flera relationer + flagga av → bara explicit företag; ingen katalog/sök · mobil 360/390/768/desktop.

### Fas E — PWA & Web Push *(U8–U9)*
Kundmanifest, versionshanterad `customer-sw.js`, ärligt offlineläge, install efter värdeögonblick. `customer_push_subscriptions` (en rad/enhet). Push-behörighet efter eget klick + förklaringsruta.
**Klar när:** installerbar utan att röra admin/personal-manifest · SW cachar aldrig auth/privat data publikt · offline blockerar mutationer (ingen falsk "ombokad/avbokad") · ingen prompt vid load · två enheter, endpoint A=410 → bara A inaktiveras · notification-click bara mot allowlistad intern route · ingen känslig låsskärmstext.

### Fas F — Policy & kommunikationsöversikt *(U10–U11)*
Ren, deterministisk policy-resolver (event × email × push × tenantpolicy × kundpreferens; separat marknadsföringssamtycke; `manual_attention` när ingen kanal). Adminöversikt bakom flagga: ärliga räknare, kostnadssnapshot, CSV-underlag.
**Klar när:** bekräftelse ger e-post även när push finns · marknadsföring använder aldrig transaktionellt samtycke · kritisk ändring utan kanal → `manual_attention`, aldrig falsk success · tenant A:s ägare kan ej exportera tenant B · varje visad summa härledd ur immutable attempts · kalenderpersonal nekas ytan.

### Fas G — Säkerhet, last & drift *(U12)*
Fullt flöde gästbokning→event→mejl→länk→konto→portal→push. Negativa tenant/auth/token/subscription/export-tester. Last: dubbelklick, dubbla köleveranser, providerfel, gammal SW, Worker-requestmätning.
**Klar när:** hela flödet demonstrerat lokalt/staging · noll tappade/dubbla bokningar/utskick under last · alla negativa säkerhetstester gröna · `pnpm typecheck`/`test`/`build` (dev-server av) + Playwright mot staging gröna · oberoende granskare jämför bevisen mot DoD.

### Fas H — Riktig SMS-provider *(U13 — sist, människo-grindad)*
Interface/mock är byggt sedan Fas C. **Riktig SMS-trafik byggs INTE här autonomt** — den kräver Zivars val av leverantör/pris/avsändare/go. Förbered allt runt: E.164-normalisering, segmentberäkning, webhook-signatur, immutable kostnadssnapshot, kill switch, tenantflagga (av).
**Klar när:** allt utom riktig sändning är byggt och testat mot mock · `sms_enabled` = false · en tydlig rad i arbetsloggen: "Fas H väntar Zivars SMS-go."

---

## Människo-grindar — parkerade, blockerar ALDRIG bygget

Bygg klart allt lokalt/staging. **Stanna före** dessa, skriv dem i arbetsloggen, fortsätt inte förbi:

- **Prodapplicering** av migrationer (deploy-frysen).
- **Riktig e-post:** avsändardomän + SPF/DKIM (kör mot testprovider tills dess).
- **VAPID-nycklar** för push: generera par lokalt; privat nyckel i secrets = Zivar.
- **DNS för `mina.corevo.se`** (våg 1 kör på `/konto`, ingen DNS krävs för att bygga).
- **SMS:** leverantör + pris + avsändare + go (Fas H).
- **Cloudflare Workers Paid** före affärskritisk FreshCut-trafik.
- **Go-live / deploy** — först när Zivar häver frysen.

---

## Definition of Done (lokal/staging under frysen)

Gästbokning utan konto överlever kommunikationsfel · e-post via beständigt event/attempt med säker länk · säker kontolänkning utan cross-tenant-läckage · portalens tenantläge visar bokningar/historik/lojalitet/branding · datamodellen bär flera relationer men UI visar ingen väljare med flaggan av · kund-PWA installerbar med ärligt offlineläge · push per enhet, permanent endpointfel isoleras · idempotens under retry/samtidighet · ägaren ser sann kanalstatus + exportunderlag · SMS-adapter kan anslutas utan ändring i bokningsdomänen, riktig trafik av tills Fas H-go · tenant-isolering bevisad med negativa tester · dubbla requests → inga dubbletter · lokal/staging demonstrerar HELA flödet · dokumentation (arkitektur→`5-Kod/docs/`, drift→`5-Kod/docs/ops/`, manuella enhetstester→`6-Testing/`).

---

## När ni är klara

- `goal-68-ARBETSLOGG.md` fylld per arbetsenhet.
- DoD genomgången med bevis (testartefakter + stagingbevis, inte påståenden).
- Bygget stannat före människo-grindarna, dessa listade.
- Lokal/staging-miljö redo att demonstrera hela flödet. **Ingen push/deploy.**

---

## /goal — klistras in för att aktivera

```
/goal

Kör 2-Byggplan/goals/goal-68-kundportal-pwa-kommunikation.md — kundportal, PWA & kommunikation, autonomt, Codex + Claude Code samarbetar. 

Villkor:
- Filen + kanon-kedjan i 1-Planering/12-claude-och-codex/ är enda ingångspunkten. Läs först.
- Autonomt: alla tekniska val själva, allt via kod/migration/CLI, fråga aldrig droppvis, stanna aldrig för människa.
- Samarbetsprotokollet gäller: en arbetsenhet i taget, byggare + oberoende granskare, review-grind mellan varje, aldrig parallell skrivning i samma fil, gemensam arbetslogg.
- DB via numrerade idempotenta migrationer ≥0067 + rollback + RLS + negativa tester. pnpm typecheck+test grönt före varje commit.
- Deploy-frys: klar = lokal/staging. Ingen prodmigration, push, tagg eller deploy. Människo-grindarna parkeras, blockerar aldrig.
- Stanna när alla faser är lokal/staging-verifierade och människo-grindarna är listade i arbetsloggen.
```

---

## Versionshistorik

| Version | Datum | Ändring |
|---|---|---|
| 1.0 | 2026-07-14 | Fristående prompt → grundad goal-brief. |
| 1.1 | 2026-07-14 | Avstämd mot Codex `SAMMANSTALLNING` (host, migration ≥0067, frys=staging, PWA-SW, `customer_accounts` uppskjuten). |
| 2.0 | 2026-07-14 | **Omgjord till EN körbar autonom master-goal.** Samarbetsprotokoll Codex⇄Claude Code, autonomi-regler, alla faser A–H med *Klar när*, människo-grindar parkerade, `/goal`-kommando. Körs utan att Zivar/planeraren stör. |
